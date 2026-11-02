/**
 * Phase 8: Smart Laundry Status — Test Suite
 * Concurrency, access control, state machine, HMAC signatures, and automated event release.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../index.js';
import { pool } from '../db.js';
import { config } from '../config.js';
import { generateMachineHmac, generateMachineQrPayload } from '../utils/laundryQr.js';

describe('Phase 8: Smart Laundry Status', () => {
  // Session handles
  let adminCookie: string;
  let adminCsrf: string;
  let caretakerCookie: string;
  let caretakerCsrf: string;
  let studentACookie: string;
  let studentACsrf: string;
  let studentBCookie: string;
  let studentBCsrf: string;
  let studentGirlCookie: string;
  let studentGirlCsrf: string;

  // Resolved test entities
  let studentAId: number;
  let studentBId: number;
  let studentGirlId: number;
  let bh1Residents: { student_id: number; user_id: number; login_id: string }[] = [];

  // Machine IDs
  const BH1_MACHINE_1 = 1;
  const BH1_MACHINE_2 = 2;
  const GH1_MACHINE = 17;

  beforeAll(async () => {
    // 1. Clean up any existing active washes on test machines
    await pool.query(
      `UPDATE washing_machines 
       SET status = 'FREE', current_student_id = NULL, started_at = NULL, expected_end_at = NULL 
       WHERE machine_id IN (?, ?, ?)`,
      [BH1_MACHINE_1, BH1_MACHINE_2, GH1_MACHINE]
    );
    await pool.query(
      `DELETE FROM machine_usage_log WHERE machine_id IN (?, ?, ?) AND ended_at IS NULL`,
      [BH1_MACHINE_1, BH1_MACHINE_2, GH1_MACHINE]
    );

    // 2. Admin login
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: 'admin', password: 'Password@123' });
    adminCookie = adminRes.headers['set-cookie'].join('; ');
    adminCsrf = adminRes.body.csrfToken;

    // 3. Caretaker BH1 login
    const caretakerRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: 'caretaker_bh1', password: 'Password@123' });
    caretakerCookie = caretakerRes.headers['set-cookie'].join('; ');
    caretakerCsrf = caretakerRes.body.csrfToken;

    // 4. Resolve 50+ residents of BH1 for parallel concurrency test
    const [residents] = await pool.query<any[]>(
      `SELECT s.student_id, s.user_id, u.login_id 
       FROM v_current_residence r
       JOIN students s ON r.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       WHERE r.hostel_id = 1
       ORDER BY s.student_id ASC
       LIMIT 60`
    );
    bh1Residents = residents;

    // Student A & B in BH1
    studentAId = bh1Residents[0].student_id;
    const sARes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: bh1Residents[0].login_id, password: 'Password@123' });
    studentACookie = sARes.headers['set-cookie'].join('; ');
    studentACsrf = sARes.body.csrfToken;

    studentBId = bh1Residents[1].student_id;
    const sBRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: bh1Residents[1].login_id, password: 'Password@123' });
    studentBCookie = sBRes.headers['set-cookie'].join('; ');
    studentBCsrf = sBRes.body.csrfToken;

    // Student Girl in GH1
    const [girlRows] = await pool.query<any[]>(
      `SELECT s.student_id, s.user_id, u.login_id 
       FROM v_current_residence r
       JOIN students s ON r.student_id = s.student_id
       JOIN users u ON s.user_id = u.user_id
       WHERE r.hostel_id = 3
       ORDER BY s.student_id ASC
       LIMIT 1`
    );
    studentGirlId = girlRows[0].student_id;
    const sGRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: girlRows[0].login_id, password: 'Password@123' });
    studentGirlCookie = sGRes.headers['set-cookie'].join('; ');
    studentGirlCsrf = sGRes.body.csrfToken;
  });

  afterAll(async () => {
    // Reset test machines and clear test records
    await pool.query(
      `UPDATE washing_machines 
       SET status = 'FREE', current_student_id = NULL, started_at = NULL, expected_end_at = NULL 
       WHERE machine_id IN (?, ?, ?)`,
      [BH1_MACHINE_1, BH1_MACHINE_2, GH1_MACHINE]
    );
    await pool.query(
      `DELETE FROM machine_usage_log WHERE machine_id IN (?, ?, ?) AND started_at >= NOW() - INTERVAL 1 HOUR`,
      [BH1_MACHINE_1, BH1_MACHINE_2, GH1_MACHINE]
    );
    await pool.query(
      `DELETE FROM notifications WHERE notif_type = 'LAUNDRY_REPORT' AND created_at >= NOW() - INTERVAL 1 HOUR`
    );
    // Reset settings
    await pool.query(
      `INSERT INTO app_settings (setting_key, setting_value) VALUES 
       ('laundry_cycle_minutes', '45'),
       ('laundry_grace_minutes', '5')
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`
    );
    await pool.query(`DELETE FROM app_settings WHERE setting_key IN ('laundry_grace_seconds', 'laundry_cycle_seconds')`);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test 1: Concurrency Benchmark — 50 Parallel Start Requests on One Machine
  // ══════════════════════════════════════════════════════════════════════════
  describe('1. Concurrency Benchmark — 50 Parallel Requests on Machine 1', () => {
    it('50 parallel start requests on one machine produce exactly ONE success and 49 rejections', async () => {
      // Ensure machine is FREE
      await pool.query(
        `UPDATE washing_machines 
         SET status = 'FREE', current_student_id = NULL, started_at = NULL, expected_end_at = NULL 
         WHERE machine_id = ?`,
        [BH1_MACHINE_1]
      );
      await pool.query(
        `DELETE FROM machine_usage_log WHERE machine_id = ? AND ended_at IS NULL`,
        [BH1_MACHINE_1]
      );

      expect(bh1Residents.length).toBeGreaterThanOrEqual(50);
      const testCandidates = bh1Residents.slice(0, 50);

      // Pre-generate authentication sessions and tokens for all 50 distinct residents
      const candidateSessions = testCandidates.map((c) => {
        const csrfToken = 'test-csrf-' + c.student_id;
        const token = jwt.sign(
          {
            userId: c.user_id,
            loginId: c.login_id,
            role: 'STUDENT',
            mustChangePassword: false,
            csrfToken,
          },
          config.jwtSecret,
          { expiresIn: '1h' }
        );
        return {
          cookie: `token=${token}; csrf_token=${csrfToken}`,
          csrfToken,
          studentId: c.student_id,
        };
      });

      const qrPayload = generateMachineQrPayload(BH1_MACHINE_1);

      // Execute 50 parallel requests
      const startTime = Date.now();
      const promises = candidateSessions.map((session) =>
        request(app)
          .post(`/api/laundry/${BH1_MACHINE_1}/start`)
          .set('Cookie', session.cookie)
          .set('x-csrf-token', session.csrfToken)
          .send({ qr_payload: qrPayload })
      );

      const results = await Promise.all(promises);
      const elapsedMs = Date.now() - startTime;

      const successResponses = results.filter((r) => r.status === 200);
      const rejectedResponses = results.filter((r) => r.status !== 200);

      console.log(`\n══════════════════ PHASE 8 CONCURRENCY BENCHMARK ══════════════════`);
      console.log(`Total Parallel Requests Issued: ${results.length}`);
      console.log(`HTTP 200 Successes:             ${successResponses.length}`);
      console.log(`HTTP 4xx/5xx Rejections:        ${rejectedResponses.length}`);
      console.log(`Total Wall-Clock Latency:       ${elapsedMs} ms`);
      console.log(`Average Latency per Contender:  ${(elapsedMs / results.length).toFixed(2)} ms`);
      console.log(`═══════════════════════════════════════════════════════════════════\n`);

      // Assertions
      expect(successResponses.length).toBe(1);
      expect(rejectedResponses.length).toBe(49);

      // Verify database state: Machine is OCCUPIED
      const [machineRows] = await pool.query<any[]>(
        `SELECT status, current_student_id, started_at, expected_end_at 
         FROM washing_machines WHERE machine_id = ?`,
        [BH1_MACHINE_1]
      );
      expect(machineRows[0].status).toBe('OCCUPIED');
      expect(machineRows[0].current_student_id).not.toBeNull();

      // Exactly ONE open usage log row exists
      const [logRows] = await pool.query<any[]>(
        `SELECT COUNT(*) as openCount 
         FROM machine_usage_log 
         WHERE machine_id = ? AND ended_at IS NULL`,
        [BH1_MACHINE_1]
      );
      expect(logRows[0].openCount).toBe(1);

      // Clean up machine after concurrency test
      await pool.query(
        `UPDATE washing_machines 
         SET status = 'FREE', current_student_id = NULL, started_at = NULL, expected_end_at = NULL 
         WHERE machine_id = ?`,
        [BH1_MACHINE_1]
      );
      await pool.query(
        `UPDATE machine_usage_log SET ended_at = NOW(), end_reason = 'FINISHED' 
         WHERE machine_id = ? AND ended_at IS NULL`,
        [BH1_MACHINE_1]
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test 2: The Same Student Cannot Hold Two Machines
  // ══════════════════════════════════════════════════════════════════════════
  describe('2. Single Active Machine Limit per Resident', () => {
    it('The same student cannot hold two machines simultaneously', async () => {
      // Step A: Student A starts Machine 1
      const startRes1 = await request(app)
        .post(`/api/laundry/${BH1_MACHINE_1}/start`)
        .set('Cookie', studentACookie)
        .set('x-csrf-token', studentACsrf)
        .send();
      expect(startRes1.status).toBe(200);

      // Step B: Student A attempts to claim Machine 2 (which is currently FREE)
      const startRes2 = await request(app)
        .post(`/api/laundry/${BH1_MACHINE_2}/start`)
        .set('Cookie', studentACookie)
        .set('x-csrf-token', studentACsrf)
        .send();

      // Must be rejected by business rule / unique constraint
      expect([409, 422]).toContain(startRes2.status);
      expect(startRes2.body.message).toMatch(
        /already has an active washing machine|Duplicate entry|unique/i
      );

      // Verify Machine 2 remains FREE in database
      const [m2Rows] = await pool.query<any[]>(
        `SELECT status, current_student_id FROM washing_machines WHERE machine_id = ?`,
        [BH1_MACHINE_2]
      );
      expect(m2Rows[0].status).toBe('FREE');
      expect(m2Rows[0].current_student_id).toBeNull();

      // Clean up Machine 1
      await request(app)
        .post(`/api/laundry/${BH1_MACHINE_1}/finish`)
        .set('Cookie', studentACookie)
        .set('x-csrf-token', studentACsrf)
        .send();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test 3: Cross-Hostel Residence Boundary Enforcement
  // ══════════════════════════════════════════════════════════════════════════
  describe('3. Cross-Hostel Residence Boundary Enforcement', () => {
    it('A student from another hostel is rejected (v_current_residence check)', async () => {
      // Student Girl resides in GH1 (hostel_id 3)
      // BH1_MACHINE_1 resides in BH1 (hostel_id 1)
      const crossRes = await request(app)
        .post(`/api/laundry/${BH1_MACHINE_1}/start`)
        .set('Cookie', studentGirlCookie)
        .set('x-csrf-token', studentGirlCsrf)
        .send();

      expect(crossRes.status).toBe(422);
      expect(crossRes.body.message).toMatch(
        /resident does not live in this machine hostel|not have an active/i
      );

      // Verify machine was not occupied
      const [mRows] = await pool.query<any[]>(
        `SELECT status FROM washing_machines WHERE machine_id = ?`,
        [BH1_MACHINE_1]
      );
      expect(mRows[0].status).toBe('FREE');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test 4: Automated Event Release & History Row Closure
  // ══════════════════════════════════════════════════════════════════════════
  describe('4. Automated Overdue Release Event (ev_free_overdue_machines)', () => {
    it('The event frees a machine after expiry (using short test setting) and closes log row as AUTO_RELEASED', async () => {
      // 1. Configure short test grace period: 1 second
      await pool.query(
        `INSERT INTO app_settings (setting_key, setting_value, description)
         VALUES ('laundry_grace_seconds', '1', 'Test grace seconds')
         ON DUPLICATE KEY UPDATE setting_value = '1'`
      );

      // 2. Start wash on Machine 1 for Student A
      const startRes = await request(app)
        .post(`/api/laundry/${BH1_MACHINE_1}/start`)
        .set('Cookie', studentACookie)
        .set('x-csrf-token', studentACsrf)
        .send();
      expect(startRes.status).toBe(200);

      // 3. Artificially advance machine timers so it is overdue past grace
      await pool.query(
        `UPDATE washing_machines 
         SET started_at = NOW() - INTERVAL 50 MINUTE,
             expected_end_at = NOW() - INTERVAL 5 SECOND
         WHERE machine_id = ?`,
        [BH1_MACHINE_1]
      );

      // 4. Trigger the overdue machine release procedure (called by ev_free_overdue_machines)
      await pool.query(`CALL sp_free_overdue_machines()`);

      // 5. Assertions: Machine must be FREE
      const [mRows] = await pool.query<any[]>(
        `SELECT status, current_student_id, started_at, expected_end_at 
         FROM washing_machines WHERE machine_id = ?`,
        [BH1_MACHINE_1]
      );
      expect(mRows[0].status).toBe('FREE');
      expect(mRows[0].current_student_id).toBeNull();
      expect(mRows[0].started_at).toBeNull();
      expect(mRows[0].expected_end_at).toBeNull();

      // 6. Assertions: Usage log row must be closed as AUTO_RELEASED
      const [logRows] = await pool.query<any[]>(
        `SELECT ended_at, end_reason 
         FROM machine_usage_log 
         WHERE machine_id = ? AND student_id = ? 
         ORDER BY log_id DESC LIMIT 1`,
        [BH1_MACHINE_1, studentAId]
      );
      expect(logRows[0].ended_at).not.toBeNull();
      expect(logRows[0].end_reason).toBe('AUTO_RELEASED');

      // 7. Zero open rows remain
      const [openRows] = await pool.query<any[]>(
        `SELECT COUNT(*) as cnt FROM machine_usage_log WHERE machine_id = ? AND ended_at IS NULL`,
        [BH1_MACHINE_1]
      );
      expect(openRows[0].cnt).toBe(0);

      // Clean up test setting
      await pool.query(`DELETE FROM app_settings WHERE setting_key = 'laundry_grace_seconds'`);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test 5: Wash Finish Authorization (Owner or Caretaker Only)
  // ══════════════════════════════════════════════════════════════════════════
  describe('5. Wash Finish Authorization (Owner vs Caretaker vs Stranger)', () => {
    it('Stranger student cannot finish someone else wash', async () => {
      // Student A starts Machine 1
      await request(app)
        .post(`/api/laundry/${BH1_MACHINE_1}/start`)
        .set('Cookie', studentACookie)
        .set('x-csrf-token', studentACsrf)
        .send();

      // Student B attempts to finish Student A's wash
      const rejectRes = await request(app)
        .post(`/api/laundry/${BH1_MACHINE_1}/finish`)
        .set('Cookie', studentBCookie)
        .set('x-csrf-token', studentBCsrf)
        .send();

      expect(rejectRes.status).toBe(422);
      expect(rejectRes.body.message).toMatch(
        /only the machine owner or hostel caretaker can release this machine/i
      );

      // Caretaker can finish Student A's wash
      const caretakerFinish = await request(app)
        .post(`/api/laundry/${BH1_MACHINE_1}/finish`)
        .set('Cookie', caretakerCookie)
        .set('x-csrf-token', caretakerCsrf)
        .send();
      expect(caretakerFinish.status).toBe(200);

      // Verify closed as FINISHED
      const [logRows] = await pool.query<any[]>(
        `SELECT end_reason FROM machine_usage_log WHERE machine_id = ? ORDER BY log_id DESC LIMIT 1`,
        [BH1_MACHINE_1]
      );
      expect(logRows[0].end_reason).toBe('FINISHED');
    });

    it('Owner student can finish their own wash early', async () => {
      // Student A starts Machine 1
      await request(app)
        .post(`/api/laundry/${BH1_MACHINE_1}/start`)
        .set('Cookie', studentACookie)
        .set('x-csrf-token', studentACsrf)
        .send();

      // Student A finishes their own wash
      const finishRes = await request(app)
        .post(`/api/laundry/${BH1_MACHINE_1}/finish`)
        .set('Cookie', studentACookie)
        .set('x-csrf-token', studentACsrf)
        .send();

      expect(finishRes.status).toBe(200);

      const [mRows] = await pool.query<any[]>(
        `SELECT status FROM washing_machines WHERE machine_id = ?`,
        [BH1_MACHINE_1]
      );
      expect(mRows[0].status).toBe('FREE');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test 6: QR HMAC Signature Verification
  // ══════════════════════════════════════════════════════════════════════════
  describe('6. QR Payload & HMAC Signature Verification', () => {
    it('Rejects start request with tampered QR HMAC signature', async () => {
      const tamperedPayload = JSON.stringify({
        machine_id: BH1_MACHINE_1,
        sig: 'badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbad1',
      });

      const res = await request(app)
        .post(`/api/laundry/${BH1_MACHINE_1}/start`)
        .set('Cookie', studentACookie)
        .set('x-csrf-token', studentACsrf)
        .send({ qr_payload: tamperedPayload });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('InvalidQrSignature');
    });

    it('Accepts start request with valid QR HMAC signature', async () => {
      const validPayload = generateMachineQrPayload(BH1_MACHINE_1);

      const res = await request(app)
        .post(`/api/laundry/${BH1_MACHINE_1}/start`)
        .set('Cookie', studentACookie)
        .set('x-csrf-token', studentACsrf)
        .send({ qr_payload: validPayload });

      expect(res.status).toBe(200);

      // Clean up
      await request(app)
        .post(`/api/laundry/${BH1_MACHINE_1}/finish`)
        .set('Cookie', studentACookie)
        .set('x-csrf-token', studentACsrf)
        .send();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test 7: Caretaker Status Controls (OUT_OF_ORDER vs FREE)
  // ══════════════════════════════════════════════════════════════════════════
  describe('7. Caretaker Machine Status Controls', () => {
    it('Students cannot change machine status via PATCH /status', async () => {
      const res = await request(app)
        .patch(`/api/laundry/${BH1_MACHINE_1}/status`)
        .set('Cookie', studentACookie)
        .set('x-csrf-token', studentACsrf)
        .send({ status: 'OUT_OF_ORDER' });

      expect(res.status).toBe(403);
    });

    it('Caretaker can toggle status between OUT_OF_ORDER and FREE', async () => {
      // Mark OUT_OF_ORDER
      const outRes = await request(app)
        .patch(`/api/laundry/${BH1_MACHINE_1}/status`)
        .set('Cookie', caretakerCookie)
        .set('x-csrf-token', caretakerCsrf)
        .send({ status: 'OUT_OF_ORDER' });

      expect(outRes.status).toBe(200);
      expect(outRes.body.status).toBe('OUT_OF_ORDER');

      // Student cannot start an OUT_OF_ORDER machine
      const startFail = await request(app)
        .post(`/api/laundry/${BH1_MACHINE_1}/start`)
        .set('Cookie', studentACookie)
        .set('x-csrf-token', studentACsrf)
        .send();
      expect(startFail.status).toBe(422);

      // Caretaker restores to FREE
      const freeRes = await request(app)
        .patch(`/api/laundry/${BH1_MACHINE_1}/status`)
        .set('Cookie', caretakerCookie)
        .set('x-csrf-token', caretakerCsrf)
        .send({ status: 'FREE' });

      expect(freeRes.status).toBe(200);
      expect(freeRes.body.status).toBe('FREE');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test 8: Resident Reports Machine Issue (Notifies Caretaker)
  // ══════════════════════════════════════════════════════════════════════════
  describe('8. Issue Reporting and Caretaker Notification', () => {
    it('POST /report creates an in-app notification for the hostel caretaker', async () => {
      const reportRes = await request(app)
        .post(`/api/laundry/${BH1_MACHINE_1}/report`)
        .set('Cookie', studentACookie)
        .set('x-csrf-token', studentACsrf)
        .send({
          issue: 'Water drainage valve leaking during spin cycle TEST_P8',
        });

      expect(reportRes.status).toBe(200);
      expect(reportRes.body.success).toBe(true);

      // Verify notification in database for caretaker
      const [notifRows] = await pool.query<any[]>(
        `SELECT notif_type, title, body 
         FROM notifications 
         WHERE notif_type = 'LAUNDRY_REPORT' AND body LIKE '%TEST_P8%'`
      );
      expect(notifRows.length).toBeGreaterThan(0);
      expect(notifRows[0].title).toMatch(/Laundry Issue: Machine/i);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test 9: Machine Status & History Query Endpoints
  // ══════════════════════════════════════════════════════════════════════════
  describe('9. Machine Status Grid & Usage History', () => {
    it('GET /api/laundry/machines returns seconds_remaining and scopes to student hostel', async () => {
      const res = await request(app)
        .get('/api/laundry/machines')
        .set('Cookie', studentACookie);

      expect(res.status).toBe(200);
      expect(res.body.machines).toBeDefined();
      expect(Array.isArray(res.body.machines)).toBe(true);
      // Student A in BH1 only sees BH1 machines
      res.body.machines.forEach((m: any) => {
        expect(m.hostel_id).toBe(1);
        expect(m).toHaveProperty('seconds_remaining');
        expect(m).toHaveProperty('qrPayload');
        expect(m).toHaveProperty('signature');
      });
    });

    it('GET /api/laundry/history returns server-paginated audit history with filters', async () => {
      const res = await request(app)
        .get('/api/laundry/history?page=1&pageSize=10')
        .set('Cookie', studentACookie);

      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
      expect(typeof res.body.total).toBe('number');
      expect(res.body.page).toBe(1);
    });
  });
});
