import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { withRequestConn } from '../db.js';

export const searchRouter = Router();

const searchSchema = z.object({
  q: z.string().trim().min(1, 'Search query cannot be empty').max(100),
});

export interface SearchResult {
  id: string | number;
  type: 'student' | 'page' | 'complaint' | 'notice';
  title: string;
  subtitle: string;
  meta?: string;
  url: string;
}

const STUDENT_PAGES = [
  { title: 'Resident Dashboard', subtitle: 'Overview of hostel allotment, dining, and alerts', url: '/student' },
  { title: 'My Room & Allotment', subtitle: 'View allotment status, merit rank, and room details', url: '/student/allotment' },
  { title: 'Mess Attendance', subtitle: 'View today\'s meal schedule and scanned attendance records', url: '/student/mess' },
  { title: 'Mess Refund Ledger', subtitle: 'Track monthly dining rebates and attendance deductions', url: '/student/refunds' },
  { title: 'Smart Laundry', subtitle: 'Check live washing machine availability and countdown timers', url: '/student/laundry' },
  { title: 'Confidential Complaints', subtitle: 'Submit or track grievances with anonymous tracking codes', url: '/student/complaints' },
  { title: 'Notices & Circulars', subtitle: 'Official NSUT hostel announcements and weekly water quality', url: '/student/notices' },
];

/**
 * GET /api/search?q=
 * Universal search endpoint:
 * - Staff roles: search students by FULLTEXT on name and prefix on roll_no (scoped to role/hostel)
 * - Students: search application pages and own records (complaints via stored procedure, notices)
 * Max 8 results.
 */
searchRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = searchSchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(200).json({ query: '', results: [] });
    }

    const { q } = parseResult.data;
    const session = req.user!;
    const isStaff = session.role !== 'STUDENT';
    const results: SearchResult[] = [];

    await withRequestConn(session.role, session.userId, async (conn) => {
      if (isStaff) {
        // 1. Check if user is a Warden or Caretaker assigned to a specific hostel
        let assignedHostelId: number | null = null;
        if (session.role === 'WARDEN' || session.role === 'CARETAKER') {
          const [authRows] = await conn.query<any[]>(
            'SELECT hostel_id FROM authorities WHERE user_id = ?',
            [session.userId]
          );
          if (authRows.length > 0 && authRows[0].hostel_id) {
            assignedHostelId = authRows[0].hostel_id;
          }
        }

        // Clean query for MySQL FULLTEXT boolean mode: keep alphanumeric and append wildcard
        const ftQuery = q.replace(/[^\w\s]/gi, '').trim();
        const ftTerm = ftQuery.length > 0 ? `${ftQuery}*` : q;

        let sql = `
          SELECT s.student_id, s.roll_no, s.full_name, s.branch, s.batch_year, s.gender,
                 h.hostel_name, r.room_no
          FROM students s
          LEFT JOIN allotments a ON a.student_id = s.student_id
          LEFT JOIN rooms r ON r.room_id = a.room_id
          LEFT JOIN hostels h ON h.hostel_id = r.hostel_id
          WHERE (
            s.roll_no LIKE CONCAT(?, '%')
            OR MATCH(s.full_name) AGAINST(? IN BOOLEAN MODE)
            OR s.full_name LIKE CONCAT('%', ?, '%')
          )
        `;
        const params: any[] = [q, ftTerm, q];

        if (assignedHostelId !== null) {
          sql += ' AND r.hostel_id = ?';
          params.push(assignedHostelId);
        }

        sql += ' ORDER BY s.student_id ASC LIMIT 8';

        const [rows] = await conn.query<any[]>(sql, params);

        for (const row of rows) {
          const roomMeta = row.room_no ? ` • Room ${row.room_no} (${row.hostel_name || 'Hostel'})` : ' • Unallotted';
          results.push({
            id: row.student_id,
            type: 'student',
            title: row.full_name,
            subtitle: row.roll_no,
            meta: `${row.branch || 'Engg'} • Batch ${row.batch_year || '2026'}${roomMeta}`,
            url: `/residents/${row.roll_no}`,
          });
        }
      } else {
        // Student search:
        // 1. Match pages
        const lowerQ = q.toLowerCase();
        for (const page of STUDENT_PAGES) {
          if (results.length >= 8) break;
          if (
            page.title.toLowerCase().includes(lowerQ) ||
            page.subtitle.toLowerCase().includes(lowerQ)
          ) {
            results.push({
              id: page.url,
              type: 'page',
              title: page.title,
              subtitle: page.subtitle,
              url: page.url,
            });
          }
        }

        // 2. Match student's own complaints using stored procedure sp_get_my_complaints
        if (results.length < 8) {
          try {
            const [procResults] = await conn.query<any[]>('CALL sp_get_my_complaints()');
            const myComplaints = procResults[0] || [];
            for (const c of myComplaints) {
              if (results.length >= 8) break;
              if (
                c.tracking_code?.toLowerCase().includes(lowerQ) ||
                c.category?.toLowerCase().includes(lowerQ) ||
                c.subject?.toLowerCase().includes(lowerQ)
              ) {
                results.push({
                  id: c.complaint_id,
                  type: 'complaint',
                  title: `Complaint #${c.tracking_code}`,
                  subtitle: `${c.category} • ${c.subject || 'Grievance'} • Status: ${c.status}`,
                  meta: `Created: ${new Date(c.created_at).toLocaleDateString('en-IN')}`,
                  url: `/student/complaints`,
                });
              }
            }
          } catch {
            // Ignore if student is not registered or no complaints found
          }
        }

        // 3. Match notices if still under 8
        if (results.length < 8) {
          const remaining = 8 - results.length;
          const [noticeRows] = await conn.query<any[]>(
            `SELECT notice_id, title, category, starts_at
             FROM notices
             WHERE title LIKE CONCAT('%', ?, '%')
             ORDER BY notice_id DESC
             LIMIT ?`,
            [q, remaining]
          );

          for (const n of noticeRows) {
            results.push({
              id: n.notice_id,
              type: 'notice',
              title: n.title,
              subtitle: `Notice • ${n.category}`,
              meta: `Issued: ${new Date(n.starts_at).toLocaleDateString('en-IN')}`,
              url: `/student/notices`,
            });
          }
        }
      }
    });

    return res.status(200).json({
      query: q,
      total: results.length,
      results: results.slice(0, 8),
    });
  } catch (err) {
    next(err);
  }
});
