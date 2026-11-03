import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { withRequestConn, pool, Role } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const studentsRouter = Router();

const WHITELISTED_SORT_COLUMNS = [
  'roll_no',
  'full_name',
  'merit_rank',
  'branch',
  'gender',
  'student_id',
] as const;

type SortColumn = typeof WHITELISTED_SORT_COLUMNS[number];

const studentFilterSchema = z.object({
  search: z.string().trim().optional(),
  gender: z.enum(['M', 'F']).optional(),
  branch: z.string().trim().optional(),
  schooling_state: z.string().trim().optional(),
  merit_min: z.coerce.number().int().positive().optional(),
  merit_max: z.coerce.number().int().positive().optional(),
  sort_by: z.enum(WHITELISTED_SORT_COLUMNS).default('roll_no'),
  sort_order: z.enum(['asc', 'desc']).default('asc'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

interface KeysetCursor {
  sortVal: any;
  id: number;
}

function encodeCursor(sortVal: any, id: number): string {
  return Buffer.from(JSON.stringify({ sortVal, id })).toString('base64');
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

/**
 * GET /api/students
 * Role-scoped student directory listing with server-side FULLTEXT search,
 * filters, whitelisted sort, and 50-row keyset pagination with total count.
 */
studentsRouter.get(
  '/',
  requireAuth,
  validate(studentFilterSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const q = req.query as unknown as z.infer<typeof studentFilterSchema>;

      const sortBy: SortColumn = q.sort_by;
      const sortOrder = q.sort_order.toUpperCase() as 'ASC' | 'DESC';
      const limit = q.limit;
      const cursor = q.cursor ? decodeCursor(q.cursor) : null;

      const whereClauses: string[] = ['1=1'];
      const params: any[] = [];

      // Server-side search: FULLTEXT on name or prefix on roll_no
      if (q.search && q.search.trim().length > 0) {
        const searchTerm = q.search.trim();
        const cleanFt = searchTerm.replace(/[^\w\s]/gi, '').trim();
        const ftTerm = cleanFt.length > 0 ? `${cleanFt}*` : searchTerm;
        whereClauses.push(
          '(roll_no LIKE CONCAT(?, \'%\') OR MATCH(full_name) AGAINST(? IN BOOLEAN MODE) OR full_name LIKE CONCAT(\'%\', ?, \'%\'))'
        );
        params.push(searchTerm, ftTerm, searchTerm);
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

      // Schooling state filter (Delhi vs Outside Delhi or specific state)
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

      // Merit range filters
      if (q.merit_min !== undefined) {
        whereClauses.push('merit_rank >= ?');
        params.push(q.merit_min);
      }
      if (q.merit_max !== undefined) {
        whereClauses.push('merit_rank <= ?');
        params.push(q.merit_max);
      }

      const baseWhereSql = whereClauses.join(' AND ');

      const data = await withRequestConn(user.role, user.userId, async (conn) => {
        // 1. Total count matching current filters
        const [countRows] = await conn.query<any[]>(
          `SELECT COUNT(*) AS total FROM v_scoped_students WHERE ${baseWhereSql}`,
          params
        );
        const total = Number(countRows[0]?.total || 0);

        // 2. Keyset pagination seek clause
        const pagedWhere = [...whereClauses];
        const pagedParams = [...params];

        if (cursor) {
          const comp = sortOrder === 'ASC' ? '>' : '<';
          if (sortBy === 'student_id') {
            pagedWhere.push(`student_id ${comp} ?`);
            pagedParams.push(cursor.id);
          } else {
            pagedWhere.push(
              `(${sortBy} ${comp} ? OR (${sortBy} = ? AND student_id ${comp} ?))`
            );
            pagedParams.push(cursor.sortVal, cursor.sortVal, cursor.id);
          }
        }

        const pagedWhereSql = pagedWhere.join(' AND ');
        const orderSql =
          sortBy === 'student_id'
            ? `student_id ${sortOrder}`
            : `${sortBy} ${sortOrder}, student_id ${sortOrder}`;

        // Fetch limit + 1 to determine if next page exists
        const [rows] = await conn.query<any[]>(
          `SELECT 
            student_id, user_id, roll_no, full_name, gender, branch, batch_year,
            merit_rank, schooling_state_id, schooling_state, schooling_state_code,
            home_city_id, home_city, home_latitude, home_longitude,
            home_state_id, home_state, home_state_code, is_delhi_candidate,
            study_habit, phone, email, hostel_id, hostel_name, room_id, room_no,
            floor_no, allotment_id, allotment_status
           FROM v_scoped_students
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
          nextCursor = encodeCursor(lastItem[sortBy], lastItem.student_id);
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

/**
 * GET /api/students/:id
 * Fetches a single student's complete record, residence info, and application history.
 */
studentsRouter.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = Number(req.params.id);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      return res.status(400).json({ error: 'BadRequest', message: 'Invalid student ID.' });
    }

    const user = req.user!;

    const result = await withRequestConn(user.role, user.userId, async (conn) => {
      // Fetch student from role-scoped view
      const [rows] = await conn.query<any[]>(
        `SELECT * FROM v_scoped_students WHERE student_id = ?`,
        [studentId]
      );

      if (!rows || rows.length === 0) {
        return null;
      }

      const student = rows[0];

      // Parse latitude & longitude to numbers if returned as strings
      if (student.home_latitude !== null && student.home_latitude !== undefined) {
        student.home_latitude = Number(student.home_latitude);
      }
      if (student.home_longitude !== null && student.home_longitude !== undefined) {
        student.home_longitude = Number(student.home_longitude);
      }

      // Check contact information authorization
      const canViewContact =
        ['ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN'].includes(user.role) ||
        (user.role === 'STUDENT' && student.user_id === user.userId);

      if (!canViewContact) {
        student.phone = null;
        student.email = null;
      }

      // Fetch student application history
      const [appRows] = await conn.query<any[]>(
        `SELECT 
          a.application_id, a.cycle_id, ac.academic_year, ac.status AS cycle_status,
          a.distance_km, a.distance_band, a.verification_status, a.status AS application_status,
          a.applied_at, a.verified_by, auth.full_name AS verified_by_name
         FROM applications a
         JOIN allotment_cycles ac ON a.cycle_id = ac.cycle_id
         LEFT JOIN authorities auth ON a.verified_by = auth.authority_id
         WHERE a.student_id = ?
         ORDER BY a.applied_at DESC`,
        [studentId]
      );

      // Fetch active roommates if allotted to a room
      let roommates: any[] = [];
      if (student.room_id) {
        const [roommateRows] = await conn.query<any[]>(
          `SELECT 
            cr.student_id, cr.roll_no, cr.full_name, cr.gender, 
            cr.study_habit, cr.response_status AS allotment_status
           FROM v_current_residence cr
           WHERE cr.room_id = ? AND cr.student_id != ?`,
          [student.room_id, studentId]
        );
        roommates = roommateRows;
      }

      // Fetch mess refunds summary
      const [refundRows] = await conn.query<any[]>(
        `SELECT 
          refund_id, month, year, meals_scheduled, meals_eaten,
          refund_amount, status
         FROM mess_refunds
         WHERE student_id = ?
         ORDER BY year DESC, month DESC`,
        [studentId]
      );
      const totalRefundAmount = refundRows.reduce((acc, r) => acc + Number(r.refund_amount || 0), 0);

      return {
        ...student,
        applications: appRows,
        roommates,
        mess_refunds: {
          total_refunds: refundRows.length,
          total_amount: totalRefundAmount,
          records: refundRows,
        },
      };
    });

    if (!result) {
      return res.status(404).json({
        error: 'NotFound',
        message: 'Student not found or access restricted.',
      });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

const updateStudentSchema = z.object({
  phone: z.string().max(15).optional(),
  email: z.string().email().max(120).optional(),
  study_habit: z.enum(['DAY', 'NIGHT']).optional(),
  home_city_id: z.number().int().positive().optional(),
  schooling_state_id: z.number().int().positive().optional(),
});

/**
 * PATCH /api/students/:id
 * Updates student contact information, home city/state, or study habit.
 * If study_habit is modified after an application is filed, trigger trg_students_before_update
 * rejects the mutation with SQLSTATE 45000 (mapped to 422).
 */
studentsRouter.patch(
  '/:id',
  requireAuth,
  validate(updateStudentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentId = Number(req.params.id);
      if (!Number.isInteger(studentId) || studentId <= 0) {
        return res.status(400).json({ error: 'BadRequest', message: 'Invalid student ID.' });
      }

      const user = req.user!;
      const body = req.body;

      // Ensure student can only update their own record, unless HOSTEL_OFFICE or ADMIN
      if (user.role === 'STUDENT') {
        const [sRows] = await pool.query<any[]>(
          'SELECT student_id FROM students WHERE user_id = ?',
          [user.userId]
        );
        if (!sRows || sRows.length === 0 || sRows[0].student_id !== studentId) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Students are only permitted to update their own profile.',
          });
        }
      } else if (!['ADMIN', 'HOSTEL_OFFICE'].includes(user.role)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient privileges to update student profile.',
        });
      }

      const updates: string[] = [];
      const params: any[] = [];

      if (body.phone !== undefined) {
        updates.push('phone = ?');
        params.push(body.phone);
      }
      if (body.email !== undefined) {
        updates.push('email = ?');
        params.push(body.email);
      }
      if (body.study_habit !== undefined) {
        updates.push('study_habit = ?');
        params.push(body.study_habit);
      }
      if (body.home_city_id !== undefined) {
        updates.push('home_city_id = ?');
        params.push(body.home_city_id);
      }
      if (body.schooling_state_id !== undefined) {
        updates.push('schooling_state_id = ?');
        params.push(body.schooling_state_id);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: 'BadRequest',
          message: 'No updatable fields provided.',
        });
      }

      params.push(studentId);

      await withRequestConn(user.role, user.userId, async (conn) => {
        await conn.query(
          `UPDATE students SET ${updates.join(', ')} WHERE student_id = ?`,
          params
        );
      });

      // Return updated profile
      const [updatedRows] = await pool.query<any[]>(
        'SELECT * FROM v_scoped_students WHERE student_id = ?',
        [studentId]
      );

      res.json({
        message: 'Student profile updated successfully.',
        student: updatedRows[0],
      });
    } catch (err) {
      next(err);
    }
  }
);
