import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { withRequestConn, pool, Role } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const poolRouter = Router();

const poolFilterSchema = z.object({
  cycle_id: z.coerce.number().int().positive().default(1),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  gender: z.enum(['M', 'F']).optional(),
  habit: z.enum(['DAY', 'NIGHT']).optional(),
  status: z.enum(['PENDING', 'ALLOTTED', 'WAITLISTED', 'WITHDRAWN']).optional(),
  priority: z.enum(['DELHI', 'NON_DELHI']).optional(),
  search: z.string().trim().optional(),
  sortField: z.enum(['rank_no', 'band', 'status']).default('rank_no'),
  sortOrder: z.enum(['asc', 'desc', 'ASC', 'DESC']).default('asc'),
});

/**
 * GET /api/pool
 * Public applicant pool with server-side pagination, sorting, and filtering.
 * Strictly hides names, phone, and email.
 */
poolRouter.get(
  '/',
  requireAuth,
  validate(poolFilterSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as unknown as z.infer<typeof poolFilterSchema>;
      const userRole = (req.user?.role || 'STUDENT') as Role;
      const userId = req.user?.userId;

      await withRequestConn(userRole, userId, async (conn) => {
        // Resolve student_id if user is a student
        let myStudentId: number | null = null;
        if (userRole === 'STUDENT' && userId) {
          const [sRows] = await conn.query<any[]>(
            'SELECT student_id FROM students WHERE user_id = ?',
            [userId]
          );
          if (sRows.length > 0) {
            myStudentId = sRows[0].student_id;
          }
        }

        const where: string[] = ['cycle_id = ?'];
        const params: any[] = [q.cycle_id];

        if (q.gender) {
          where.push('gender = ?');
          params.push(q.gender);
        }

        if (q.habit) {
          where.push('study_habit = ?');
          params.push(q.habit);
        }

        if (q.status) {
          where.push('status = ?');
          params.push(q.status);
        }

        if (q.priority) {
          where.push('priority_group = ?');
          params.push(q.priority);
        }

        if (q.search) {
          // Allow searching masked roll number or rank
          if (/^\d+$/.test(q.search)) {
            where.push('rank_no = ?');
            params.push(parseInt(q.search, 10));
          } else {
            where.push('masked_roll_no LIKE CONCAT(?, \'%\')');
            params.push(q.search);
          }
        }

        const whereSql = where.join(' AND ');

        // Fast count for pagination: query base tables directly when rank_no is not filtered
        let total = 0;
        if (!q.search || !/^\d+$/.test(q.search)) {
          const countWhere: string[] = ['a.cycle_id = ?', "a.verification_status = 'VERIFIED'"];
          const countParams: any[] = [q.cycle_id];
          if (q.gender) { countWhere.push('s.gender = ?'); countParams.push(q.gender); }
          if (q.habit) { countWhere.push('s.study_habit = ?'); countParams.push(q.habit); }
          if (q.status) { countWhere.push('a.status = ?'); countParams.push(q.status); }
          if (q.priority) {
            countWhere.push(q.priority === 'DELHI' ? 's.is_delhi_candidate = 1' : 's.is_delhi_candidate = 0');
          }
          if (q.search) {
            countWhere.push('s.roll_no LIKE CONCAT(?, \'%\')');
            countParams.push(q.search);
          }
          const [cntRows] = await conn.query<any[]>(
            `SELECT COUNT(*) as total FROM applications a JOIN students s ON a.student_id = s.student_id WHERE ${countWhere.join(' AND ')}`,
            countParams
          );
          total = Number(cntRows[0]?.total || 0);
        } else {
          const [cntRows] = await conn.query<any[]>(
            `SELECT COUNT(*) as total FROM v_public_applicant_pool WHERE ${whereSql}`,
            params
          );
          total = Number(cntRows[0]?.total || 0);
        }

        // Sorting
        const sortCol = q.sortField === 'band' ? 'band' : q.sortField === 'status' ? 'status' : 'rank_no';
        const sortDir = q.sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        const offset = (q.page - 1) * q.pageSize;

        const [rows] = await conn.query<any[]>(
          `SELECT 
            cycle_id,
            application_id,
            student_id,
            gender,
            masked_roll_no,
            rank_no,
            priority_group,
            band,
            study_habit,
            status,
            cutoff_rank,
            allocation_status
           FROM v_public_applicant_pool
           WHERE ${whereSql}
           ORDER BY ${sortCol} ${sortDir}, rank_no ASC
           LIMIT ? OFFSET ?`,
          [...params, q.pageSize, offset]
        );

        // Compute cutoffs for boys and girls in this cycle
        const [cutoffRows] = await conn.query<any[]>(
          `SELECT gender, cutoff_rank FROM v_public_applicant_pool WHERE cycle_id = ? GROUP BY gender, cutoff_rank`,
          [q.cycle_id]
        );

        const cutoffMap: Record<string, number> = { M: 0, F: 0 };
        for (const c of cutoffRows) {
          cutoffMap[c.gender] = Number(c.cutoff_rank);
        }

        const data = rows.map((r) => ({
          application_id: r.application_id,
          cycle_id: r.cycle_id,
          gender: r.gender,
          masked_roll_no: r.masked_roll_no,
          rank_no: r.rank_no,
          priority_group: r.priority_group,
          band: r.band,
          study_habit: r.study_habit,
          status: r.status,
          allocation_status: r.allocation_status,
          cutoff_rank: r.cutoff_rank,
          is_me: myStudentId !== null && r.student_id === myStudentId,
        }));

        res.json({
          data,
          pagination: {
            page: q.page,
            pageSize: q.pageSize,
            total,
            totalPages: Math.ceil(total / q.pageSize),
          },
          cutoff: cutoffMap,
          viewerStudentId: myStudentId,
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/pool/me/explain
 * Returns detailed explanation of applicant's rank walking through the 4 sort keys
 * and exact count of applicants sitting above on each key.
 */
poolRouter.get(
  '/me/explain',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userRole = (req.user?.role || 'STUDENT') as Role;
      const userId = req.user?.userId;
      const cycleId = Number(req.query.cycle_id) || 1;
      const targetStudentId = req.query.student_id ? Number(req.query.student_id) : null;

      await withRequestConn(userRole, userId, async (conn) => {
        // Resolve student
        let studentId = targetStudentId;
        if (!studentId && userRole === 'STUDENT' && userId) {
          const [sRows] = await conn.query<any[]>(
            'SELECT student_id FROM students WHERE user_id = ?',
            [userId]
          );
          if (sRows.length > 0) {
            studentId = sRows[0].student_id;
          }
        }

        if (!studentId) {
          return res.status(400).json({
            error: {
              code: 'STUDENT_REQUIRED',
              message: 'Must be authenticated as a student or provide student_id query parameter.',
            },
          });
        }

        // Fetch student ranked data
        const [appRows] = await conn.query<any[]>(
          `SELECT 
            ra.application_id,
            ra.cycle_id,
            ra.student_id,
            ra.roll_no,
            ra.gender,
            ra.rank_no,
            ra.is_delhi_candidate,
            ra.distance_km,
            ra.distance_band,
            ra.merit_rank,
            ra.applied_at,
            ra.study_habit,
            ra.application_status
           FROM v_ranked_applicants ra
           WHERE ra.student_id = ? AND ra.cycle_id = ?`,
          [studentId, cycleId]
        );

        if (appRows.length === 0) {
          return res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message: 'Verified application not found for this student in the specified cycle.',
            },
          });
        }

        const me = appRows[0];

        // 1. Key 1: Non-Delhi Priority
        // Candidates of same gender with is_delhi_candidate < me.is_delhi_candidate
        const [aboveKey1Rows] = await conn.query<any[]>(
          `SELECT COUNT(*) as count 
           FROM v_ranked_applicants 
           WHERE cycle_id = ? AND gender = ? AND is_delhi_candidate < ?`,
          [cycleId, me.gender, me.is_delhi_candidate]
        );
        const aboveNonDelhi = aboveKey1Rows[0]?.count || 0;

        // 2. Key 2: Distance Band (higher band is better)
        // Candidates with same is_delhi_candidate, but distance_band > me.distance_band
        const [aboveKey2Rows] = await conn.query<any[]>(
          `SELECT COUNT(*) as count 
           FROM v_ranked_applicants 
           WHERE cycle_id = ? AND gender = ? 
             AND is_delhi_candidate = ? 
             AND distance_band > ?`,
          [cycleId, me.gender, me.is_delhi_candidate, me.distance_band]
        );
        const aboveDistanceBand = aboveKey2Rows[0]?.count || 0;

        // 3. Key 3: Academic Merit Rank (lower number is better)
        // Candidates with same is_delhi_candidate, same distance_band, but merit_rank < me.merit_rank
        const [aboveKey3Rows] = await conn.query<any[]>(
          `SELECT COUNT(*) as count 
           FROM v_ranked_applicants 
           WHERE cycle_id = ? AND gender = ? 
             AND is_delhi_candidate = ? 
             AND distance_band = ? 
             AND merit_rank < ?`,
          [cycleId, me.gender, me.is_delhi_candidate, me.distance_band, me.merit_rank]
        );
        const aboveMeritRank = aboveKey3Rows[0]?.count || 0;

        // 4. Key 4: Earliest Submission Timestamp
        // Candidates with same priority, same band, same merit, but applied_at < me.applied_at
        const [aboveKey4Rows] = await conn.query<any[]>(
          `SELECT COUNT(*) as count 
           FROM v_ranked_applicants 
           WHERE cycle_id = ? AND gender = ? 
             AND is_delhi_candidate = ? 
             AND distance_band = ? 
             AND merit_rank = ? 
             AND applied_at < ?`,
          [cycleId, me.gender, me.is_delhi_candidate, me.distance_band, me.merit_rank, me.applied_at]
        );
        const aboveAppliedAt = aboveKey4Rows[0]?.count || 0;

        // Fetch cutoff for student's gender
        const [cutoffRows] = await conn.query<any[]>(
          `SELECT cutoff_rank FROM v_public_applicant_pool WHERE cycle_id = ? AND gender = ? LIMIT 1`,
          [cycleId, me.gender]
        );
        const cutoffRank = cutoffRows[0]?.cutoff_rank || 0;

        res.json({
          student: {
            student_id: me.student_id,
            masked_roll_no: `${me.roll_no.substring(0, 7)}***`,
            gender: me.gender,
            rank_no: me.rank_no,
            study_habit: me.study_habit,
            application_status: me.application_status,
            cutoff_rank: cutoffRank,
            within_cutoff: me.rank_no <= cutoffRank,
          },
          explanation: {
            total_above: me.rank_no - 1,
            keys: [
              {
                step: 1,
                name: 'Priority Group (Schooling State)',
                user_value: me.is_delhi_candidate === 1 ? 'Delhi Candidate (Priority 2)' : 'Non-Delhi Candidate (Priority 1)',
                is_top_tier: me.is_delhi_candidate === 0,
                above_count: aboveNonDelhi,
                rule: 'Non-Delhi candidates (outside Delhi schooling) have absolute priority over Delhi candidates.',
              },
              {
                step: 2,
                name: 'Distance Band',
                user_value: `Band ${me.distance_band} (${me.distance_km} km)`,
                above_count: aboveDistanceBand,
                rule: 'Applicants from farther distance bands (Band 4 > 3 > 2 > 1) are given priority within their category.',
              },
              {
                step: 3,
                name: 'Academic Merit Rank',
                user_value: `Rank ${me.merit_rank}`,
                above_count: aboveMeritRank,
                rule: 'Better entrance merit rank (lower rank number) breaks ties within the same distance band.',
              },
              {
                step: 4,
                name: 'Application Submission Timestamp',
                user_value: me.applied_at,
                above_count: aboveAppliedAt,
                rule: 'Earliest application timestamp is the final deterministic tie-breaker.',
              },
            ],
          },
        });
      });
    } catch (err) {
      next(err);
    }
  }
);
