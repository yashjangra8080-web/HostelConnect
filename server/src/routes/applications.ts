import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { withRequestConn, pool, Role } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const applicationsRouter = Router();

const WHITELISTED_SORT_COLUMNS = [
  'applied_at',
  'distance_km',
  'merit_rank',
  'roll_no',
  'full_name',
  'verification_status',
  'application_id',
] as const;

type SortColumn = typeof WHITELISTED_SORT_COLUMNS[number];

const appFilterSchema = z.object({
  search: z.string().trim().optional(),
  cycle_id: z.coerce.number().int().positive().optional(),
  verification_status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional(),
  gender: z.enum(['M', 'F']).optional(),
  branch: z.string().trim().optional(),
  schooling_state: z.string().trim().optional(),
  distance_band: z.coerce.number().int().min(1).max(4).optional(),
  merit_min: z.coerce.number().int().positive().optional(),
  merit_max: z.coerce.number().int().positive().optional(),
  sort_by: z.enum(WHITELISTED_SORT_COLUMNS).default('applied_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

interface KeysetCursor {
  sortVal: any;
  id: number;
}

function encodeCursor(sortVal: any, id: number): string {
  // Format Date objects or nulls cleanly
  const val = sortVal instanceof Date ? sortVal.toISOString() : sortVal;
  return Buffer.from(JSON.stringify({ sortVal: val, id })).toString('base64');
}

function decodeCursor(cursorStr: string): KeysetCursor | null {
  try {
    const raw = Buffer.from(cursorStr, 'base64').toString('utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'number') {
      return parsed as KeysetCursor;
    }
    return null;
  } catch {
    return null;
  }
}

function buildWhereClause(q: z.infer<typeof appFilterSchema>) {
  const whereClauses: string[] = ['1=1'];
  const params: any[] = [];

  // Server-side search: FULLTEXT on name or prefix on roll_no
  if (q.search && q.search.trim().length > 0) {
    const term = q.search.trim();
    const cleanFt = term.replace(/[^\w\s]/gi, '').trim();
    const ftTerm = cleanFt.length > 0 ? `${cleanFt}*` : term;
    whereClauses.push(
      '(roll_no LIKE CONCAT(?, \'%\') OR MATCH(full_name) AGAINST(? IN BOOLEAN MODE) OR full_name LIKE CONCAT(\'%\', ?, \'%\'))'
    );
    params.push(term, ftTerm, term);
  }

  // Cycle filter
  if (q.cycle_id !== undefined) {
    whereClauses.push('cycle_id = ?');
    params.push(q.cycle_id);
  }

  // Verification status filter
  if (q.verification_status) {
    whereClauses.push('verification_status = ?');
    params.push(q.verification_status);
  }

  // Gender filter
  if (q.gender) {
    whereClauses.push('gender = ?');
    params.push(q.gender);
  }

  // Branch filter
  if (q.branch) {
    whereClauses.push('branch = ?');
    params.push(q.branch);
  }

  // Schooling state / Delhi filter
  if (q.schooling_state) {
    const val = q.schooling_state.toLowerCase();
    if (val === 'delhi' || val === '1') {
      whereClauses.push('is_delhi_candidate = 1');
    } else if (val === 'outside_delhi' || val === 'non_delhi') {
      whereClauses.push('is_delhi_candidate = 0');
    } else if (/^\d+$/.test(val)) {
      whereClauses.push('schooling_state_id = ?');
      params.push(Number(val));
    } else {
      whereClauses.push('schooling_state LIKE CONCAT(\'%\', ?, \'%\')');
      params.push(q.schooling_state);
    }
  }

  // Distance band filter
  if (q.distance_band !== undefined) {
    whereClauses.push('distance_band = ?');
    params.push(q.distance_band);
  }

  // Merit range filters
  if (q.merit_min !== undefined) {
    whereClauses.push('merit_rank >= ?');
    params.push(q.merit_min);
  }
  if (q.merit_max !== undefined) {
    whereClauses.push('merit_rank <= ?');
    params.push(q.merit_max);
  }

  return { whereClauses, params };
}

/**
 * GET /api/applications/kpis
 * Returns flat live KPI strip metrics from seeded database.
 */
applicationsRouter.get(
  '/kpis',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const cycleId = req.query.cycle_id ? Number(req.query.cycle_id) : 1;

      const kpis = await withRequestConn(user.role, user.userId, async (conn) => {
        const [appStats] = await conn.query<any[]>(
          `SELECT 
            COUNT(*) AS total_applications,
            SUM(CASE WHEN verification_status = 'PENDING' THEN 1 ELSE 0 END) AS pending_verification,
            SUM(CASE WHEN verification_status = 'VERIFIED' THEN 1 ELSE 0 END) AS verified_applications,
            SUM(CASE WHEN verification_status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected_applications,
            SUM(CASE WHEN is_delhi_candidate = 1 THEN 1 ELSE 0 END) AS delhi_applications,
            SUM(CASE WHEN is_delhi_candidate = 0 THEN 1 ELSE 0 END) AS non_delhi_applications,
            ROUND(AVG(distance_km), 2) AS avg_distance_km
           FROM v_scoped_applications
           WHERE cycle_id = ?`,
          [cycleId]
        );

        const [residenceStats] = await conn.query<any[]>(
          `SELECT 
            (SELECT COUNT(*) FROM students) AS total_students,
            (SELECT COUNT(*) FROM allotments WHERE is_published = 0 OR is_published = 1) AS allotted_residents,
            (SELECT SUM(capacity) FROM rooms) AS total_capacity`
        );

        return {
          totalApplications: Number(appStats[0]?.total_applications || 0),
          pendingVerification: Number(appStats[0]?.pending_verification || 0),
          verifiedApplications: Number(appStats[0]?.verified_applications || 0),
          rejectedApplications: Number(appStats[0]?.rejected_applications || 0),
          delhiApplications: Number(appStats[0]?.delhi_applications || 0),
          nonDelhiApplications: Number(appStats[0]?.non_delhi_applications || 0),
          avgDistanceKm: Number(appStats[0]?.avg_distance_km || 0),
          totalStudents: Number(residenceStats[0]?.total_students || 0),
          allottedResidents: Number(residenceStats[0]?.allotted_residents || 0),
          totalCapacity: Number(residenceStats[0]?.total_capacity || 0),
        };
      });

      res.json(kpis);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/applications/export
 * CSV export of the current filtered view (HOSTEL_OFFICE/ADMIN only).
 */
applicationsRouter.get(
  '/export',
  requireAuth,
  requireRole('HOSTEL_OFFICE', 'ADMIN'),
  validate(appFilterSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const q = req.query as unknown as z.infer<typeof appFilterSchema>;

      const { whereClauses, params } = buildWhereClause(q);
      const whereSql = whereClauses.join(' AND ');

      const sortBy: SortColumn = q.sort_by;
      const sortOrder = q.sort_order.toUpperCase() as 'ASC' | 'DESC';
      const orderSql =
        sortBy === 'application_id'
          ? `application_id ${sortOrder}`
          : `${sortBy} ${sortOrder}, application_id ${sortOrder}`;

      const rows = await withRequestConn(user.role, user.userId, async (conn) => {
        const [results] = await conn.query<any[]>(
          `SELECT 
            application_id, cycle_id, academic_year, student_id, roll_no, full_name,
            gender, branch, batch_year, merit_rank, schooling_state, is_delhi_candidate,
            home_city, home_state, study_habit, distance_km, distance_band,
            verification_status, application_status, applied_at, verified_by_name
           FROM v_scoped_applications
           WHERE ${whereSql}
           ORDER BY ${orderSql}`,
          params
        );
        return results;
      });

      // Format as CSV
      const headers = [
        'Application ID',
        'Roll Number',
        'Full Name',
        'Gender',
        'Branch',
        'Batch Year',
        'Merit Rank',
        'Schooling State',
        'Delhi Candidate',
        'Home City',
        'Home State',
        'Study Habit',
        'Distance (km)',
        'Distance Band',
        'Verification Status',
        'Allotment Status',
        'Applied At',
        'Verified By',
      ];

      const escapeCsvValue = (val: any) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvLines = [headers.join(',')];
      for (const r of rows) {
        const line = [
          r.application_id,
          escapeCsvValue(r.roll_no),
          escapeCsvValue(r.full_name),
          r.gender,
          escapeCsvValue(r.branch),
          r.batch_year,
          r.merit_rank,
          escapeCsvValue(r.schooling_state),
          r.is_delhi_candidate ? 'Yes (Delhi)' : 'No (Non-Delhi)',
          escapeCsvValue(r.home_city),
          escapeCsvValue(r.home_state),
          r.study_habit,
          r.distance_km,
          `Band ${r.distance_band}`,
          r.verification_status,
          r.application_status,
          r.applied_at ? new Date(r.applied_at).toISOString() : '',
          escapeCsvValue(r.verified_by_name || 'Unverified'),
        ].join(',');
        csvLines.push(line);
      }

      const csvContent = csvLines.join('\r\n');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="applications-export-${timestamp}.csv"`
      );
      res.status(200).send(csvContent);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/applications
 * Keyset-paginated list of applications with server-side filters and total count.
 */
applicationsRouter.get(
  '/',
  requireAuth,
  validate(appFilterSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const q = req.query as unknown as z.infer<typeof appFilterSchema>;

      const sortBy: SortColumn = q.sort_by;
      const sortOrder = q.sort_order.toUpperCase() as 'ASC' | 'DESC';
      const limit = q.limit;
      const cursor = q.cursor ? decodeCursor(q.cursor) : null;

      const { whereClauses, params } = buildWhereClause(q);
      const baseWhereSql = whereClauses.join(' AND ');

      const data = await withRequestConn(user.role, user.userId, async (conn) => {
        // 1. Total count matching current filters
        const [countRows] = await conn.query<any[]>(
          `SELECT COUNT(*) AS total FROM v_scoped_applications WHERE ${baseWhereSql}`,
          params
        );
        const total = Number(countRows[0]?.total || 0);

        // 2. Keyset pagination seek clause
        const pagedWhere = [...whereClauses];
        const pagedParams = [...params];

        if (cursor) {
          const comp = sortOrder === 'ASC' ? '>' : '<';
          if (sortBy === 'application_id') {
            pagedWhere.push(`application_id ${comp} ?`);
            pagedParams.push(cursor.id);
          } else {
            pagedWhere.push(
              `(${sortBy} ${comp} ? OR (${sortBy} = ? AND application_id ${comp} ?))`
            );
            pagedParams.push(cursor.sortVal, cursor.sortVal, cursor.id);
          }
        }

        const pagedWhereSql = pagedWhere.join(' AND ');
        const orderSql =
          sortBy === 'application_id'
            ? `application_id ${sortOrder}`
            : `${sortBy} ${sortOrder}, application_id ${sortOrder}`;

        const [rows] = await conn.query<any[]>(
          `SELECT 
            application_id, cycle_id, academic_year, cycle_status, student_id,
            roll_no, full_name, gender, branch, batch_year, merit_rank,
            schooling_state_id, schooling_state, is_delhi_candidate,
            home_city_id, home_city, home_state, study_habit, distance_km,
            distance_band, verification_status, application_status, applied_at,
            verified_by, verified_by_name, hostel_name, room_no
           FROM v_scoped_applications
           WHERE ${pagedWhereSql}
           ORDER BY ${orderSql}
           LIMIT ?`,
          [...pagedParams, limit + 1]
        );

        const hasMore = rows.length > limit;
        const items = hasMore ? rows.slice(0, limit) : rows;

        let nextCursor: string | null = null;
        if (hasMore && items.length > 0) {
          const lastItem = items[items.length - 1];
          nextCursor = encodeCursor(lastItem[sortBy], lastItem.application_id);
        }

        return {
          items,
          total,
          limit,
          hasMore,
          nextCursor,
        };
      });

      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

const submitAppSchema = z.object({
  student_id: z.number().int().positive().optional(),
  cycle_id: z.number().int().positive(),
  study_habit: z.enum(['DAY', 'NIGHT']).optional(),
});

/**
 * POST /api/applications
 * Submits a new hostel application via stored procedure sp_submit_application.
 * Requires an OPEN cycle, rejects duplicates, and stores Haversine distance from student city to NSUT campus.
 */
applicationsRouter.post(
  '/',
  requireAuth,
  validate(submitAppSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const body = req.body;

      let studentId: number;

      if (user.role === 'STUDENT') {
        const [sRows] = await pool.query<any[]>(
          'SELECT student_id, study_habit FROM students WHERE user_id = ?',
          [user.userId]
        );
        if (!sRows || sRows.length === 0) {
          return res.status(404).json({ error: 'NotFound', message: 'Student profile not found.' });
        }
        studentId = sRows[0].student_id;

        // If student is setting/updating study habit before applying
        if (body.study_habit && body.study_habit !== sRows[0].study_habit) {
          await pool.query('UPDATE students SET study_habit = ? WHERE student_id = ?', [
            body.study_habit,
            studentId,
          ]);
        }
      } else if (['ADMIN', 'HOSTEL_OFFICE'].includes(user.role)) {
        if (!body.student_id) {
          return res.status(400).json({
            error: 'BadRequest',
            message: 'student_id is required when submitting on behalf of a student.',
          });
        }
        studentId = body.student_id;
      } else {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Only students or hostel administration may submit applications.',
        });
      }

      // Execute sp_submit_application with session context
      const result = await withRequestConn(user.role, user.userId, async (conn) => {
        const [callResult] = await conn.query<any[]>(
          'CALL sp_submit_application(?, ?)',
          [studentId, body.cycle_id]
        );
        return callResult[0][0];
      });

      res.status(201).json({
        message: 'Application submitted successfully.',
        application: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

const verifySchema = z.object({
  application_id: z.number().int().positive().optional(),
  application_ids: z.array(z.number().int().positive()).optional(),
  decision: z.enum(['VERIFIED', 'REJECTED']),
}).refine((data) => data.application_id !== undefined || (data.application_ids && data.application_ids.length > 0), {
  message: 'Either application_id or application_ids must be provided.',
});

/**
 * POST /api/applications/verify
 * Verifies or rejects single or bulk applications in one transaction, audited.
 * Restricted to HOSTEL_OFFICE and ADMIN.
 */
applicationsRouter.post(
  '/verify',
  requireAuth,
  requireRole('HOSTEL_OFFICE', 'ADMIN'),
  validate(verifySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { application_id, application_ids, decision } = req.body;

      if (application_ids && application_ids.length > 0) {
        // Bulk verify in one atomic transaction
        const result = await withRequestConn(user.role, user.userId, async (conn) => {
          const jsonIds = JSON.stringify(application_ids);
          const [callRes] = await conn.query<any[]>(
            'CALL sp_bulk_verify(?, ?)',
            [jsonIds, decision]
          );
          return callRes[0][0];
        });

        return res.json({
          message: `Successfully marked ${result.updated_count} application(s) as ${decision}.`,
          updatedCount: result.updated_count,
          decision,
        });
      } else if (application_id) {
        // Single verify
        const result = await withRequestConn(user.role, user.userId, async (conn) => {
          const [callRes] = await conn.query<any[]>(
            'CALL sp_verify_application(?, ?)',
            [application_id, decision]
          );
          return callRes[0][0];
        });

        return res.json({
          message: `Application #${application_id} successfully marked as ${decision}.`,
          application: result,
          decision,
        });
      }
    } catch (err) {
      next(err);
    }
  }
);
