import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole, verifyCsrf } from '../middleware/auth.js';
import { withRequestConn, pool } from '../db.js';
import {
  generateMachineHmac,
  generateMachineQrPayload,
  verifyMachineQr,
} from '../utils/laundryQr.js';

export const laundryRouter = Router();

/**
 * GET /api/laundry/machines
 * Live floor-plan machine status grid.
 * Scoping: Students see only machines in their allotted hostel (from v_current_residence).
 * Authorities can inspect all or filter by ?hostel_id.
 */
laundryRouter.get(
  '/machines',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      let studentHostelId: number | null = null;
      let studentId: number | null = null;

      if (user.role === 'STUDENT') {
        const [residenceRows] = await pool.query<any[]>(
          `SELECT student_id, hostel_id, hostel_name 
           FROM v_current_residence 
           WHERE user_id = ? OR student_id = ? 
           LIMIT 1`,
          [user.userId, user.userId]
        );

        if (residenceRows.length > 0) {
          studentHostelId = residenceRows[0].hostel_id;
          studentId = residenceRows[0].student_id;
        } else {
          // Resident not currently allotted
          return res.json({
            hostel: null,
            machines: [],
            myActiveWash: null,
            message: 'You do not have an active hostel residence allotment.',
          });
        }
      }

      const requestedHostelId = req.query.hostel_id
        ? Number(req.query.hostel_id)
        : studentHostelId;

      let sql = `
        SELECT 
          machine_id,
          hostel_id,
          hostel_name,
          label,
          floor_no,
          status,
          current_student_id,
          current_student_roll_no,
          current_student_name,
          started_at,
          expected_end_at,
          seconds_remaining,
          minutes_remaining
        FROM v_machine_status
      `;
      const params: any[] = [];

      if (requestedHostelId) {
        sql += ` WHERE hostel_id = ?`;
        params.push(requestedHostelId);
      }

      sql += ` ORDER BY hostel_id ASC, floor_no ASC, label ASC`;

      const [machines] = await pool.query<any[]>(sql, params);

      // Enhance with QR signature & student ownership
      let myActiveWash: any = null;
      const enhancedMachines = machines.map((m) => {
        const isMyWash =
          user.role === 'STUDENT' &&
          studentId !== null &&
          Number(m.current_student_id) === Number(studentId);

        const machineObj = {
          ...m,
          isMyWash,
          qrPayload: generateMachineQrPayload(m.machine_id),
          signature: generateMachineHmac(m.machine_id),
        };

        if (isMyWash && m.status === 'OCCUPIED') {
          myActiveWash = machineObj;
        }

        return machineObj;
      });

      return res.json({
        hostelId: requestedHostelId,
        machines: enhancedMachines,
        myActiveWash,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/laundry/:id/qr
 * Returns HMAC payload and signature for rendering QR sticker on staff station.
 */
laundryRouter.get(
  '/:id/qr',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const machineId = Number(req.params.id);
      if (isNaN(machineId) || machineId <= 0) {
        return res.status(400).json({ error: 'BadRequest', message: 'Invalid machine ID.' });
      }

      const [rows] = await pool.query<any[]>(
        `SELECT machine_id, hostel_id, label, floor_no, status FROM washing_machines WHERE machine_id = ?`,
        [machineId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'NotFound', message: 'Machine not found.' });
      }

      const m = rows[0];
      return res.json({
        machine_id: m.machine_id,
        label: m.label,
        hostel_id: m.hostel_id,
        floor_no: m.floor_no,
        status: m.status,
        signature: generateMachineHmac(m.machine_id),
        qrPayload: generateMachineQrPayload(m.machine_id),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/laundry/:id/start
 * Claims a free machine for a wash cycle.
 * Row-locked pessimistic transaction via sp_start_wash.
 * Verifies QR HMAC signature if provided.
 */
laundryRouter.post(
  '/:id/start',
  requireAuth,
  verifyCsrf,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const machineId = Number(req.params.id);
      if (isNaN(machineId) || machineId <= 0) {
        return res.status(400).json({ error: 'BadRequest', message: 'Invalid machine ID.' });
      }

      // 1. Verify QR HMAC signature if passed in payload
      const qrInput = req.body?.qr_payload || req.body?.signature || req.body?.qr_code;
      if (qrInput !== undefined && qrInput !== null && qrInput !== '') {
        const isValid = verifyMachineQr(machineId, String(qrInput));
        if (!isValid) {
          return res.status(400).json({
            error: 'InvalidQrSignature',
            message: 'QR verification failed: HMAC signature is invalid or forged for this machine.',
          });
        }
      }

      // 2. Execute transactional stored procedure with session injection
      await withRequestConn(req.user!.role, req.user!.userId, async (conn) => {
        await conn.query('CALL sp_start_wash(?)', [machineId]);
      });

      return res.status(200).json({
        success: true,
        message: 'Wash cycle started successfully.',
        machine_id: machineId,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/laundry/:id/finish
 * Early wash completion by the resident or maintenance release by caretaker.
 * Invokes sp_finish_wash.
 */
laundryRouter.post(
  '/:id/finish',
  requireAuth,
  verifyCsrf,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const machineId = Number(req.params.id);
      if (isNaN(machineId) || machineId <= 0) {
        return res.status(400).json({ error: 'BadRequest', message: 'Invalid machine ID.' });
      }

      await withRequestConn(req.user!.role, req.user!.userId, async (conn) => {
        await conn.query('CALL sp_finish_wash(?)', [machineId]);
      });

      return res.status(200).json({
        success: true,
        message: 'Wash cycle completed and machine released.',
        machine_id: machineId,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/laundry/:id/report
 * Resident reports machine issue (notifies the hostel caretaker).
 */
laundryRouter.post(
  '/:id/report',
  requireAuth,
  verifyCsrf,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const machineId = Number(req.params.id);
      if (isNaN(machineId) || machineId <= 0) {
        return res.status(400).json({ error: 'BadRequest', message: 'Invalid machine ID.' });
      }

      const issue = String(req.body?.issue || req.body?.description || 'Machine malfunction reported').trim();

      // 1. Fetch machine details
      const [machineRows] = await pool.query<any[]>(
        `SELECT wm.machine_id, wm.label, wm.floor_no, wm.hostel_id, h.hostel_name
         FROM washing_machines wm
         JOIN hostels h ON wm.hostel_id = h.hostel_id
         WHERE wm.machine_id = ?`,
        [machineId]
      );

      if (machineRows.length === 0) {
        return res.status(404).json({ error: 'NotFound', message: 'Machine not found.' });
      }

      const machine = machineRows[0];

      // 2. Identify caretaker(s) for the machine's hostel
      const [caretakers] = await pool.query<any[]>(
        `SELECT u.user_id 
         FROM authorities a 
         JOIN users u ON a.user_id = u.user_id 
         WHERE a.designation = 'CARETAKER' 
           AND (a.hostel_id = ? OR a.hostel_id IS NULL)`,
        [machine.hostel_id]
      );

      // Fallback to any caretaker if specific hostel caretaker is unassigned
      const targetUserIds: number[] = caretakers.map((c) => c.user_id);
      if (targetUserIds.length === 0) {
        const [fallbackUsers] = await pool.query<any[]>(
          `SELECT user_id FROM users WHERE role = 'CARETAKER'`
        );
        fallbackUsers.forEach((u) => targetUserIds.push(u.user_id));
      }

      // 3. Fan out in-app notification to caretakers
      const notifTitle = `Laundry Issue: Machine ${machine.label}`;
      const notifBody = `Reported in ${machine.hostel_name} (Floor ${machine.floor_no}): ${issue.substring(0, 450)}`;

      for (const uid of targetUserIds) {
        await pool.query(
          `INSERT INTO notifications (user_id, notif_type, title, body, link, is_read, created_at)
           VALUES (?, 'LAUNDRY_REPORT', ?, ?, '/laundry', 0, NOW())`,
          [uid, notifTitle, notifBody]
        );
      }

      // 4. Log in audit trail
      await pool.query(
        `INSERT INTO audit_log (actor_user_id, action, table_name, record_id, details, logged_at)
         VALUES (?, 'REPORT_ISSUE', 'washing_machines', ?, ?, NOW())`,
        [
          req.user!.userId,
          machineId,
          JSON.stringify({
            issue,
            machine_label: machine.label,
            hostel_id: machine.hostel_id,
          }),
        ]
      );

      return res.status(200).json({
        success: true,
        message: 'Maintenance issue reported to hostel caretaker.',
        machine_id: machineId,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/laundry/:id/status
 * Caretaker or Admin changes machine status between FREE and OUT_OF_ORDER.
 */
laundryRouter.patch(
  '/:id/status',
  requireAuth,
  verifyCsrf,
  requireRole(['CARETAKER', 'ADMIN']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const machineId = Number(req.params.id);
      if (isNaN(machineId) || machineId <= 0) {
        return res.status(400).json({ error: 'BadRequest', message: 'Invalid machine ID.' });
      }

      const { status } = req.body;
      if (!status || !['FREE', 'OUT_OF_ORDER'].includes(status)) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'Invalid status. Caretaker may only set status to FREE or OUT_OF_ORDER.',
        });
      }

      // Use connection to update machine state atomically
      await withRequestConn(req.user!.role, req.user!.userId, async (conn) => {
        // If machine was OCCUPIED, close open log row
        await conn.query(
          `UPDATE machine_usage_log
           SET ended_at = NOW(),
               end_reason = IF(? = 'FREE', 'FINISHED', 'AUTO_RELEASED')
           WHERE machine_id = ? AND ended_at IS NULL`,
          [status, machineId]
        );

        await conn.query(
          `UPDATE washing_machines
           SET status = ?,
               current_student_id = NULL,
               started_at = NULL,
               expected_end_at = NULL
           WHERE machine_id = ?`,
          [status, machineId]
        );
      });

      return res.status(200).json({
        success: true,
        message: `Machine status updated to ${status}.`,
        machine_id: machineId,
        status,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/laundry/history
 * TanStack-compatible paginated usage history with multi-column filtering.
 */
laundryRouter.get(
  '/history',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(5, Number(req.query.pageSize) || 10));
      const offset = (page - 1) * pageSize;

      const user = req.user!;
      let studentHostelId: number | null = null;
      let studentId: number | null = null;

      if (user.role === 'STUDENT') {
        const [residenceRows] = await pool.query<any[]>(
          `SELECT student_id, hostel_id FROM v_current_residence WHERE user_id = ? OR student_id = ? LIMIT 1`,
          [user.userId, user.userId]
        );
        if (residenceRows.length > 0) {
          studentHostelId = residenceRows[0].hostel_id;
          studentId = residenceRows[0].student_id;
        }
      }

      const conditions: string[] = ['1=1'];
      const params: any[] = [];

      // Student scoping: see their hostel
      if (user.role === 'STUDENT' && studentHostelId) {
        conditions.push('wm.hostel_id = ?');
        params.push(studentHostelId);
      } else if (req.query.hostel_id) {
        conditions.push('wm.hostel_id = ?');
        params.push(Number(req.query.hostel_id));
      }

      if (req.query.machine_id) {
        conditions.push('mul.machine_id = ?');
        params.push(Number(req.query.machine_id));
      }

      if (req.query.status) {
        if (req.query.status === 'ACTIVE') {
          conditions.push('mul.ended_at IS NULL');
        } else {
          conditions.push('mul.end_reason = ?');
          params.push(req.query.status);
        }
      }

      if (req.query.search) {
        conditions.push('(s.roll_no LIKE ? OR s.full_name LIKE ? OR wm.label LIKE ?)');
        const searchPattern = `%${String(req.query.search).trim()}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      const whereClause = conditions.join(' AND ');

      // Total count
      const [countRows] = await pool.query<any[]>(
        `SELECT COUNT(*) as total
         FROM machine_usage_log mul
         JOIN washing_machines wm ON mul.machine_id = wm.machine_id
         JOIN hostels h ON wm.hostel_id = h.hostel_id
         JOIN students s ON mul.student_id = s.student_id
         WHERE ${whereClause}`,
        params
      );
      const total = countRows[0]?.total || 0;

      // Data query
      const [rows] = await pool.query<any[]>(
        `SELECT 
          mul.log_id,
          mul.machine_id,
          wm.label AS machine_label,
          wm.hostel_id,
          h.hostel_name,
          wm.floor_no,
          mul.student_id,
          s.roll_no AS student_roll_no,
          s.full_name AS student_name,
          mul.started_at,
          mul.ended_at,
          mul.end_reason,
          TIMESTAMPDIFF(MINUTE, mul.started_at, COALESCE(mul.ended_at, NOW())) AS duration_minutes
         FROM machine_usage_log mul
         JOIN washing_machines wm ON mul.machine_id = wm.machine_id
         JOIN hostels h ON wm.hostel_id = h.hostel_id
         JOIN students s ON mul.student_id = s.student_id
         WHERE ${whereClause}
         ORDER BY mul.log_id DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );

      return res.json({
        items: rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (err) {
      next(err);
    }
  }
);
