import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { withRequestConn, Role } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const allotmentRouter = Router();

const cycleIdSchema = z.object({
  cycle_id: z.coerce.number().int().positive().default(1),
});

const respondSchema = z.object({
  cycle_id: z.coerce.number().int().positive().default(1),
  response: z.enum(['ACCEPTED', 'DECLINED']),
});

const withdrawSchema = z.object({
  cycle_id: z.coerce.number().int().positive().default(1),
});

/**
 * GET /api/allotment/cycle/:id
 * Returns allotment cycle metadata, current status, and stats.
 */
allotmentRouter.get(
  '/cycle/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cycleId = Number(req.params.id) || 1;
      const userRole = (req.user?.role || 'STUDENT') as Role;
      const userId = req.user?.userId;

      await withRequestConn(userRole, userId, async (conn) => {
        const [cycleRows] = await conn.query<any[]>(
          'SELECT * FROM allotment_cycles WHERE cycle_id = ?',
          [cycleId]
        );

        if (cycleRows.length === 0) {
          return res.status(404).json({
            error: { code: 'NOT_FOUND', message: 'Cycle not found.' },
          });
        }

        const cycle = cycleRows[0];

        // Fetch counts
        const [allotmentCountRows] = await conn.query<any[]>(
          'SELECT COUNT(*) as count FROM allotments WHERE cycle_id = ?',
          [cycleId]
        );

        const [appStatsRows] = await conn.query<any[]>(
          'SELECT status, COUNT(*) as count FROM applications WHERE cycle_id = ? GROUP BY status',
          [cycleId]
        );

        const appStats: Record<string, number> = {};
        for (const row of appStatsRows) {
          appStats[row.status] = row.count;
        }

        res.json({
          cycle,
          allotments_count: allotmentCountRows[0]?.count || 0,
          application_stats: appStats,
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/allotment/dry-run
 * Executes sp_run_allotment with dry_run = 1.
 * Rolls back changes and returns the planned room allocation.
 * Restricted to HOSTEL_OFFICE and ADMIN.
 */
allotmentRouter.post(
  '/dry-run',
  requireAuth,
  requireRole(['HOSTEL_OFFICE', 'ADMIN']),
  validate(cycleIdSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cycle_id } = req.body;
      const userRole = (req.user?.role || 'HOSTEL_OFFICE') as Role;
      const userId = req.user?.userId;

      await withRequestConn(userRole, userId, async (conn) => {
        const [results] = await conn.query<any[]>(
          'CALL sp_run_allotment(?, 1)',
          [cycle_id]
        );

        // First result set contains the plan
        const plan = Array.isArray(results) && Array.isArray(results[0]) ? results[0] : [];

        const allotted = plan.filter((p: any) => p.status === 'ALLOTTED');
        const waitlisted = plan.filter((p: any) => p.status === 'WAITLISTED');

        res.json({
          status: 'success',
          dry_run: true,
          cycle_id,
          summary: {
            total_planned: plan.length,
            allotted_count: allotted.length,
            waitlisted_count: waitlisted.length,
            allotted_by_gender: {
              M: allotted.filter((p: any) => p.gender === 'M').length,
              F: allotted.filter((p: any) => p.gender === 'F').length,
            },
            allotted_by_habit: {
              DAY: allotted.filter((p: any) => p.study_habit === 'DAY').length,
              NIGHT: allotted.filter((p: any) => p.study_habit === 'NIGHT').length,
            },
          },
          plan,
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/allotment/run
 * Executes sp_run_allotment with dry_run = 0.
 * Persists allotments, updates application statuses to ALLOTTED / WAITLISTED,
 * and advances cycle status to ALLOTTED.
 * Restricted to HOSTEL_OFFICE and ADMIN.
 */
allotmentRouter.post(
  '/run',
  requireAuth,
  requireRole(['HOSTEL_OFFICE', 'ADMIN']),
  validate(cycleIdSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cycle_id } = req.body;
      const userRole = (req.user?.role || 'HOSTEL_OFFICE') as Role;
      const userId = req.user?.userId;

      await withRequestConn(userRole, userId, async (conn) => {
        const [results] = await conn.query<any[]>(
          'CALL sp_run_allotment(?, 0)',
          [cycle_id]
        );

        const plan = Array.isArray(results) && Array.isArray(results[0]) ? results[0] : [];
        const allotted = plan.filter((p: any) => p.status === 'ALLOTTED');
        const waitlisted = plan.filter((p: any) => p.status === 'WAITLISTED');

        res.json({
          status: 'success',
          dry_run: false,
          cycle_id,
          summary: {
            total_evaluated: plan.length,
            allotted_count: allotted.length,
            waitlisted_count: waitlisted.length,
          },
          plan,
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/allotment/publish
 * Executes sp_publish_cycle.
 * Snapshots results into ranking_snapshot, marks allotments is_published = 1,
 * advances cycle status to PUBLISHED, and fans out in-app notifications.
 * Restricted to HOSTEL_OFFICE and ADMIN.
 */
allotmentRouter.post(
  '/publish',
  requireAuth,
  requireRole(['HOSTEL_OFFICE', 'ADMIN']),
  validate(cycleIdSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cycle_id } = req.body;
      const userRole = (req.user?.role || 'HOSTEL_OFFICE') as Role;
      const userId = req.user?.userId;

      await withRequestConn(userRole, userId, async (conn) => {
        await conn.query('CALL sp_publish_cycle(?)', [cycle_id]);

        res.json({
          status: 'success',
          message: 'Allotment cycle results successfully locked and published.',
          cycle_id,
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/allotment/my-status
 * Returns current student's allotment status, allotted room and hostel details,
 * and deadline.
 */
allotmentRouter.get(
  '/my-status',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userRole = (req.user?.role || 'STUDENT') as Role;
      const userId = req.user?.userId;
      const cycleId = Number(req.query.cycle_id) || 1;
      const targetStudentId = req.query.student_id ? Number(req.query.student_id) : null;

      await withRequestConn(userRole, userId, async (conn) => {
        let studentId = targetStudentId;
        if (!studentId && userRole === 'STUDENT' && userId) {
          const [sRows] = await conn.query<any[]>(
            'SELECT student_id FROM students WHERE user_id = ?',
            [userId]
          );
          if (sRows.length > 0) studentId = sRows[0].student_id;
        }

        if (!studentId) {
          return res.status(400).json({
            error: { code: 'STUDENT_REQUIRED', message: 'Student identification required.' },
          });
        }

        // Fetch application
        const [appRows] = await conn.query<any[]>(
          `SELECT 
            a.application_id,
            a.cycle_id,
            a.status AS application_status,
            a.verification_status,
            a.applied_at,
            ac.status AS cycle_status,
            ac.response_deadline
           FROM applications a
           JOIN allotment_cycles ac ON a.cycle_id = ac.cycle_id
           WHERE a.student_id = ? AND a.cycle_id = ?`,
          [studentId, cycleId]
        );

        if (appRows.length === 0) {
          return res.json({
            has_application: false,
            application: null,
            allotment: null,
          });
        }

        const app = appRows[0];

        // Fetch allotment if exists
        const [allotRows] = await conn.query<any[]>(
          `SELECT 
            alt.allotment_id,
            alt.response_status,
            alt.allotted_on,
            alt.is_published,
            r.room_id,
            r.room_no,
            r.floor_no,
            r.capacity,
            r.study_habit_tag,
            h.hostel_id,
            h.hostel_name,
            h.gender_type
           FROM allotments alt
           JOIN rooms r ON alt.room_id = r.room_id
           JOIN hostels h ON r.hostel_id = h.hostel_id
           WHERE alt.student_id = ? AND alt.cycle_id = ?`,
          [studentId, cycleId]
        );

        res.json({
          has_application: true,
          application: app,
          allotment: allotRows.length > 0 ? allotRows[0] : null,
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/allotment/respond
 * Student submits ACCEPTED or DECLINED for their room allotment.
 * If declined, automatically promotes next waitlisted student with matching habit.
 * Restricted to STUDENT.
 */
allotmentRouter.post(
  '/respond',
  requireAuth,
  validate(respondSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cycle_id, response } = req.body;
      const userRole = (req.user?.role || 'STUDENT') as Role;
      const userId = req.user?.userId;
      const targetStudentId = req.body.student_id ? Number(req.body.student_id) : null;

      await withRequestConn(userRole, userId, async (conn) => {
        let studentId = targetStudentId;
        if (!studentId && userRole === 'STUDENT' && userId) {
          const [sRows] = await conn.query<any[]>(
            'SELECT student_id FROM students WHERE user_id = ?',
            [userId]
          );
          if (sRows.length > 0) studentId = sRows[0].student_id;
        }

        if (!studentId) {
          return res.status(400).json({
            error: { code: 'STUDENT_REQUIRED', message: 'Student ID required.' },
          });
        }

        await conn.query('CALL sp_respond_allotment(?, ?, ?)', [
          studentId,
          cycle_id,
          response,
        ]);

        res.json({
          status: 'success',
          message: `Allotment response '${response}' recorded successfully.`,
          response,
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/allotment/withdraw
 * Student withdraws their hostel application. Vacates bed if allotted and promotes waitlist.
 * Restricted to STUDENT and HOSTEL_OFFICE.
 */
allotmentRouter.post(
  '/withdraw',
  requireAuth,
  validate(withdrawSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cycle_id } = req.body;
      const userRole = (req.user?.role || 'STUDENT') as Role;
      const userId = req.user?.userId;
      const targetStudentId = req.body.student_id ? Number(req.body.student_id) : null;

      await withRequestConn(userRole, userId, async (conn) => {
        let studentId = targetStudentId;
        if (!studentId && userRole === 'STUDENT' && userId) {
          const [sRows] = await conn.query<any[]>(
            'SELECT student_id FROM students WHERE user_id = ?',
            [userId]
          );
          if (sRows.length > 0) studentId = sRows[0].student_id;
        }

        if (!studentId) {
          return res.status(400).json({
            error: { code: 'STUDENT_REQUIRED', message: 'Student ID required.' },
          });
        }

        await conn.query('CALL sp_withdraw_application(?, ?)', [
          studentId,
          cycle_id,
        ]);

        res.json({
          status: 'success',
          message: 'Application successfully withdrawn.',
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/allotment/list
 * Returns list of all bed allocations for the given cycle and optional hostel/status filter.
 * Accessible to ADMIN, HOSTEL_OFFICE, CHIEF_WARDEN, WARDEN.
 */
allotmentRouter.get(
  '/list',
  requireAuth,
  requireRole(['ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const cycleId = req.query.cycle_id ? Number(req.query.cycle_id) : 1;
      const hostelId = req.query.hostel_id ? Number(req.query.hostel_id) : null;
      const status = req.query.status ? String(req.query.status) : null;
      const search = req.query.search ? String(req.query.search).trim() : null;

      await withRequestConn(user.role as Role, user.userId, async (conn) => {
        let whereClauses: string[] = ['alt.cycle_id = ?'];
        const params: any[] = [cycleId];

        if (hostelId) {
          whereClauses.push('h.hostel_id = ?');
          params.push(hostelId);
        }

        if (status) {
          whereClauses.push('alt.response_status = ?');
          params.push(status);
        }

        if (search) {
          whereClauses.push('(s.roll_no LIKE ? OR s.full_name LIKE ? OR r.room_no LIKE ?)');
          params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const whereSql = whereClauses.join(' AND ');

        const [rows] = await conn.query<any[]>(
          `SELECT 
             alt.allotment_id,
             alt.application_id,
             alt.student_id,
             alt.cycle_id,
             alt.room_id,
             alt.response_status,
             alt.is_published,
             alt.allotted_on,
             s.roll_no,
             s.full_name,
             s.gender,
             s.branch,
             s.merit_rank,
             s.study_habit,
             r.room_no,
             r.floor_no,
             r.capacity,
             r.study_habit_tag,
             h.hostel_id,
             h.hostel_name,
             h.gender_type
           FROM allotments alt
           JOIN students s ON alt.student_id = s.student_id
           JOIN rooms r ON alt.room_id = r.room_id
           JOIN hostels h ON r.hostel_id = h.hostel_id
           WHERE ${whereSql}
           ORDER BY h.hostel_name ASC, r.floor_no ASC, r.room_no ASC, alt.allotted_on DESC`,
          params
        );

        // Calculate summary counts
        const counts = {
          total: rows.length,
          accepted: rows.filter((r: any) => r.response_status === 'ACCEPTED').length,
          awaiting: rows.filter((r: any) => r.response_status === 'AWAITING').length,
          declined: rows.filter((r: any) => r.response_status === 'DECLINED').length,
        };

        res.status(200).json({
          cycle_id: cycleId,
          counts,
          allotments: rows,
        });
      });
    } catch (err) {
      next(err);
    }
  }
);
