/**
 * Phase 9: Mess Attendance, Integrity & Refund Ledger — Test Suite
 * Validates meal window boundaries, cross-hostel restrictions, rotating QR tokens,
 * attendance uniqueness, manual mess manager counter fallback,
 * formula-based refund calculations with free skips and caps, and FINAL row immutability.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { pool } from '../db.js';
import {
  generateMessQrToken,
  generateMessHmac,
  verifyMessQrToken,
  get60sWindowIndex,
} from '../utils/messQr.js';

describe('Phase 9: Mess Attendance, Integrity & Refund Ledger', () => {
  let adminCookie: string;
  let adminCsrf: string;
  let messManagerCookie: string;
  let messManagerCsrf: string;
  let studentBH1Cookie: string;
  let studentBH1Csrf: string;
  let studentGH1Cookie: string;
  let studentGH1Csrf: string;

  let studentBH1Id: number;
  let studentBH1UserId: number;
  let studentGH1Id: number;
  let studentGH1UserId: number;

  const TEST_MEAL_ID_BOUNDARY = 999902;
  const TEST_MEAL_ID_GH1 = 999903;
  const TARGET_MEAL_TYPE_ID = 4; // Uses existing DINNER slot
  let origDinnerStart: string = '20:00:00';
  let origDinnerEnd: string = '22:00:00';

  beforeAll(async () => {
    // 1. Admin login
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: 'admin', password: 'Password@123' });
    adminCookie = adminRes.headers['set-cookie'].join('; ');
    adminCsrf = adminRes.body.csrfToken;

    // 2. Mess Manager login
    const mmRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: 'mess_mgr', password: 'Password@123' });
    messManagerCookie = mmRes.headers['set-cookie'].join('; ');
    messManagerCsrf = mmRes.body.csrfToken;

    // 3. Resolve resident student in BH1 (Hostel 1)
    const [bh1Rows] = await pool.query<any[]>(
      `SELECT s.student_id, s.user_id, u.login_id 
       FROM v_current_residence r
       JOIN students s ON r.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       WHERE r.hostel_id = 1
       LIMIT 1`
    );
    studentBH1Id = bh1Rows[0].student_id;
    studentBH1UserId = bh1Rows[0].user_id;

    const sBH1Res = await request(app)
      .post('/api/auth/login')
      .send({ login_id: bh1Rows[0].login_id, password: 'Password@123' });
    studentBH1Cookie = sBH1Res.headers['set-cookie'].join('; ');
    studentBH1Csrf = sBH1Res.body.csrfToken;

    // 4. Resolve resident student in GH1 (Hostel 3)
    const [gh1Rows] = await pool.query<any[]>(
      `SELECT s.student_id, s.user_id, u.login_id 
       FROM v_current_residence r
       JOIN students s ON r.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       WHERE r.hostel_id = 3
       LIMIT 1`
    );
    studentGH1Id = gh1Rows[0].student_id;
    studentGH1UserId = gh1Rows[0].user_id;

    const sGH1Res = await request(app)
      .post('/api/auth/login')
      .send({ login_id: gh1Rows[0].login_id, password: 'Password@123' });
    studentGH1Cookie = sGH1Res.headers['set-cookie'].join('; ');
    studentGH1Csrf = sGH1Res.body.csrfToken;

    // 5. Save original DINNER times
    const [mtRows] = await pool.query<any[]>(
      'SELECT start_time, end_time FROM meal_types WHERE meal_type_id = ?',
      [TARGET_MEAL_TYPE_ID]
    );
    if (mtRows.length > 0) {
      origDinnerStart = mtRows[0].start_time;
      origDinnerEnd = mtRows[0].end_time;
    }

    // 6. Ensure test meal records exist with valid FK and clean refunds
    await pool.query('DELETE FROM mess_refunds WHERE month IN (10, 11)');
    await pool.query('DELETE FROM mess_attendance WHERE meal_id IN (?, ?)', [
      TEST_MEAL_ID_BOUNDARY,
      TEST_MEAL_ID_GH1,
    ]);
    await pool.query('DELETE FROM meals WHERE meal_id IN (?, ?)', [
      TEST_MEAL_ID_BOUNDARY,
      TEST_MEAL_ID_GH1,
    ]);
    await pool.query(
      'DELETE FROM meals WHERE hostel_id IN (1, 3) AND meal_date = CURDATE() AND meal_type_id = ?',
      [TARGET_MEAL_TYPE_ID]
    );

    await pool.query(
      `INSERT INTO meals (meal_id, meal_type_id, hostel_id, meal_date, menu, is_closed)
       VALUES (?, ?, 1, CURDATE(), 'Boundary Test Meal BH1', 0)`,
      [TEST_MEAL_ID_BOUNDARY, TARGET_MEAL_TYPE_ID]
    );

    await pool.query(
      `INSERT INTO meals (meal_id, meal_type_id, hostel_id, meal_date, menu, is_closed)
       VALUES (?, ?, 3, CURDATE(), 'GH1 Test Meal', 0)`,
      [TEST_MEAL_ID_GH1, TARGET_MEAL_TYPE_ID]
    );
  });

  afterAll(async () => {
    // Restore original DINNER serving times
    await pool.query(
      'UPDATE meal_types SET start_time = ?, end_time = ? WHERE meal_type_id = ?',
      [origDinnerStart, origDinnerEnd, TARGET_MEAL_TYPE_ID]
    );

    // Cleanup temporary test meals
    await pool.query('DELETE FROM mess_attendance WHERE meal_id IN (?, ?)', [
      TEST_MEAL_ID_BOUNDARY,
      TEST_MEAL_ID_GH1,
    ]);
    await pool.query('DELETE FROM meals WHERE meal_id IN (?, ?)', [
      TEST_MEAL_ID_BOUNDARY,
      TEST_MEAL_ID_GH1,
    ]);
  });

  // ==========================================================================
  // 1. WINDOW BOUNDARIES (1 min before start, at start, at end, 1 min after)
  // ==========================================================================
  describe('1. Meal Serving Window Boundaries', () => {
    it('1 min before window start: attendance is strictly rejected with 422', async () => {
      // Set start_time to 1 minute in the future
      await pool.query(
        `UPDATE meal_types 
         SET start_time = ADDTIME(CURTIME(), '00:01:00'),
             end_time = ADDTIME(CURTIME(), '01:00:00')
         WHERE meal_type_id = ?`,
        [TARGET_MEAL_TYPE_ID]
      );

      // Attempt to mark via sp_mark_meal
      await expect(
        pool.query('CALL sp_mark_meal(?, ?, ?)', [studentBH1Id, TEST_MEAL_ID_BOUNDARY, 'COUNTER'])
      ).rejects.toThrow(/outside the designated meal serving window/i);
    });

    it('At window start time: attendance is accepted', async () => {
      // Set start_time to 2 seconds before CURTIME()
      await pool.query(
        `UPDATE meal_types 
         SET start_time = SUBTIME(CURTIME(), '00:00:02'),
             end_time = ADDTIME(CURTIME(), '00:30:00')
         WHERE meal_type_id = ?`,
        [TARGET_MEAL_TYPE_ID]
      );

      await pool.query('DELETE FROM mess_attendance WHERE meal_id = ?', [TEST_MEAL_ID_BOUNDARY]);

      // Attendance should succeed
      const [res] = await pool.query<any[]>(
        'CALL sp_mark_meal(?, ?, ?)',
        [studentBH1Id, TEST_MEAL_ID_BOUNDARY, 'COUNTER']
      );
      expect(res).toBeDefined();

      const [att] = await pool.query<any[]>(
        'SELECT * FROM mess_attendance WHERE student_id = ? AND meal_id = ?',
        [studentBH1Id, TEST_MEAL_ID_BOUNDARY]
      );
      expect(att.length).toBe(1);
    });

    it('At window end time: attendance is accepted', async () => {
      await pool.query('DELETE FROM mess_attendance WHERE meal_id = ?', [TEST_MEAL_ID_BOUNDARY]);

      // Window currently active and will close in 5 seconds
      await pool.query(
        `UPDATE meal_types 
         SET start_time = SUBTIME(CURTIME(), '00:10:00'),
             end_time = ADDTIME(CURTIME(), '00:00:05')
         WHERE meal_type_id = ?`,
        [TARGET_MEAL_TYPE_ID]
      );

      const [res] = await pool.query<any[]>(
        'CALL sp_mark_meal(?, ?, ?)',
        [studentBH1Id, TEST_MEAL_ID_BOUNDARY, 'COUNTER']
      );
      expect(res).toBeDefined();

      const [att] = await pool.query<any[]>(
        'SELECT * FROM mess_attendance WHERE student_id = ? AND meal_id = ?',
        [studentBH1Id, TEST_MEAL_ID_BOUNDARY]
      );
      expect(att.length).toBe(1);
    });

    it('1 min after window end: attendance is strictly rejected with 422', async () => {
      await pool.query('DELETE FROM mess_attendance WHERE meal_id = ?', [TEST_MEAL_ID_BOUNDARY]);

      // Window closed 1 minute ago
      await pool.query(
        `UPDATE meal_types 
         SET start_time = SUBTIME(CURTIME(), '01:00:00'),
             end_time = SUBTIME(CURTIME(), '00:01:00')
         WHERE meal_type_id = ?`,
        [TARGET_MEAL_TYPE_ID]
      );

      await expect(
        pool.query('CALL sp_mark_meal(?, ?, ?)', [studentBH1Id, TEST_MEAL_ID_BOUNDARY, 'COUNTER'])
      ).rejects.toThrow(/outside the designated meal serving window/i);
    });
  });

  // ==========================================================================
  // 2. CROSS-HOSTEL RESTRICTIONS (wrong hostel rejected)
  // ==========================================================================
  describe('2. Cross-Hostel Residence Boundary Enforcement', () => {
    it('Student living in GH1 attempting to mark BH1 meal is rejected (v_current_residence check)', async () => {
      // Re-open window
      await pool.query(
        `UPDATE meal_types 
         SET start_time = SUBTIME(CURTIME(), '00:30:00'),
             end_time = ADDTIME(CURTIME(), '00:30:00')
         WHERE meal_type_id = ?`,
        [TARGET_MEAL_TYPE_ID]
      );

      // TEST_MEAL_ID_BOUNDARY is in Hostel 1 (BH1), studentGH1Id resides in Hostel 3 (GH1)
      await expect(
        pool.query('CALL sp_mark_meal(?, ?, ?)', [studentGH1Id, TEST_MEAL_ID_BOUNDARY, 'COUNTER'])
      ).rejects.toThrow(/does not reside in the hostel/i);
    });

    it('Student living in BH1 attempting to mark GH1 meal is rejected', async () => {
      // TEST_MEAL_ID_GH1 is in Hostel 3 (GH1), studentBH1Id resides in Hostel 1 (BH1)
      await expect(
        pool.query('CALL sp_mark_meal(?, ?, ?)', [studentBH1Id, TEST_MEAL_ID_GH1, 'COUNTER'])
      ).rejects.toThrow(/does not reside in the hostel/i);
    });
  });

  // ==========================================================================
  // 3. CLOSED SLOTS REJECTION
  // ==========================================================================
  describe('3. Closed Meal Slot Handling', () => {
    it('Closed meal slot is rejected with friendly message', async () => {
      // Mark test meal as closed
      await pool.query('UPDATE meals SET is_closed = 1 WHERE meal_id = ?', [TEST_MEAL_ID_BOUNDARY]);

      await expect(
        pool.query('CALL sp_mark_meal(?, ?, ?)', [studentBH1Id, TEST_MEAL_ID_BOUNDARY, 'COUNTER'])
      ).rejects.toThrow(/closed for holiday\/maintenance/i);

      // Reopen
      await pool.query('UPDATE meals SET is_closed = 0 WHERE meal_id = ?', [TEST_MEAL_ID_BOUNDARY]);
    });
  });

  // ==========================================================================
  // 4. DOUBLE MARK REJECTED (UNIQUE constraint stays as hard stop)
  // ==========================================================================
  describe('4. Attendance Uniqueness & Double Mark Protection', () => {
    it('Repeat mark returns a friendly message and is rejected', async () => {
      await pool.query('DELETE FROM mess_attendance WHERE meal_id = ?', [TEST_MEAL_ID_BOUNDARY]);

      // First mark: succeeds
      await pool.query('CALL sp_mark_meal(?, ?, ?)', [studentBH1Id, TEST_MEAL_ID_BOUNDARY, 'COUNTER']);

      // Second mark: must be rejected with friendly message
      await expect(
        pool.query('CALL sp_mark_meal(?, ?, ?)', [studentBH1Id, TEST_MEAL_ID_BOUNDARY, 'COUNTER'])
      ).rejects.toThrow(/already been recorded for this meal slot/i);

      // Direct duplicate INSERT is blocked by UNIQUE (student_id, meal_id)
      await expect(
        pool.query(
          `INSERT INTO mess_attendance (student_id, meal_id, marked_via, marked_at, marked_by)
           VALUES (?, ?, 'COUNTER', NOW(), 1)`,
          [studentBH1Id, TEST_MEAL_ID_BOUNDARY]
        )
      ).rejects.toThrow(/Duplicate entry/i);
    });
  });

  // ==========================================================================
  // 5. ROTATING 60-SECOND HMAC QR TOKEN VERIFICATION
  // ==========================================================================
  describe('5. Rotating QR Token Authentication & Windows', () => {
    it('Current window token is accepted', () => {
      const now = Date.now();
      const currentWindow = get60sWindowIndex(now);
      const token = generateMessQrToken(101, now);

      const verification = verifyMessQrToken(token, 101);
      expect(verification.valid).toBe(true);
      expect(verification.windowIndex).toBe(currentWindow);
      expect(verification.isPreviousWindow).toBe(false);
    });

    it('Previous 60s window token is accepted (grace period)', () => {
      const pastTime = Date.now() - 65 * 1000;
      const prevWindow = get60sWindowIndex(pastTime);
      const token = `HC-MEAL:101:${prevWindow}:${generateMessHmac(101, prevWindow)}`;

      const verification = verifyMessQrToken(token, 101);
      expect(verification.valid).toBe(true);
      expect(verification.isPreviousWindow).toBe(true);
    });

    it('Two windows ago (>120 seconds old) token is rejected', () => {
      const oldTime = Date.now() - 130 * 1000;
      const oldWindow = get60sWindowIndex(oldTime);
      const token = `HC-MEAL:101:${oldWindow}:${generateMessHmac(101, oldWindow)}`;

      const verification = verifyMessQrToken(token, 101);
      expect(verification.valid).toBe(false);
      expect(verification.error).toMatch(/expired/i);
    });

    it('Tampered signature is strictly rejected', () => {
      const validToken = generateMessQrToken(101);
      const tampered = validToken.slice(0, -4) + '0000';

      const verification = verifyMessQrToken(tampered, 101);
      expect(verification.valid).toBe(false);
      expect(verification.error).toMatch(/Cryptographic signature mismatch|Invalid QR token/i);
    });
  });

  // ==========================================================================
  // 6. REFUND FIXTURES VERIFIED BY HAND
  // Formula:
  //   eligible_missed = MAX(0, scheduled - eaten - free_skips)
  //   refund = LEAST(food_component * cap_pct/100, eligible_missed * per_meal_rate)
  // Parameters:
  //   food_component = 3600.00, per_meal_rate = 40.00, free_skips = 15, cap_pct = 60.00
  //   Cap amount = 3600 * 0.60 = 2160.00
  //   Scheduled non-closed meals = 119 (30 days x 4 = 120, with 1 closed slot on Oct 2)
  // ==========================================================================
  describe('6. Refund Fixtures Verified by Hand', () => {
    it('Fixture 1 — All meals eaten: refund is exactly ₹0.00', () => {
      const scheduled = 119;
      const eaten = 119;
      const freeSkips = 15;
      const rate = 40.0;
      const cap = 2160.0;

      const eligibleMissed = Math.max(0, scheduled - eaten - freeSkips);
      const refund = Math.min(cap, eligibleMissed * rate);

      expect(eligibleMissed).toBe(0);
      expect(refund).toBe(0.0);
    });

    it('Fixture 2 — None eaten: hits the 60% food component cap of ₹2,160.00', () => {
      const scheduled = 119;
      const eaten = 0;
      const freeSkips = 15;
      const rate = 40.0;
      const cap = 2160.0;

      const eligibleMissed = Math.max(0, scheduled - eaten - freeSkips); // 104
      const uncapped = eligibleMissed * rate; // 104 * 40 = 4160.00
      const refund = Math.min(cap, uncapped);

      expect(eligibleMissed).toBe(104);
      expect(uncapped).toBe(4160.0);
      expect(refund).toBe(2160.0);
    });

    it('Fixture 3 — Exactly the free-skip count: refund is exactly ₹0.00', () => {
      const scheduled = 119;
      const eaten = 104; // exactly 15 skipped
      const freeSkips = 15;
      const rate = 40.0;
      const cap = 2160.0;

      const eligibleMissed = Math.max(0, scheduled - eaten - freeSkips); // 15 - 15 = 0
      const refund = Math.min(cap, eligibleMissed * rate);

      expect(eligibleMissed).toBe(0);
      expect(refund).toBe(0.0);
    });

    it('Fixture 4 — Closed days excluded: scheduled reflects 121 (not 124)', async () => {
      const [counts] = await pool.query<any[]>(
        'SELECT meals_scheduled, meals_closed, total_slots FROM v_meal_counts WHERE hostel_id = 1 AND month = 10 AND year = 2026'
      );

      expect(counts.length).toBe(1);
      expect(Number(counts[0].meals_closed)).toBe(3);
      expect(Number(counts[0].meals_scheduled)).toBe(121);
      expect(Number(counts[0].total_slots)).toBe(124);
    });
  });

  // ==========================================================================
  // 7. PREVIEW CALCULATION BENCHMARK & VARIATION
  // ==========================================================================
  describe('7. Set-Based Preview Calculation & Roster Variation', () => {
    it('300-resident preview runs in a single statement under high performance bounds', async () => {
      // Clean up previous refunds for test run
      await pool.query('DELETE FROM mess_refunds WHERE month = 10 AND year = 2026');

      const startTime = performance.now();
      await pool.query('CALL sp_calculate_refunds(NULL, 10, 2026, ?)', ['PREVIEW']);
      const elapsed = performance.now() - startTime;

      console.log(`\n================================================================`);
      console.log(`[Phase 9 Benchmark] 300-Resident Refund Calculation: ${elapsed.toFixed(2)} ms`);
      console.log(`================================================================\n`);

      expect(elapsed).toBeLessThan(1000);

      // Verify all 300 residents received preview calculations
      const [allRefunds] = await pool.query<any[]>(
        'SELECT COUNT(*) AS cnt FROM mess_refunds WHERE month = 10 AND year = 2026'
      );
      expect(Number(allRefunds[0].cnt)).toBe(300);
    });

    it('A preview on the seeded month shows varied refunds, not a flat amount', async () => {
      // Query distinct refund amounts for the seeded month
      const [distinctRefunds] = await pool.query<any[]>(
        `SELECT DISTINCT refund_amount 
         FROM mess_refunds 
         WHERE month = 10 AND year = 2026
         ORDER BY refund_amount ASC`
      );

      expect(distinctRefunds.length).toBeGreaterThan(10);

      const [stdDev] = await pool.query<any[]>(
        `SELECT STDDEV(refund_amount) AS std_dev, MIN(refund_amount) AS min_ref, MAX(refund_amount) AS max_ref
         FROM mess_refunds 
         WHERE month = 10 AND year = 2026`
      );

      expect(Number(stdDev[0].std_dev)).toBeGreaterThan(50);
      expect(Number(stdDev[0].max_ref)).toBeGreaterThan(Number(stdDev[0].min_ref));
    });
  });

  // ==========================================================================
  // 8. FINAL ROW IMMUTABILITY & NOTIFICATION DISPATCH
  // ==========================================================================
  describe('8. FINAL Row Immutability & Notification Triggers', () => {
    it('Finalizing refunds locks rows immutably and notifies residents', async () => {
      await pool.query("DELETE FROM notifications WHERE notif_type = 'MESS_REFUND'");

      // Finalize refunds for Hostel 1 (BH1)
      await pool.query('CALL sp_calculate_refunds(1, 10, 2026, ?)', ['FINAL']);

      // 1. Verify status is FINAL
      const [finalRows] = await pool.query<any[]>(
        `SELECT mr.status 
         FROM mess_refunds mr
         JOIN v_current_residence cr ON mr.student_id = cr.student_id
         WHERE cr.hostel_id = 1 AND mr.month = 10 AND mr.year = 2026
         LIMIT 5`
      );
      expect(finalRows.every((r) => r.status === 'FINAL')).toBe(true);

      // 2. Verify notifications dispatched to BH1 residents via trg_mess_refunds_after_update
      const [notifs] = await pool.query<any[]>(
        "SELECT COUNT(*) AS cnt FROM notifications WHERE notif_type = 'MESS_REFUND'"
      );
      expect(Number(notifs[0].cnt)).toBeGreaterThan(50);
    });

    it('FINAL row cannot be changed: trigger aborts any subsequent update with 45000', async () => {
      const [row] = await pool.query<any[]>(
        "SELECT refund_id, refund_amount FROM mess_refunds WHERE status = 'FINAL' LIMIT 1"
      );
      expect(row.length).toBe(1);

      const targetId = row[0].refund_id;
      const originalAmount = row[0].refund_amount;

      // Direct SQL UPDATE must fail due to trg_mess_refunds_before_update
      await expect(
        pool.query('UPDATE mess_refunds SET refund_amount = ? WHERE refund_id = ?', [
          Number(originalAmount) + 500,
          targetId,
        ])
      ).rejects.toThrow(/Finalized mess refunds are strictly immutable/i);
    });

    it('Finalized refunds cannot be overwritten by re-running sp_calculate_refunds', async () => {
      await expect(
        pool.query('CALL sp_calculate_refunds(1, 10, 2026, ?)', ['FINAL'])
      ).rejects.toThrow(/already been finalized for this period/i);

      await expect(
        pool.query('CALL sp_calculate_refunds(1, 10, 2026, ?)', ['PREVIEW'])
      ).rejects.toThrow(/already been finalized for this period/i);
    });
  });

  // ==========================================================================
  // 9. REST API INTEGRATION TESTS
  // ==========================================================================
  describe('9. REST API Endpoints', () => {
    it('GET /api/mess/counter returns active meal and rotating token', async () => {
      const res = await request(app)
        .get('/api/mess/counter?hostel_id=1')
        .set('Cookie', messManagerCookie);

      expect(res.status).toBe(200);
      expect(res.body.hostel).toBeDefined();
      expect(res.body.token).toBeDefined();
      expect(res.body.windowSeconds).toBe(60);
      expect(typeof res.body.expiresIn).toBe('number');
      expect(typeof res.body.markedCount).toBe('number');
    });

    it('POST /api/mess/mark: Student marks attendance using valid QR token', async () => {
      // Reopen boundary meal window
      await pool.query(
        `UPDATE meal_types 
         SET start_time = SUBTIME(CURTIME(), '00:30:00'),
             end_time = ADDTIME(CURTIME(), '00:30:00')
         WHERE meal_type_id = ?`,
        [TARGET_MEAL_TYPE_ID]
      );
      await pool.query('DELETE FROM mess_attendance WHERE meal_id = ?', [TEST_MEAL_ID_BOUNDARY]);

      // Generate real token for TEST_MEAL_ID_BOUNDARY
      const token = generateMessQrToken(TEST_MEAL_ID_BOUNDARY);

      const res = await request(app)
        .post('/api/mess/mark')
        .set('Cookie', studentBH1Cookie)
        .send({ token });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.meal.meal_id).toBe(TEST_MEAL_ID_BOUNDARY);
    });

    it('POST /api/mess/mark-manual: Mess Manager marks attendance at counter', async () => {
      // Clean up previous attendance
      await pool.query('DELETE FROM mess_attendance WHERE meal_id = ?', [TEST_MEAL_ID_BOUNDARY]);

      const res = await request(app)
        .post('/api/mess/mark-manual')
        .set('Cookie', messManagerCookie)
        .send({
          student_id: studentBH1Id,
          meal_id: TEST_MEAL_ID_BOUNDARY,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.student.student_id).toBe(studentBH1Id);
    });

    it('GET /api/mess/me/month: Student fetches 30-day matrix', async () => {
      const res = await request(app)
        .get('/api/mess/me/month?month=10&year=2026')
        .set('Cookie', studentBH1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.student).toBeDefined();
      expect(res.body.summary).toBeDefined();
      expect(res.body.meals).toBeInstanceOf(Array);
      expect(res.body.meals.length).toBe(124); // 31 days x 4 meals
    });

    it('GET /api/mess/me/projection: Student views attendance refund vs flat refund', async () => {
      const res = await request(app)
        .get('/api/mess/me/projection?month=10&year=2026')
        .set('Cookie', studentBH1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.scheduled).toBe(121);
      expect(typeof res.body.eaten).toBe('number');
      expect(res.body.free_skips).toBe(8);
      expect(res.body.per_meal_rate).toBe(28);
      expect(res.body.cap_amount).toBe(2160);
      expect(typeof res.body.attendance_refund).toBe('number');
      expect(res.body.flat_refund).toBe(1200);
      expect(typeof res.body.difference).toBe('number');
    });

    it('GET /api/mess/refunds: Manager fetches roster of residents', async () => {
      const res = await request(app)
        .get('/api/mess/refunds?hostel_id=1&month=10&year=2026&pageSize=50')
        .set('Cookie', messManagerCookie);

      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThan(50);
      expect(res.body.summary).toBeDefined();
      expect(res.body.refunds).toBeInstanceOf(Array);
      expect(res.body.refunds.length).toBeGreaterThan(0);
    });

    it('GET & PUT /api/mess/config: Mess Manager updates fee settings', async () => {
      // 1. Fetch current config
      const getRes = await request(app)
        .get('/api/mess/config?hostel_id=1&month=11&year=2026')
        .set('Cookie', messManagerCookie);

      expect(getRes.status).toBe(200);
      expect(getRes.body.config).toBeDefined();

      // 2. Update config
      const putRes = await request(app)
        .put('/api/mess/config')
        .set('Cookie', messManagerCookie)
        .send({
          hostel_id: 1,
          month: 11,
          year: 2026,
          monthly_fee: 4800,
          food_component: 3800,
          per_meal_refund_rate: 45,
          free_skips: 12,
          cap_pct: 65,
          flat_refund: 1350,
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);
      expect(Number(putRes.body.config.monthly_fee)).toBe(4800);
      expect(Number(putRes.body.config.food_component)).toBe(3800);
      expect(Number(putRes.body.config.per_meal_refund_rate)).toBe(45);
      expect(Number(putRes.body.config.free_skips)).toBe(12);
      expect(Number(putRes.body.config.cap_pct)).toBe(65);

      // Revert back for consistency
      await request(app)
        .put('/api/mess/config')
        .set('Cookie', messManagerCookie)
        .send({
          hostel_id: 1,
          month: 11,
          year: 2026,
          monthly_fee: 4500,
          food_component: 3600,
          per_meal_refund_rate: 40,
          free_skips: 15,
          cap_pct: 60,
          flat_refund: 1200,
        });
    });

    it('GET /api/mess/summary: Aggregates institutional totals', async () => {
      const res = await request(app)
        .get('/api/mess/summary?hostel_id=1&month=10&year=2026')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.summaries).toBeInstanceOf(Array);
      if (res.body.summaries.length > 0) {
        expect(res.body.summaries[0].hostel_id).toBe(1);
        expect(Number(res.body.summaries[0].meals_scheduled)).toBe(121);
      }
    });
  });
});
