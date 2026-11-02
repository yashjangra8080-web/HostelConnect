import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { withRequestConn } from '../db.js';
import { requireAuth, requireRole, verifyCsrf } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const noticesRouter = Router();

const createNoticeSchema = z.object({
  category: z.enum(['CIRCULAR', 'WATER_QUALITY', 'PEST_CONTROL', 'ELECTRICIAN', 'PLUMBER', 'GENERAL']),
  hostel_id: z.number().int().positive().nullable().optional(),
  title: z.string().min(1).max(160),
  body: z.string().optional().nullable(),
  is_pinned: z.boolean().optional().default(false),
  starts_at: z.string().optional().nullable(),
  ends_at: z.string().optional().nullable(),
});

/**
 * GET /api/notices
 * Search, category, active-now filters, pinned first, server pagination.
 * Scoped by residence for STUDENT role.
 */
noticesRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const category = typeof req.query.category === 'string' && req.query.category ? req.query.category : undefined;
    const activeNow = req.query.activeNow === 'true' || req.query.activeNow === '1';
    const hostelParam = req.query.hostel_id ? parseInt(req.query.hostel_id as string, 10) : undefined;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize as string, 10) || 10));
    const offset = (page - 1) * pageSize;

    const result = await withRequestConn(user.role, user.userId, async (conn) => {
      let studentHostelId: number | null = null;
      if (user.role === 'STUDENT') {
        const [resRows] = await conn.query<any[]>(
          'SELECT hostel_id FROM v_current_residence WHERE user_id = ? LIMIT 1',
          [user.userId]
        );
        studentHostelId = resRows[0]?.hostel_id || null;
      }

      // Build WHERE clauses
      const whereClauses: string[] = ['1=1'];
      const params: any[] = [];

      // Residence scoping for students
      if (user.role === 'STUDENT') {
        if (studentHostelId) {
          whereClauses.push('(n.hostel_id IS NULL OR n.hostel_id = ?)');
          params.push(studentHostelId);
        } else {
          whereClauses.push('n.hostel_id IS NULL');
        }
      } else if (hostelParam) {
        whereClauses.push('(n.hostel_id IS NULL OR n.hostel_id = ?)');
        params.push(hostelParam);
      }

      if (category) {
        whereClauses.push('n.category = ?');
        params.push(category);
      }

      if (search) {
        whereClauses.push('(n.title LIKE ? OR n.body LIKE ?)');
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern);
      }

      if (activeNow) {
        whereClauses.push('(n.starts_at IS NULL OR n.starts_at <= NOW())');
        whereClauses.push('(n.ends_at IS NULL OR n.ends_at >= NOW())');
      }

      const whereSql = whereClauses.join(' AND ');

      // Total count for pagination
      const [countRows] = await conn.query<any[]>(
        `SELECT COUNT(*) as total FROM notices n WHERE ${whereSql}`,
        params
      );
      const total = Number(countRows[0]?.total || 0);

      // Fetch paginated notices: pinned first, then starts_at / notice_id DESC
      const [rows] = await conn.query<any[]>(
        `SELECT n.notice_id, n.category, n.hostel_id, h.hostel_name, n.title, n.body,
                n.is_pinned, n.starts_at, n.ends_at, auth.full_name AS posted_by_name
         FROM notices n
         LEFT JOIN hostels h ON n.hostel_id = h.hostel_id
         LEFT JOIN authorities auth ON n.posted_by = auth.authority_id
         WHERE ${whereSql}
         ORDER BY n.is_pinned DESC, COALESCE(n.starts_at, '2026-01-01 00:00:00') DESC, n.notice_id DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );

      return {
        notices: rows,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notices
 * Restricted to: ADMIN, HOSTEL_OFFICE, CHIEF_WARDEN, WARDEN
 * Caretaker and Student rejected with 403 Forbidden.
 */
noticesRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN'),
  verifyCsrf,
  validate(createNoticeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { category, hostel_id, title, body, is_pinned, starts_at, ends_at } = req.body;

      const result = await withRequestConn(user.role, user.userId, async (conn) => {
        // Resolve authority_id for caller
        const [authRows] = await conn.query<any[]>(
          'SELECT authority_id FROM authorities WHERE user_id = ?',
          [user.userId]
        );
        const authorityId = authRows[0]?.authority_id || 1;

        const [insertResult] = await conn.query<any>(
          `INSERT INTO notices (category, hostel_id, title, body, is_pinned, starts_at, ends_at, posted_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            category,
            hostel_id || null,
            title,
            body || null,
            is_pinned ? 1 : 0,
            starts_at || new Date().toISOString().slice(0, 19).replace('T', ' '),
            ends_at || null,
            authorityId,
          ]
        );

        return { noticeId: insertResult.insertId };
      });

      return res.status(201).json({
        message: 'Notice published successfully.',
        noticeId: result.noticeId,
      });
    } catch (err) {
      next(err);
    }
  }
);
