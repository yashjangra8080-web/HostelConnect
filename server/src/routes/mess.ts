import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { withRequestConn, pool } from '../db.js';
import {
  generateMessQrToken,
  verifyMessQrToken,
  getWindowSecondsRemaining,
  get60sWindowIndex,
} from '../utils/messQr.js';

export const messRouter = Router();

// ============================================================================
// 1. GET /api/mess/counter
// Current meal plus rotating 60s HMAC token and live attendance counters
// ============================================================================
messRouter.get(
  '/counter',
  requireAuth,
  requireRole('MESS_MANAGER', 'ADMIN', 'WARDEN', 'CARETAKER', 'HOSTEL_OFFICE'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      let targetHostelId = req.query.hostel_id ? Number(req.query.hostel_id) : 1;

      // If user is a MESS_MANAGER or CARETAKER/WARDEN assigned to a specific hostel, default to their hostel
      if (!req.query.hostel_id) {
        const [authRows] = await pool.query<any[]>(
          'SELECT hostel_id FROM authorities WHERE user_id = ? LIMIT 1',
          [user.userId]
        );
        if (authRows.length > 0 && authRows[0].hostel_id) {
          targetHostelId = authRows[0].hostel_id;
        }
      }

      await withRequestConn(user.role, user.userId, async (conn) => {
        // 1. Fetch hostel metadata
        const [hostelRows] = await conn.query<any[]>(
          'SELECT hostel_id, hostel_name FROM hostels WHERE hostel_id = ?',
          [targetHostelId]
        );
        const hostel = hostelRows[0] || { hostel_id: targetHostelId, hostel_name: 'Hostel' };

        // 2. Fetch today's 4 scheduled meals for this hostel
        const [todayMeals] = await conn.query<any[]>(
          `SELECT m.meal_id, m.meal_type_id, m.hostel_id, m.meal_date, m.menu, m.is_closed,
                  mt.type_name, mt.start_time, mt.end_time,
                  (SELECT COUNT(*) FROM mess_attendance ma WHERE ma.meal_id = m.meal_id) AS marked_count
           FROM meals m
           JOIN meal_types mt ON m.meal_type_id = mt.meal_type_id
           WHERE m.hostel_id = ? AND m.meal_date = CURDATE()
           ORDER BY mt.meal_type_id ASC`,
          [targetHostelId]
        );

        // 3. Find if any meal slot is currently active based on IST clock
        const [activeRows] = await conn.query<any[]>(
          `SELECT m.meal_id, m.meal_type_id, m.hostel_id, m.meal_date, m.menu, m.is_closed,
                  mt.type_name, mt.start_time, mt.end_time
           FROM meals m
           JOIN meal_types mt ON m.meal_type_id = mt.meal_type_id
           WHERE m.hostel_id = ? 
             AND m.meal_date = CURDATE()
             AND CURTIME() BETWEEN mt.start_time AND mt.end_time
           LIMIT 1`,
          [targetHostelId]
        );

        // 4. Fetch total active residents in this hostel
        const [resRows] = await conn.query<any[]>(
          'SELECT COUNT(DISTINCT student_id) AS total_residents FROM v_current_residence WHERE hostel_id = ?',
          [targetHostelId]
        );
        const totalResidents = Number(resRows[0]?.total_residents || 0);

        let selectedMeal = activeRows[0] || todayMeals[0] || null;
        const isActive = activeRows.length > 0;

        // If today has no meals generated yet, fallback to most recent or next meal
        if (!selectedMeal) {
          const [fallbackRows] = await conn.query<any[]>(
            `SELECT m.meal_id, m.meal_type_id, m.hostel_id, m.meal_date, m.menu, m.is_closed,
                    mt.type_name, mt.start_time, mt.end_time
             FROM meals m
             JOIN meal_types mt ON m.meal_type_id = mt.meal_type_id
             WHERE m.hostel_id = ?
             ORDER BY m.meal_date DESC, mt.meal_type_id DESC
             LIMIT 1`,
            [targetHostelId]
          );
          selectedMeal = fallbackRows[0] || null;
        }

        let token: string | null = null;
        let markedCount = 0;
        if (selectedMeal) {
          token = generateMessQrToken(selectedMeal.meal_id);
          const [countRows] = await conn.query<any[]>(
            'SELECT COUNT(*) AS cnt FROM mess_attendance WHERE meal_id = ?',
            [selectedMeal.meal_id]
          );
          markedCount = Number(countRows[0]?.cnt || 0);
        }

        const expiresIn = getWindowSecondsRemaining();
        const percentMarked = totalResidents > 0 ? Number(((markedCount / totalResidents) * 100).toFixed(1)) : 0;

        const [timeRows] = await conn.query<any[]>('SELECT CURTIME() AS cur_time, CURDATE() AS cur_date');

        // 14-day daily turnout trend for this hostel
        const [trendRows] = await conn.query<any[]>(
          `SELECT 
             DATE_FORMAT(m.meal_date, '%Y-%m-%d') AS date,
             COUNT(DISTINCT ma.att_id) AS attended,
             COUNT(DISTINCT CASE WHEN m.is_closed = 0 THEN m.meal_id END) * ? AS scheduled
           FROM meals m
           LEFT JOIN mess_attendance ma ON m.meal_id = ma.meal_id
           WHERE m.hostel_id = ? 
             AND m.meal_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 14 DAY) AND CURDATE()
           GROUP BY m.meal_date
           ORDER BY m.meal_date ASC`,
          [totalResidents, targetHostelId]
        );

        // Per-meal-type turnout rates over past 30 days
        const [rateRows] = await conn.query<any[]>(
          `SELECT 
             mt.meal_type_id,
             mt.type_name,
             COUNT(ma.att_id) AS attended,
             COUNT(DISTINCT m.meal_id) * ? AS scheduled
           FROM meals m
           JOIN meal_types mt ON m.meal_type_id = mt.meal_type_id
           LEFT JOIN mess_attendance ma ON m.meal_id = ma.meal_id
           WHERE m.hostel_id = ? 
             AND m.is_closed = 0
             AND m.meal_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND CURDATE()
           GROUP BY mt.meal_type_id, mt.type_name
           ORDER BY mt.meal_type_id ASC`,
          [totalResidents, targetHostelId]
        );

        return res.status(200).json({
          hostel,
          meal: selectedMeal,
          isActive,
          token,
          windowSeconds: 60,
          windowIndex: get60sWindowIndex(),
          expiresIn,
          markedCount,
          totalResidents,
          percentMarked,
          currentTimeIST: timeRows[0]?.cur_time,
          currentDateIST: timeRows[0]?.cur_date,
          todaySlots: todayMeals,
          fourteenDayTrend: trendRows,
          mealTypeRates: rateRows,
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// 2. POST /api/mess/mark
// Scanned rotating QR token submitted by a resident student
// ============================================================================
const markQrSchema = z.object({
  token: z.string().min(1, 'QR token is required'),
});

messRouter.post('/mark', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const parsed = markQrSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
    }

    const { token } = parsed.data;

    // Verify token format, 60s rotation window, and HMAC signature
    const verify = verifyMessQrToken(token);
    if (!verify.valid || !verify.mealId) {
      return res.status(400).json({
        error: 'Invalid or Expired QR Token',
        message: verify.error || 'The scanned QR code is invalid or has expired.',
      });
    }

    await withRequestConn(user.role, user.userId, async (conn) => {
      // Find the student record associated with the caller
      const [studentRows] = await conn.query<any[]>(
        'SELECT student_id, full_name, roll_no FROM students WHERE user_id = ? LIMIT 1',
        [user.userId]
      );

      if (studentRows.length === 0) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Only registered resident students can mark attendance via student QR.',
        });
      }

      const student = studentRows[0];

      // Invoke sp_mark_meal(student_id, meal_id, 'QR')
      await conn.query('CALL sp_mark_meal(?, ?, ?)', [student.student_id, verify.mealId, 'QR']);

      // Fetch meal metadata for confirmation display
      const [mealRows] = await conn.query<any[]>(
        `SELECT m.meal_id, m.meal_date, mt.type_name, mt.start_time, mt.end_time, h.hostel_name
         FROM meals m
         JOIN meal_types mt ON m.meal_type_id = mt.meal_type_id
         JOIN hostels h ON m.hostel_id = h.hostel_id
         WHERE m.meal_id = ?`,
        [verify.mealId]
      );

      return res.status(200).json({
        success: true,
        message: `Attendance marked successfully for ${mealRows[0]?.type_name || 'meal'}!`,
        student: { student_id: student.student_id, full_name: student.full_name, roll_no: student.roll_no },
        meal: mealRows[0] || { meal_id: verify.mealId },
        isPreviousWindow: verify.isPreviousWindow,
      });
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 3. POST /api/mess/mark-manual
// Mess Manager manual fallback search and entry at counter
// ============================================================================
const markManualSchema = z.object({
  student_id: z.number().int().positive(),
  meal_id: z.number().int().positive(),
});

messRouter.post(
  '/mark-manual',
  requireAuth,
  requireRole('MESS_MANAGER', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = markManualSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
      }

      const { student_id, meal_id } = parsed.data;

      await withRequestConn(user.role, user.userId, async (conn) => {
        // Execute sp_mark_meal(student_id, meal_id, 'COUNTER')
        await conn.query('CALL sp_mark_meal(?, ?, ?)', [student_id, meal_id, 'COUNTER']);

        // Fetch student and meal info for feedback response
        const [sRows] = await conn.query<any[]>(
          'SELECT student_id, full_name, roll_no FROM students WHERE student_id = ?',
          [student_id]
        );
        const [mRows] = await conn.query<any[]>(
          `SELECT m.meal_id, m.meal_date, mt.type_name, mt.start_time, mt.end_time, h.hostel_name
           FROM meals m
           JOIN meal_types mt ON m.meal_type_id = mt.meal_type_id
           JOIN hostels h ON m.hostel_id = h.hostel_id
           WHERE m.meal_id = ?`,
          [meal_id]
        );

        return res.status(200).json({
          success: true,
          message: `Manual counter attendance recorded for ${sRows[0]?.full_name || 'student'} (${sRows[0]?.roll_no || ''}).`,
          student: sRows[0],
          meal: mRows[0],
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// 4. GET /api/mess/me/month
// Student 30-day x 4-meal attendance matrix with per-slot tooltip details
// ============================================================================
messRouter.get('/me/month', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const month = req.query.month ? Number(req.query.month) : 10;
    const year = req.query.year ? Number(req.query.year) : 2026;

    await withRequestConn(user.role, user.userId, async (conn) => {
      // 1. Identify student and active residence
      let studentId = user.studentId;
      if (!studentId) {
        const [sRows] = await conn.query<any[]>(
          'SELECT student_id FROM students WHERE user_id = ? LIMIT 1',
          [user.userId]
        );
        studentId = sRows[0]?.student_id;
      }

      if (!studentId) {
        return res.status(404).json({ error: 'Not Found', message: 'Student profile not found.' });
      }

      const [resRows] = await conn.query<any[]>(
        'SELECT student_id, roll_no, full_name, hostel_id, hostel_name, room_no FROM v_current_residence WHERE student_id = ? LIMIT 1',
        [studentId]
      );

      const residence = resRows[0] || null;
      if (!residence) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Student does not currently have an active hostel residence allotment.',
        });
      }

      // 2. Fetch all meals and attendance status for the month
      const [mealRows] = await conn.query<any[]>(
        `SELECT 
           m.meal_id,
           DATE_FORMAT(m.meal_date, '%Y-%m-%d') AS meal_date,
           m.menu,
           m.is_closed,
           m.closure_reason,
           mt.meal_type_id,
           mt.type_name,
           mt.start_time,
           mt.end_time,
           ma.att_id,
           ma.marked_via,
           ma.marked_at,
           CASE 
             WHEN m.is_closed = 1 THEN 'CLOSED'
             WHEN ma.att_id IS NOT NULL THEN 'EATEN'
             WHEN m.meal_date > CURDATE() OR (m.meal_date = CURDATE() AND CURTIME() < mt.end_time) THEN 'NOT_YET_SERVED'
             ELSE 'MISSED'
           END AS status
         FROM meals m
         JOIN meal_types mt ON m.meal_type_id = mt.meal_type_id
         LEFT JOIN mess_attendance ma 
           ON ma.meal_id = m.meal_id 
          AND ma.student_id = ?
         WHERE m.hostel_id = ? 
           AND MONTH(m.meal_date) = ? 
           AND YEAR(m.meal_date) = ?
         ORDER BY m.meal_date ASC, mt.meal_type_id ASC`,
        [studentId, residence.hostel_id, month, year]
      );

      // 3. Compute summary counts, streak, per-meal meters, and weekly trends
      let scheduled = 0;
      let eaten = 0;
      let missed = 0;
      let closed = 0;
      let upcoming = 0;

      const mealTypeMeters: Record<number, { name: string; scheduled: number; eaten: number }> = {
        1: { name: 'Breakfast', scheduled: 0, eaten: 0 },
        2: { name: 'Lunch', scheduled: 0, eaten: 0 },
        3: { name: 'Snacks', scheduled: 0, eaten: 0 },
        4: { name: 'Dinner', scheduled: 0, eaten: 0 },
      };

      const weeklyCounts: Record<number, { scheduled: number; eaten: number }> = {
        1: { scheduled: 0, eaten: 0 },
        2: { scheduled: 0, eaten: 0 },
        3: { scheduled: 0, eaten: 0 },
        4: { scheduled: 0, eaten: 0 },
        5: { scheduled: 0, eaten: 0 },
      };

      for (const m of mealRows) {
        const d = Number(m.meal_date.split('-')[2]);
        const w = d <= 7 ? 1 : d <= 14 ? 2 : d <= 21 ? 3 : d <= 28 ? 4 : 5;

        if (m.is_closed === 1) {
          closed++;
        } else if (m.status === 'NOT_YET_SERVED') {
          upcoming++;
        } else {
          scheduled++;
          if (mealTypeMeters[m.meal_type_id]) {
            mealTypeMeters[m.meal_type_id].scheduled++;
          }
          weeklyCounts[w].scheduled++;

          if (m.status === 'EATEN') {
            eaten++;
            if (mealTypeMeters[m.meal_type_id]) {
              mealTypeMeters[m.meal_type_id].eaten++;
            }
            weeklyCounts[w].eaten++;
          } else {
            missed++;
          }
        }
      }

      // Compute streak: consecutive eaten meals ending at latest served meal
      let streak = 0;
      const servedMeals = mealRows.filter((m) => m.is_closed === 0 && m.status !== 'NOT_YET_SERVED');
      for (let i = servedMeals.length - 1; i >= 0; i--) {
        if (servedMeals[i].status === 'EATEN') {
          streak++;
        } else {
          break;
        }
      }

      const weeklyTrend = Object.entries(weeklyCounts).map(([week, counts]) => ({
        week: Number(week),
        label: `W${week}`,
        attendancePct: counts.scheduled > 0 ? Number(((counts.eaten / counts.scheduled) * 100).toFixed(0)) : 0,
        eaten: counts.eaten,
        scheduled: counts.scheduled,
      }));

      return res.status(200).json({
        student: residence,
        month,
        year,
        summary: {
          total_slots: mealRows.length,
          scheduled,
          eaten,
          missed,
          closed,
          upcoming,
          streak,
          attendance_pct: scheduled > 0 ? Number(((eaten / scheduled) * 100).toFixed(1)) : 0,
          mealTypeMeters,
          weeklyTrend,
        },
        meals: mealRows,
      });
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 5. GET /api/mess/me/projection
// Attendance-based refund formula projection compared to historical flat refund
// ============================================================================
messRouter.get('/me/projection', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const month = req.query.month ? Number(req.query.month) : 10;
    const year = req.query.year ? Number(req.query.year) : 2026;

    await withRequestConn(user.role, user.userId, async (conn) => {
      let studentId = user.studentId;
      if (!studentId) {
        const [sRows] = await conn.query<any[]>(
          'SELECT student_id FROM students WHERE user_id = ? LIMIT 1',
          [user.userId]
        );
        studentId = sRows[0]?.student_id;
      }

      if (!studentId) {
        return res.status(404).json({ error: 'Not Found', message: 'Student profile not found.' });
      }

      // Check current residence
      const [resRows] = await conn.query<any[]>(
        'SELECT student_id, roll_no, full_name, hostel_id, hostel_name FROM v_current_residence WHERE student_id = ? LIMIT 1',
        [studentId]
      );
      const student = resRows[0];
      if (!student) {
        return res.status(404).json({ error: 'Not Found', message: 'No active residence allotment found.' });
      }

      // Read mess_config for this hostel/month/year
      const [cfgRows] = await conn.query<any[]>(
        'SELECT monthly_fee, food_component, per_meal_refund_rate, free_skips, cap_pct FROM mess_config WHERE hostel_id = ? AND month = ? AND year = ?',
        [student.hostel_id, month, year]
      );
      const cfg = cfgRows[0] || {
        monthly_fee: 4500.0,
        food_component: 3600.0,
        per_meal_refund_rate: 40.0,
        free_skips: 15,
        cap_pct: 60.0,
      };

      // Read global flat refund setting and defaults from app_settings
      const [appRows] = await conn.query<any[]>(
        `SELECT setting_key, setting_value FROM app_settings 
         WHERE setting_key IN ('mess_flat_refund', 'mess_free_skips', 'mess_cap_pct')`
      );
      const appSettingsMap: Record<string, string> = {};
      for (const r of appRows) {
        appSettingsMap[r.setting_key] = r.setting_value;
      }

      const flatRefund = Number(appSettingsMap['mess_flat_refund'] || '1200.00');
      const freeSkips = cfg.free_skips ?? Number(appSettingsMap['mess_free_skips'] || 15);
      const capPct = Number(cfg.cap_pct ?? (appSettingsMap['mess_cap_pct'] || 60));

      // Scheduled meals from v_meal_counts
      const [countRows] = await conn.query<any[]>(
        'SELECT meals_scheduled, meals_closed FROM v_meal_counts WHERE hostel_id = ? AND month = ? AND year = ?',
        [student.hostel_id, month, year]
      );
      const scheduled = Number(countRows[0]?.meals_scheduled || 119);

      // Meals eaten via fn_meals_eaten
      const [eatenRows] = await conn.query<any[]>(
        'SELECT fn_meals_eaten(?, ?, ?) AS eaten',
        [studentId, month, year]
      );
      const eaten = Number(eatenRows[0]?.eaten || 0);

      // Check if refund has already been calculated / finalized in mess_refunds table
      const [refRow] = await conn.query<any[]>(
        'SELECT refund_amount, status, meals_scheduled, meals_eaten FROM mess_refunds WHERE student_id = ? AND month = ? AND year = ?',
        [studentId, month, year]
      );
      const existingRefund = refRow[0] || null;

      // Exact Formula:
      // eligible_missed = MAX(0, scheduled - eaten - free_skips)
      // refund = LEAST(food_component * cap_pct/100, eligible_missed * per_meal_rate)
      const eligibleMissed = Math.max(0, scheduled - eaten - freeSkips);
      const uncappedAmount = Number((eligibleMissed * Number(cfg.per_meal_refund_rate)).toFixed(2));
      const capAmount = Number((Number(cfg.food_component) * (capPct / 100)).toFixed(2));
      const attendanceRefund = Math.min(capAmount, uncappedAmount);

      const netBenefit = Number((attendanceRefund - flatRefund).toFixed(2));

      return res.status(200).json({
        student,
        month,
        year,
        scheduled,
        eaten,
        free_skips: freeSkips,
        eligible_missed: eligibleMissed,
        per_meal_rate: Number(cfg.per_meal_refund_rate),
        food_component: Number(cfg.food_component),
        cap_pct: capPct,
        cap_amount: capAmount,
        attendance_refund: attendanceRefund,
        flat_refund: flatRefund,
        difference: netBenefit,
        is_capped: uncappedAmount > capAmount,
        existing_refund: existingRefund,
        status: existingRefund?.status || 'PROJECTED',
      });
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 5B. GET /api/mess/me/ledger
// Multi-month summary table for student refund ledger:
// September (FINAL), October (PREVIEW), November (IN_PROGRESS live projection)
// ============================================================================
messRouter.get('/me/ledger', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    await withRequestConn(user.role, user.userId, async (conn) => {
      let studentId = user.studentId;
      if (!studentId) {
        const [sRows] = await conn.query<any[]>(
          'SELECT student_id FROM students WHERE user_id = ? LIMIT 1',
          [user.userId]
        );
        studentId = sRows[0]?.student_id;
      }

      if (!studentId) {
        return res.status(200).json({ isResident: false, student: null, ledger: [] });
      }

      const [resRows] = await conn.query<any[]>(
        'SELECT student_id, roll_no, full_name, hostel_id, hostel_name, room_no FROM v_current_residence WHERE student_id = ? LIMIT 1',
        [studentId]
      );
      const student = resRows[0];
      if (!student) {
        return res.status(200).json({ isResident: false, student: null, ledger: [] });
      }

      const [appRows] = await conn.query<any[]>(
        "SELECT setting_value FROM app_settings WHERE setting_key = 'mess_flat_refund' LIMIT 1"
      );
      const flatRefundBenchmark = Number(appRows[0]?.setting_value || 1200);

      const monthsToProcess = [
        { month: 9, year: 2026, name: 'September 2026' },
        { month: 10, year: 2026, name: 'October 2026' },
        { month: 11, year: 2026, name: 'November 2026' },
      ];

      const ledgerRecords: any[] = [];

      for (const mItem of monthsToProcess) {
        const [cfgRows] = await conn.query<any[]>(
          'SELECT monthly_fee, food_component, per_meal_refund_rate, free_skips, cap_pct FROM mess_config WHERE hostel_id = ? AND month = ? AND year = ?',
          [student.hostel_id, mItem.month, mItem.year]
        );
        const cfg = cfgRows[0] || {
          monthly_fee: 4500,
          food_component: 3600,
          per_meal_refund_rate: 28,
          free_skips: 8,
          cap_pct: 60,
        };

        const [refRows] = await conn.query<any[]>(
          'SELECT * FROM mess_refunds WHERE student_id = ? AND month = ? AND year = ?',
          [studentId, mItem.month, mItem.year]
        );
        const refRow = refRows[0];

        if (refRow) {
          const scheduled = Number(refRow.meals_scheduled);
          const eaten = Number(refRow.meals_eaten);
          const missed = scheduled - eaten;
          const freeSkips = Number(cfg.free_skips);
          const attendanceRefund = Number(refRow.refund_amount);
          const difference = attendanceRefund - flatRefundBenchmark;

          ledgerRecords.push({
            month: mItem.month,
            year: mItem.year,
            monthName: mItem.name,
            scheduled,
            eaten,
            missed,
            freeSkips,
            attendanceRefund,
            flatRefund: flatRefundBenchmark,
            difference,
            status: refRow.status as 'FINAL' | 'PREVIEW',
          });
        } else {
          const [cntRows] = await conn.query<any[]>(
            'SELECT COUNT(*) as scheduled FROM meals WHERE hostel_id = ? AND MONTH(meal_date) = ? AND YEAR(meal_date) = ? AND is_closed = 0',
            [student.hostel_id, mItem.month, mItem.year]
          );
          const scheduled = Number(cntRows[0]?.scheduled || 118);

          const [eatenRows] = await conn.query<any[]>(
            `SELECT COUNT(*) as eaten FROM mess_attendance ma
             JOIN meals m ON ma.meal_id = m.meal_id
             WHERE ma.student_id = ? AND MONTH(m.meal_date) = ? AND YEAR(m.meal_date) = ?`,
            [studentId, mItem.month, mItem.year]
          );
          const eaten = Number(eatenRows[0]?.eaten || 0);
          const missed = scheduled - eaten;
          const freeSkips = Number(cfg.free_skips);
          const eligibleMissed = Math.max(0, missed - freeSkips);
          const rate = Number(cfg.per_meal_refund_rate);
          const cap = (Number(cfg.food_component) * Number(cfg.cap_pct)) / 100;
          const attendanceRefund = Math.min(cap, eligibleMissed * rate);
          const difference = attendanceRefund - flatRefundBenchmark;

          ledgerRecords.push({
            month: mItem.month,
            year: mItem.year,
            monthName: mItem.name,
            scheduled,
            eaten,
            missed,
            freeSkips,
            attendanceRefund,
            flatRefund: flatRefundBenchmark,
            difference,
            status: 'IN_PROGRESS',
          });
        }
      }

      return res.status(200).json({
        isResident: true,
        student,
        flatRefundBenchmark,
        ledger: ledgerRecords,
      });
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 6. GET /api/mess/refunds
// Manager refund console list of residents with pagination, sorting & search
// ============================================================================
messRouter.get('/refunds', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const month = req.query.month ? Number(req.query.month) : 10;
    const year = req.query.year ? Number(req.query.year) : 2026;
    const hostelId = req.query.hostel_id ? Number(req.query.hostel_id) : 1;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(500, Math.max(10, Number(req.query.pageSize) || 50));
    const offset = (page - 1) * pageSize;

    await withRequestConn(user.role, user.userId, async (conn) => {
      // If caller is student, return their own refund entry
      if (user.role === 'STUDENT') {
        const [studentRows] = await conn.query<any[]>(
          `SELECT mr.*, s.roll_no, s.full_name, r.room_no, h.hostel_name
           FROM mess_refunds mr
           JOIN students s ON mr.student_id = s.student_id
           JOIN v_current_residence cr ON s.student_id = cr.student_id
           JOIN rooms r ON cr.room_id = r.room_id
           JOIN hostels h ON cr.hostel_id = h.hostel_id
           WHERE s.user_id = ? AND mr.month = ? AND mr.year = ?`,
          [user.userId, month, year]
        );
        return res.status(200).json({
          refunds: studentRows,
          total: studentRows.length,
          page: 1,
          pageSize: 1,
        });
      }

      // For authorities: query residents in the hostel with their refund state
      let whereClause = 'WHERE (cr.hostel_id = ?)';
      const queryParams: any[] = [hostelId];

      if (search) {
        whereClause += ' AND (s.roll_no LIKE ? OR s.full_name LIKE ? OR r.room_no LIKE ?)';
        queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      // Count total matching residents
      const [countResult] = await conn.query<any[]>(
        `SELECT COUNT(*) AS total
         FROM v_current_residence cr
         JOIN students s ON cr.student_id = s.student_id
         JOIN rooms r ON cr.room_id = r.room_id
         ${whereClause}`,
        queryParams
      );
      const total = Number(countResult[0]?.total || 0);

      // Fetch summary aggregation for this hostel/month
      const [sumResult] = await conn.query<any[]>(
        `SELECT 
           COUNT(mr.refund_id) AS total_calculated,
           COALESCE(SUM(mr.refund_amount), 0) AS total_amount,
           SUM(CASE WHEN mr.status = 'FINAL' THEN 1 ELSE 0 END) AS final_count,
           SUM(CASE WHEN mr.status = 'PREVIEW' THEN 1 ELSE 0 END) AS preview_count,
           SUM(CASE WHEN mr.refund_amount = 0 THEN 1 ELSE 0 END) AS bin_0,
           SUM(CASE WHEN mr.refund_amount > 0 AND mr.refund_amount <= 300 THEN 1 ELSE 0 END) AS bin_1_300,
           SUM(CASE WHEN mr.refund_amount > 300 AND mr.refund_amount <= 600 THEN 1 ELSE 0 END) AS bin_301_600,
           SUM(CASE WHEN mr.refund_amount > 600 AND mr.refund_amount <= 900 THEN 1 ELSE 0 END) AS bin_601_900,
           SUM(CASE WHEN mr.refund_amount > 900 AND mr.refund_amount <= 1200 THEN 1 ELSE 0 END) AS bin_901_1200,
           SUM(CASE WHEN mr.refund_amount > 1200 AND mr.refund_amount <= 1500 THEN 1 ELSE 0 END) AS bin_1201_1500,
           SUM(CASE WHEN mr.refund_amount > 1500 AND mr.refund_amount <= 1800 THEN 1 ELSE 0 END) AS bin_1501_1800,
           SUM(CASE WHEN mr.refund_amount > 1800 THEN 1 ELSE 0 END) AS bin_gt_1800
         FROM mess_refunds mr
         JOIN v_current_residence cr ON mr.student_id = cr.student_id
         WHERE cr.hostel_id = ? AND mr.month = ? AND mr.year = ?`,
        [hostelId, month, year]
      );
      const summary = sumResult[0] || {
        total_calculated: 0,
        total_amount: 0,
        final_count: 0,
        preview_count: 0,
        bin_0: 0,
        bin_1_300: 0,
        bin_301_600: 0,
        bin_601_900: 0,
        bin_901_1200: 0,
        bin_1201_1500: 0,
        bin_1501_1800: 0,
        bin_gt_1800: 0,
      };

      const histogram = [
        { label: '₹0', count: Number(summary.bin_0 || 0) },
        { label: '₹1 - ₹300', count: Number(summary.bin_1_300 || 0) },
        { label: '₹301 - ₹600', count: Number(summary.bin_301_600 || 0) },
        { label: '₹601 - ₹900', count: Number(summary.bin_601_900 || 0) },
        { label: '₹901 - ₹1200', count: Number(summary.bin_901_1200 || 0) },
        { label: '₹1201 - ₹1500', count: Number(summary.bin_1201_1500 || 0) },
        { label: '₹1501 - ₹1800', count: Number(summary.bin_1501_1800 || 0) },
        { label: '> ₹1800', count: Number(summary.bin_gt_1800 || 0) },
      ];

      const [configRows] = await conn.query<any[]>(
        `SELECT per_meal_refund_rate, free_skips, cap_pct, food_component, monthly_fee
         FROM mess_config
         WHERE hostel_id = ? AND month = ? AND year = ?`,
        [hostelId, month, year]
      );
      const config = configRows[0] || {
        per_meal_refund_rate: 28.00,
        free_skips: 8,
        cap_pct: 60,
        food_component: 3600.00,
        monthly_fee: 4500.00,
      };

      // Query resident refund table records
      const [rows] = await conn.query<any[]>(
        `SELECT 
           cr.student_id,
           s.roll_no,
           s.full_name,
           r.room_no,
           h.hostel_name,
           COALESCE(mr.meals_scheduled, (SELECT meals_scheduled FROM v_meal_counts WHERE hostel_id = cr.hostel_id AND month = ? AND year = ?), 119) AS meals_scheduled,
           COALESCE(mr.meals_eaten, fn_meals_eaten(cr.student_id, ?, ?)) AS meals_eaten,
           COALESCE(mc.free_skips, 15) AS free_skips,
           GREATEST(0, COALESCE(mr.meals_scheduled, 119) - COALESCE(mr.meals_eaten, fn_meals_eaten(cr.student_id, ?, ?)) - COALESCE(mc.free_skips, 15)) AS eligible_missed,
           COALESCE(mr.refund_amount, 0.00) AS refund_amount,
           COALESCE(mr.status, 'NOT_CALCULATED') AS status,
           mr.refund_id
         FROM v_current_residence cr
         JOIN students s ON cr.student_id = s.student_id
         JOIN rooms r ON cr.room_id = r.room_id
         JOIN hostels h ON cr.hostel_id = h.hostel_id
         LEFT JOIN mess_config mc ON mc.hostel_id = cr.hostel_id AND mc.month = ? AND mc.year = ?
         LEFT JOIN mess_refunds mr ON mr.student_id = cr.student_id AND mr.month = ? AND mr.year = ?
         ${whereClause}
         ORDER BY s.roll_no ASC
         LIMIT ? OFFSET ?`,
        [month, year, month, year, month, year, month, year, month, year, ...queryParams, pageSize, offset]
      );

      return res.status(200).json({
        hostel_id: hostelId,
        month,
        year,
        total,
        page,
        pageSize,
        summary: {
          total_residents: total,
          total_calculated: Number(summary.total_calculated),
          total_refund_amount: Number(summary.total_amount),
          final_count: Number(summary.final_count),
          preview_count: Number(summary.preview_count),
          status: summary.final_count > 0 ? 'FINAL' : summary.preview_count > 0 ? 'PREVIEW' : 'NOT_CALCULATED',
        },
        histogram,
        config,
        refunds: rows,
      });
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 7. POST /api/mess/refunds
// Triggers sp_calculate_refunds(hostel_id, month, year, mode)
// ============================================================================
const calculateRefundSchema = z.object({
  hostel_id: z.number().int().positive().nullable().optional(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2035),
  mode: z.enum(['PREVIEW', 'FINAL']),
});

messRouter.post(
  '/refunds',
  requireAuth,
  requireRole('MESS_MANAGER', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = calculateRefundSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
      }

      const { hostel_id, month, year, mode } = parsed.data;

      await withRequestConn(user.role, user.userId, async (conn) => {
        // Execute procedure: CALL sp_calculate_refunds(hostel_id, month, year, mode)
        await conn.query('CALL sp_calculate_refunds(?, ?, ?, ?)', [
          hostel_id || null,
          month,
          year,
          mode,
        ]);

        // Query summary results for confirmation
        const [sumResult] = await conn.query<any[]>(
          `SELECT 
             COUNT(mr.refund_id) AS total_residents,
             SUM(mr.refund_amount) AS total_amount,
             SUM(CASE WHEN mr.status = 'FINAL' THEN 1 ELSE 0 END) AS final_count
           FROM mess_refunds mr
           JOIN v_current_residence cr ON mr.student_id = cr.student_id
           WHERE (? IS NULL OR cr.hostel_id = ?) 
             AND mr.month = ? 
             AND mr.year = ?`,
          [hostel_id || null, hostel_id || null, month, year]
        );

        const summary = sumResult[0] || { total_residents: 0, total_amount: 0, final_count: 0 };

        return res.status(200).json({
          success: true,
          mode,
          message:
            mode === 'FINAL'
              ? `Refunds successfully finalized for ${summary.total_residents} residents. Immutable lock applied and notifications dispatched.`
              : `Preview refund calculation completed for ${summary.total_residents} residents.`,
          hostel_id,
          month,
          year,
          resident_count: Number(summary.total_residents),
          total_refund_amount: Number(summary.total_amount),
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// 8. GET & PUT /api/mess/config
// Monthly fee, food component, per-meal rate, free skips & caps
// ============================================================================
messRouter.get('/config', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const hostelId = req.query.hostel_id ? Number(req.query.hostel_id) : 1;
    const month = req.query.month ? Number(req.query.month) : 10;
    const year = req.query.year ? Number(req.query.year) : 2026;

    await withRequestConn(user.role, user.userId, async (conn) => {
      const [rows] = await conn.query<any[]>(
        'SELECT * FROM mess_config WHERE hostel_id = ? AND month = ? AND year = ?',
        [hostelId, month, year]
      );

      const [appRows] = await conn.query<any[]>(
        `SELECT setting_key, setting_value, description FROM app_settings 
         WHERE setting_key IN ('mess_flat_refund', 'mess_free_skips', 'mess_cap_pct')`
      );

      return res.status(200).json({
        config: rows[0] || null,
        app_settings: appRows,
        hostel_id: hostelId,
        month,
        year,
      });
    });
  } catch (err) {
    next(err);
  }
});

const putConfigSchema = z
  .object({
    hostel_id: z.number().int().positive(),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2020).max(2035),
    monthly_fee: z.number().positive(),
    food_component: z.number().positive(),
    per_meal_refund_rate: z.number().positive(),
    free_skips: z.number().int().min(0).max(100).default(15),
    cap_pct: z.number().min(0).max(100).default(60.0),
    flat_refund: z.number().min(0).optional(),
  })
  .refine((data) => data.food_component <= data.monthly_fee, {
    message: 'Food component cannot exceed monthly fee.',
    path: ['food_component'],
  });

messRouter.put(
  '/config',
  requireAuth,
  requireRole('MESS_MANAGER', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = putConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
      }

      const {
        hostel_id,
        month,
        year,
        monthly_fee,
        food_component,
        per_meal_refund_rate,
        free_skips,
        cap_pct,
        flat_refund,
      } = parsed.data;

      await withRequestConn(user.role, user.userId, async (conn) => {
        // Upsert mess_config
        await conn.query(
          `INSERT INTO mess_config (
             hostel_id, month, year, monthly_fee, food_component, per_meal_refund_rate, free_skips, cap_pct
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             monthly_fee = VALUES(monthly_fee),
             food_component = VALUES(food_component),
             per_meal_refund_rate = VALUES(per_meal_refund_rate),
             free_skips = VALUES(free_skips),
             cap_pct = VALUES(cap_pct)`,
          [
            hostel_id,
            month,
            year,
            monthly_fee,
            food_component,
            per_meal_refund_rate,
            free_skips,
            cap_pct,
          ]
        );

        if (flat_refund !== undefined) {
          await conn.query(
            `INSERT INTO app_settings (setting_key, setting_value, description)
             VALUES ('mess_flat_refund', ?, 'Historical benchmark flat refund sum per student (INR)')
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
            [String(flat_refund)]
          );
        }

        const [updatedRows] = await conn.query<any[]>(
          'SELECT * FROM mess_config WHERE hostel_id = ? AND month = ? AND year = ?',
          [hostel_id, month, year]
        );

        return res.status(200).json({
          success: true,
          message: 'Mess configuration successfully updated.',
          config: updatedRows[0],
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// 9. GET /api/mess/summary
// Renders high-level institutional mess summary from view v_mess_summary
// ============================================================================
messRouter.get(
  '/summary',
  requireAuth,
  requireRole('ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const hostelId = req.query.hostel_id ? Number(req.query.hostel_id) : null;
      const month = req.query.month ? Number(req.query.month) : 10;
      const year = req.query.year ? Number(req.query.year) : 2026;

      await withRequestConn(user.role, user.userId, async (conn) => {
        let sql = 'SELECT * FROM v_mess_summary WHERE month = ? AND year = ?';
        const params: any[] = [month, year];

        if (hostelId) {
          sql += ' AND hostel_id = ?';
          params.push(hostelId);
        }

        const [rows] = await conn.query<any[]>(sql, params);
        return res.status(200).json({ summaries: rows });
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// 10. POST /api/mess/generate-meals
// Generates 4 meals per day for a month via sp_generate_meals
// ============================================================================
const generateMealsSchema = z.object({
  hostel_id: z.number().int().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2035),
});

messRouter.post(
  '/generate-meals',
  requireAuth,
  requireRole('MESS_MANAGER', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = generateMealsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation Error', details: parsed.error.format() });
      }

      const { hostel_id, month, year } = parsed.data;

      await withRequestConn(user.role, user.userId, async (conn) => {
        await conn.query('CALL sp_generate_meals(?, ?, ?)', [hostel_id, month, year]);

        const [countRows] = await conn.query<any[]>(
          'SELECT meals_scheduled, meals_closed, total_slots FROM v_meal_counts WHERE hostel_id = ? AND month = ? AND year = ?',
          [hostel_id, month, year]
        );

        return res.status(200).json({
          success: true,
          message: `Meals generated successfully for Hostel ${hostel_id} for ${month}/${year}.`,
          counts: countRows[0] || null,
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// 11. GET /api/mess/timetable
// Returns weekly dining timetable & menu slots
// ============================================================================
messRouter.get(
  '/timetable',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const hostelId = req.query.hostel_id ? Number(req.query.hostel_id) : 1;

      await withRequestConn(user.role, user.userId, async (conn) => {
        // Query upcoming and recent meals
        const [rows] = await conn.query<any[]>(
          `SELECT 
             m.meal_id,
             m.meal_date,
             m.menu,
             m.is_closed,
             mt.meal_type_id,
             mt.type_name,
             mt.start_time,
             mt.end_time,
             h.hostel_id,
             h.hostel_name
           FROM meals m
           JOIN meal_types mt ON m.meal_type_id = mt.meal_type_id
           JOIN hostels h ON m.hostel_id = h.hostel_id
           WHERE m.hostel_id = ?
           ORDER BY m.meal_date ASC, mt.meal_type_id ASC
           LIMIT 100`,
          [hostelId]
        );

        // Fetch meal types metadata
        const [typeRows] = await conn.query<any[]>(
          'SELECT meal_type_id, type_name, start_time, end_time FROM meal_types ORDER BY meal_type_id ASC'
        );

        // Fetch hostels
        const [hostelRows] = await conn.query<any[]>(
          'SELECT hostel_id, hostel_name FROM hostels ORDER BY hostel_id ASC'
        );

        return res.status(200).json({
          hostel_id: hostelId,
          meal_types: typeRows,
          hostels: hostelRows,
          meals: rows,
        });
      });
    } catch (err) {
      next(err);
    }
  }
);
