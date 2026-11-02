import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { withRequestConn } from '../db.js';
import { requireAuth, requireRole, verifyCsrf } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const maintenanceRouter = Router();

const createMaintenanceSchema = z.object({
  hostel_id: z.number().int().positive(),
  maint_type: z.enum(['MOSQUITO_SPRAY', 'ELECTRICIAN', 'PLUMBER', 'TANK_CLEANING', 'PEST_CONTROL']),
  block: z.string().max(10).optional().nullable(),
  floor_no: z.number().int().min(0).max(10).optional().nullable(),
  sched_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in YYYY-MM-DD format'),
  time_slot: z.string().max(20).optional().nullable(),
});

const updateMaintenanceSchema = z.object({
  status: z.enum(['SCHEDULED', 'DONE', 'CANCELLED']),
});

/**
 * GET /api/maintenance
 * Week view and filtered schedules list.
 * Scoped by residence for STUDENT role.
 */
maintenanceRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const hostelParam = req.query.hostel_id ? parseInt(req.query.hostel_id as string, 10) : undefined;
    const block = typeof req.query.block === 'string' && req.query.block ? req.query.block : undefined;
    const weekStart = typeof req.query.week_start === 'string' && req.query.week_start ? req.query.week_start : undefined;

    const result = await withRequestConn(user.role, user.userId, async (conn) => {
      let studentHostelId: number | null = null;
      if (user.role === 'STUDENT') {
        const [resRows] = await conn.query<any[]>(
          'SELECT hostel_id FROM v_current_residence WHERE user_id = ? LIMIT 1',
          [user.userId]
        );
        studentHostelId = resRows[0]?.hostel_id || null;
      }

      const whereClauses: string[] = ['1=1'];
      const params: any[] = [];

      if (user.role === 'STUDENT') {
        if (studentHostelId) {
          whereClauses.push('m.hostel_id = ?');
          params.push(studentHostelId);
        } else {
          whereClauses.push('1=0');
        }
      } else if (hostelParam) {
        whereClauses.push('m.hostel_id = ?');
        params.push(hostelParam);
      }

      if (block) {
        whereClauses.push('m.block = ?');
        params.push(block);
      }

      if (weekStart) {
        whereClauses.push('m.sched_date >= ? AND m.sched_date <= DATE_ADD(?, INTERVAL 6 DAY)');
        params.push(weekStart, weekStart);
      }

      const whereSql = whereClauses.join(' AND ');

      const [rows] = await conn.query<any[]>(
        `SELECT m.schedule_id, m.hostel_id, h.hostel_name, m.maint_type,
                m.block, m.floor_no, 
                DATE_FORMAT(m.sched_date, '%Y-%m-%d') AS sched_date,
                m.time_slot, m.status, auth.full_name AS posted_by_name
         FROM maintenance_schedules m
         JOIN hostels h ON m.hostel_id = h.hostel_id
         LEFT JOIN authorities auth ON m.posted_by = auth.authority_id
         WHERE ${whereSql}
         ORDER BY m.sched_date ASC, m.schedule_id ASC`,
        params
      );

      return { schedules: rows };
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/maintenance
 * Roles: ADMIN, HOSTEL_OFFICE, CHIEF_WARDEN, WARDEN, CARETAKER
 * Caretaker posts maintenance only. Student rejected with 403 Forbidden.
 */
maintenanceRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'CARETAKER'),
  verifyCsrf,
  validate(createMaintenanceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { hostel_id, maint_type, block, floor_no, sched_date, time_slot } = req.body;

      const result = await withRequestConn(user.role, user.userId, async (conn) => {
        const [authRows] = await conn.query<any[]>(
          'SELECT authority_id FROM authorities WHERE user_id = ?',
          [user.userId]
        );
        const authorityId = authRows[0]?.authority_id || 1;

        const [insertResult] = await conn.query<any>(
          `INSERT INTO maintenance_schedules (hostel_id, maint_type, block, floor_no, sched_date, time_slot, status, posted_by)
           VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED', ?)`,
          [hostel_id, maint_type, block || null, floor_no ?? null, sched_date, time_slot || null, authorityId]
        );

        return { scheduleId: insertResult.insertId };
      });

      return res.status(201).json({
        message: 'Maintenance schedule created successfully.',
        scheduleId: result.scheduleId,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/maintenance/:id
 * Roles: ADMIN, HOSTEL_OFFICE, CHIEF_WARDEN, WARDEN, CARETAKER
 * Updates status (SCHEDULED, DONE, CANCELLED).
 */
maintenanceRouter.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'CARETAKER'),
  verifyCsrf,
  validate(updateMaintenanceSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const scheduleId = parseInt(req.params.id, 10);
      const { status } = req.body;

      await withRequestConn(user.role, user.userId, async (conn) => {
        const [updateResult] = await conn.query<any>(
          'UPDATE maintenance_schedules SET status = ? WHERE schedule_id = ?',
          [status, scheduleId]
        );

        if (updateResult.affectedRows === 0) {
          const err: any = new Error('Maintenance schedule not found.');
          err.statusCode = 404;
          throw err;
        }
      });

      return res.status(200).json({
        message: 'Maintenance status updated successfully.',
        scheduleId,
        status,
      });
    } catch (err) {
      next(err);
    }
  }
);
