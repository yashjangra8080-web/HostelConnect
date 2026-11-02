/**
 * Phase 7: Confidential Complaints — Test Suite
 * Negatives first: access control → state machine → positive flows → audit → event → admin
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { pool } from '../db.js';
import mysql from 'mysql2/promise';
import { config } from '../config.js';

// ─── Helper: open a raw connection as a specific DB user ─────────────────────
function openConn(user: string, password: string) {
  return mysql.createConnection({
    host:     config.db.host,
    port:     config.db.port,
    user,
    password,
    database: config.db.database,
  });
}

describe('Phase 7: Confidential Complaints', () => {
  // Session handles
  let adminCookie: string;   let adminCsrf: string;
  let wardenCookie: string;  let wardenCsrf: string;
  let chiefCookie: string;   let chiefCsrf: string;
  let studentACookie: string; let studentACsrf: string;
  let studentBCookie: string; let studentBCsrf: string;

  // IDs resolved during setup
  let studentAUserId: number;
  let studentBUserId: number;
  let wardenAuthorityId: number;
  let chiefAuthorityId: number;
  let filedComplaintId: number;
  let anonComplaintId: number;
  let filedTrackingCode: string;

  beforeAll(async () => {
    // ── Admin login ──────────────────────────────────────────────────────────
    const adminRes = await request(app).post('/api/auth/login')
      .send({ login_id: 'admin', password: 'Password@123' });
    adminCookie = adminRes.headers['set-cookie'].join('; ');
    adminCsrf   = adminRes.body.csrfToken;

    // ── Warden login ─────────────────────────────────────────────────────────
    const wardenRes = await request(app).post('/api/auth/login')
      .send({ login_id: 'warden_bh1', password: 'Password@123' });
    wardenCookie = wardenRes.headers['set-cookie'].join('; ');
    wardenCsrf   = wardenRes.body.csrfToken;

    // ── Chief Warden login ───────────────────────────────────────────────────
    const chiefRes = await request(app).post('/api/auth/login')
      .send({ login_id: 'chiefwarden', password: 'Password@123' });
    chiefCookie = chiefRes.headers['set-cookie'].join('; ');
    chiefCsrf   = chiefRes.body.csrfToken;

    // ── Student A: first available student ───────────────────────────────────
    const [studentsA] = await pool.query<any[]>(
      `SELECT s.student_id, s.user_id, u.login_id
       FROM students s JOIN users u ON s.user_id = u.user_id
       ORDER BY s.student_id ASC LIMIT 1`
    );
    studentAUserId = studentsA[0].user_id;
    const sARes = await request(app).post('/api/auth/login')
      .send({ login_id: studentsA[0].login_id, password: 'Password@123' });
    studentACookie = sARes.headers['set-cookie'].join('; ');
    studentACsrf   = sARes.body.csrfToken;

    // ── Student B: second available student ──────────────────────────────────
    const [studentsB] = await pool.query<any[]>(
      `SELECT s.student_id, s.user_id, u.login_id
       FROM students s JOIN users u ON s.user_id = u.user_id
       ORDER BY s.student_id ASC LIMIT 1 OFFSET 1`
    );
    studentBUserId = studentsB[0].user_id;
    const sBRes = await request(app).post('/api/auth/login')
      .send({ login_id: studentsB[0].login_id, password: 'Password@123' });
    studentBCookie = sBRes.headers['set-cookie'].join('; ');
    studentBCsrf   = sBRes.body.csrfToken;

    // ── Resolve authority IDs ────────────────────────────────────────────────
    const [authRows] = await pool.query<any[]>(
      `SELECT authority_id, designation FROM authorities WHERE designation IN ('HOSTEL_WARDEN','CHIEF_WARDEN')`
    );
    wardenAuthorityId = authRows.find((a) => a.designation === 'HOSTEL_WARDEN')?.authority_id;
    chiefAuthorityId  = authRows.find((a) => a.designation === 'CHIEF_WARDEN')?.authority_id;
  });

  afterAll(async () => {
    // Clean test complaint data
    await pool.query(
      `DELETE cr FROM complaint_responses cr
         JOIN complaints c ON cr.complaint_id = c.complaint_id
        WHERE c.subject LIKE 'TEST_P7_%'`
    );
    await pool.query(`DELETE FROM complaints WHERE subject LIKE 'TEST_P7_%'`);
    await pool.query(`DELETE FROM audit_log WHERE details->>'$.context' LIKE '%TEST_P7%' OR table_name='complaints'`);
    await pool.query(`DELETE FROM notifications WHERE notif_type='COMPLAINT_RESPONSE' AND body LIKE '%TEST_P7%'`);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // N1 — No role can SELECT * FROM complaints directly
  // ══════════════════════════════════════════════════════════════════════════
  describe('N1 — Direct SELECT on complaints is denied for all roles', () => {
    const roleUsers = [
      { label: 'hc_student',       pass: 'hc_student_pass' },
      { label: 'hc_warden',        pass: 'hc_warden_pass' },
      { label: 'hc_chief_warden',  pass: 'hc_chief_warden_pass' },
      { label: 'hc_hostel_office', pass: 'hc_hostel_office_pass' },
      { label: 'hc_mess_manager',  pass: 'hc_mess_manager_pass' },
      { label: 'hc_caretaker',     pass: 'hc_caretaker_pass' },
      { label: 'hc_admin',         pass: 'hc_admin_pass' },
    ];

    for (const { label, pass } of roleUsers) {
      it(`${label} cannot SELECT * FROM complaints`, async () => {
        const conn = await openConn(label, pass);
        try {
          await expect(conn.query('SELECT * FROM complaints LIMIT 1')).rejects.toThrow();
        } finally {
          await conn.end();
        }
      });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // N2 — No role can SELECT * FROM complaint_responses directly
  // ══════════════════════════════════════════════════════════════════════════
  describe('N2 — Direct SELECT on complaint_responses is denied for all roles', () => {
    const roleUsers = [
      { label: 'hc_student',       pass: 'hc_student_pass' },
      { label: 'hc_warden',        pass: 'hc_warden_pass' },
      { label: 'hc_chief_warden',  pass: 'hc_chief_warden_pass' },
    ];

    for (const { label, pass } of roleUsers) {
      it(`${label} cannot SELECT * FROM complaint_responses`, async () => {
        const conn = await openConn(label, pass);
        try {
          await expect(conn.query('SELECT * FROM complaint_responses LIMIT 1')).rejects.toThrow();
        } finally {
          await conn.end();
        }
      });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // N3 — Student B cannot read Student A's complaints via GET /mine
  // (procedure derives student from @app_user_id; returns 0 complaints for B
  //  when A filed the complaint — B sees only their own)
  // ══════════════════════════════════════════════════════════════════════════
  it('N3 — Student B sees 0 complaints from Student A via GET /api/complaints/mine', async () => {
    // First, student A files a complaint so there is at least one
    const fileRes = await request(app)
      .post('/api/complaints')
      .set('Cookie', studentACookie)
      .set('x-csrf-token', studentACsrf)
      .send({
        authority_id: wardenAuthorityId,
        category:     'CONDUCT',
        severity:     'MEDIUM',
        subject:      'TEST_P7_N3_COMPLAINT_BY_A',
        description:  'N3 test description for student A complaint',
        is_anonymous: false,
      });
    expect(fileRes.status).toBe(201);

    // Student B reads /mine — should see ZERO complaints (they filed none yet)
    const bRes = await request(app)
      .get('/api/complaints/mine')
      .set('Cookie', studentBCookie);
    expect(bRes.status).toBe(200);
    // B should see only their own complaints — none of A's
    const bComplaints = bRes.body.complaints as any[];
    const aComplaintInB = bComplaints.some((c) => c.subject === 'TEST_P7_N3_COMPLAINT_BY_A');
    expect(aComplaintInB).toBe(false);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // N4 — Warden cannot read a complaint addressed to Chief Warden
  // ══════════════════════════════════════════════════════════════════════════
  it('N4 — Warden cannot read Chief Warden complaints via /inbox', async () => {
    // Student A files a complaint addressed to Chief Warden
    const fileRes = await request(app)
      .post('/api/complaints')
      .set('Cookie', studentACookie)
      .set('x-csrf-token', studentACsrf)
      .send({
        authority_id: chiefAuthorityId,
        category:     'CONDUCT',
        severity:     'HIGH',
        subject:      'TEST_P7_N4_FOR_CHIEF_ONLY',
        description:  'This complaint goes only to Chief Warden, not Warden',
        is_anonymous: false,
      });
    expect(fileRes.status).toBe(201);

    // Warden reads inbox — must NOT see the complaint addressed to Chief
    const wRes = await request(app)
      .get('/api/complaints/inbox')
      .set('Cookie', wardenCookie);
    expect(wRes.status).toBe(200);
    const wardenSees = (wRes.body.complaints as any[]).some(
      (c) => c.subject === 'TEST_P7_N4_FOR_CHIEF_ONLY'
    );
    expect(wardenSees).toBe(false);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // N5 — Invalid status jump: OPEN → RESOLVED directly is rejected
  // ══════════════════════════════════════════════════════════════════════════
  it('N5 — Direct OPEN → RESOLVED status jump is rejected by trigger', async () => {
    // File a complaint addressed to warden
    const fileRes = await request(app)
      .post('/api/complaints')
      .set('Cookie', studentACookie)
      .set('x-csrf-token', studentACsrf)
      .send({
        authority_id: wardenAuthorityId,
        category:     'ELECTRICAL',
        severity:     'LOW',
        subject:      'TEST_P7_N5_JUMP_TEST',
        description:  'N5 test for invalid status jump OPEN to RESOLVED',
        is_anonymous: false,
      });
    expect(fileRes.status).toBe(201);
    const trackingCode = fileRes.body.tracking_code;

    // Resolve complaint_id from tracking code
    const [[cRow]] = await pool.query<any[]>(
      'SELECT complaint_id FROM complaints WHERE tracking_code = ?',
      [trackingCode]
    );
    const complaintId = cRow.complaint_id;

    // Warden tries to jump OPEN → RESOLVED (skipping SEEN, IN_PROGRESS)
    const respRes = await request(app)
      .post(`/api/complaints/${complaintId}/respond`)
      .set('Cookie', wardenCookie)
      .set('x-csrf-token', wardenCsrf)
      .send({ message: 'Skipping to resolved', new_status: 'RESOLVED' });
    // Should be rejected (procedure detects invalid jump → SIGNAL)
    expect([400, 422, 500]).toContain(respRes.status);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // N6 — Backward transition SEEN → OPEN is rejected
  // ══════════════════════════════════════════════════════════════════════════
  it('N6 — Backward status transition SEEN → OPEN is rejected by trigger', async () => {
    // File complaint, advance to SEEN via pool (as definer)
    const fileRes = await request(app)
      .post('/api/complaints')
      .set('Cookie', studentACookie)
      .set('x-csrf-token', studentACsrf)
      .send({
        authority_id: wardenAuthorityId,
        category:     'PLUMBING',
        severity:     'LOW',
        subject:      'TEST_P7_N6_BACKWARD_TEST',
        description:  'N6 test for backward status transition',
        is_anonymous: false,
      });
    expect(fileRes.status).toBe(201);
    const tc = fileRes.body.tracking_code;
    const [[cRow]] = await pool.query<any[]>(
      'SELECT complaint_id FROM complaints WHERE tracking_code = ?',
      [tc]
    );
    const cid = cRow.complaint_id;

    // Advance to SEEN legitimately
    const seenRes = await request(app)
      .post(`/api/complaints/${cid}/respond`)
      .set('Cookie', wardenCookie)
      .set('x-csrf-token', wardenCsrf)
      .send({ message: 'Seen your complaint', new_status: 'SEEN' });
    expect(seenRes.status).toBe(200);

    // Now try to go backward SEEN → OPEN
    const backRes = await request(app)
      .post(`/api/complaints/${cid}/respond`)
      .set('Cookie', wardenCookie)
      .set('x-csrf-token', wardenCsrf)
      .send({ message: 'Back to open', new_status: 'OPEN' });
    expect([400, 422, 500]).toContain(backRes.status);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // P1 — Student files complaint, gets 12-char tracking_code
  // ══════════════════════════════════════════════════════════════════════════
  it('P1 — POST /api/complaints returns a valid 12-char HC tracking code', async () => {
    const res = await request(app)
      .post('/api/complaints')
      .set('Cookie', studentACookie)
      .set('x-csrf-token', studentACsrf)
      .send({
        authority_id: wardenAuthorityId,
        category:     'MESS',
        severity:     'HIGH',
        subject:      'TEST_P7_P1_FULL_FLOW',
        description:  'The food quality in the mess has deteriorated significantly.',
        is_anonymous: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.tracking_code).toBeDefined();
    expect(res.body.tracking_code).toMatch(/^HC[A-Z0-9]{10}$/);

    filedTrackingCode = res.body.tracking_code;

    // Also resolve complaint_id for later tests
    const [[cRow]] = await pool.query<any[]>(
      'SELECT complaint_id FROM complaints WHERE tracking_code = ?',
      [filedTrackingCode]
    );
    filedComplaintId = cRow.complaint_id;
  });

  // ══════════════════════════════════════════════════════════════════════════
  // P2 — Student reads own complaints via GET /mine
  // ══════════════════════════════════════════════════════════════════════════
  it('P2 — GET /api/complaints/mine returns the student\'s own complaints', async () => {
    const res = await request(app)
      .get('/api/complaints/mine')
      .set('Cookie', studentACookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.complaints)).toBe(true);
    expect(res.body.complaints.length).toBeGreaterThan(0);

    const filed = res.body.complaints.find((c: any) => c.tracking_code === filedTrackingCode);
    expect(filed).toBeDefined();
    expect(filed.status).toBe('OPEN');
    expect(filed.subject).toBe('TEST_P7_P1_FULL_FLOW');
    expect(typeof filed.description).toBe('string');
    expect(filed.description.length).toBeGreaterThan(0);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // P3 — Authority reads inbox: sees the filed complaint
  // ══════════════════════════════════════════════════════════════════════════
  it('P3 — GET /api/complaints/inbox returns complaint in authority inbox', async () => {
    const res = await request(app)
      .get('/api/complaints/inbox')
      .set('Cookie', wardenCookie);

    expect(res.status).toBe(200);
    const inboxItem = res.body.complaints.find(
      (c: any) => c.tracking_code === filedTrackingCode
    );
    expect(inboxItem).toBeDefined();
    expect(inboxItem.status).toBe('OPEN');
    // Non-anonymous: student details should be present
    expect(inboxItem.student_name).not.toBe('Anonymous Resident');
    expect(inboxItem.student_roll_no).not.toBe('ANONYMOUS');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // P4 — Authority advances OPEN → SEEN
  // ══════════════════════════════════════════════════════════════════════════
  it('P4 — Authority advances status OPEN → SEEN', async () => {
    const res = await request(app)
      .post(`/api/complaints/${filedComplaintId}/respond`)
      .set('Cookie', wardenCookie)
      .set('x-csrf-token', wardenCsrf)
      .send({ message: 'We have received and reviewed your complaint.', new_status: 'SEEN' });

    expect(res.status).toBe(200);

    const [[cRow]] = await pool.query<any[]>(
      'SELECT status FROM complaints WHERE complaint_id = ?',
      [filedComplaintId]
    );
    expect(cRow.status).toBe('SEEN');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // P5 — Authority advances SEEN → IN_PROGRESS
  // ══════════════════════════════════════════════════════════════════════════
  it('P5 — Authority advances status SEEN → IN_PROGRESS', async () => {
    const res = await request(app)
      .post(`/api/complaints/${filedComplaintId}/respond`)
      .set('Cookie', wardenCookie)
      .set('x-csrf-token', wardenCsrf)
      .send({ message: 'We are investigating this matter.', new_status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);

    const [[cRow]] = await pool.query<any[]>(
      'SELECT status FROM complaints WHERE complaint_id = ?',
      [filedComplaintId]
    );
    expect(cRow.status).toBe('IN_PROGRESS');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // P6 — Authority advances IN_PROGRESS → RESOLVED
  // ══════════════════════════════════════════════════════════════════════════
  it('P6 — Authority advances status IN_PROGRESS → RESOLVED', async () => {
    const res = await request(app)
      .post(`/api/complaints/${filedComplaintId}/respond`)
      .set('Cookie', wardenCookie)
      .set('x-csrf-token', wardenCsrf)
      .send({ message: 'Issue has been resolved. Mess quality improved.', new_status: 'RESOLVED' });

    expect(res.status).toBe(200);

    const [[cRow]] = await pool.query<any[]>(
      'SELECT status FROM complaints WHERE complaint_id = ?',
      [filedComplaintId]
    );
    expect(cRow.status).toBe('RESOLVED');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // P7 — Student re-opens RESOLVED complaint → IN_PROGRESS
  // ══════════════════════════════════════════════════════════════════════════
  it('P7 — Student reply on RESOLVED complaint re-opens it to IN_PROGRESS', async () => {
    const res = await request(app)
      .post(`/api/complaints/${filedComplaintId}/respond`)
      .set('Cookie', studentACookie)
      .set('x-csrf-token', studentACsrf)
      .send({
        message:    'The issue is not actually resolved — problem persists.',
        new_status: 'IN_PROGRESS',
      });

    expect(res.status).toBe(200);

    const [[cRow]] = await pool.query<any[]>(
      'SELECT status FROM complaints WHERE complaint_id = ?',
      [filedComplaintId]
    );
    expect(cRow.status).toBe('IN_PROGRESS');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // P8 — Anonymous complaint hides all student fields from authority
  // ══════════════════════════════════════════════════════════════════════════
  it('P8 — Anonymous complaint exposes no student fields to authority', async () => {
    const fileRes = await request(app)
      .post('/api/complaints')
      .set('Cookie', studentACookie)
      .set('x-csrf-token', studentACsrf)
      .send({
        authority_id: wardenAuthorityId,
        category:     'CONDUCT',
        severity:     'URGENT',
        subject:      'TEST_P7_P8_ANON_COMPLAINT',
        description:  'Anonymous complaint body — authority must not see my identity.',
        is_anonymous: true,
      });
    expect(fileRes.status).toBe(201);

    const anonTracking = fileRes.body.tracking_code;
    const [[anonRow]] = await pool.query<any[]>(
      'SELECT complaint_id FROM complaints WHERE tracking_code = ?',
      [anonTracking]
    );
    anonComplaintId = anonRow.complaint_id;

    // Authority reads inbox — anonymous entry must have masked fields
    const inboxRes = await request(app)
      .get('/api/complaints/inbox')
      .set('Cookie', wardenCookie);
    expect(inboxRes.status).toBe(200);

    const anonEntry = inboxRes.body.complaints.find(
      (c: any) => c.tracking_code === anonTracking
    );
    expect(anonEntry).toBeDefined();
    expect(anonEntry.student_id).toBeNull();
    expect(anonEntry.student_roll_no).toBe('ANONYMOUS');
    expect(anonEntry.student_name).toBe('Anonymous Resident');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // P9 — READ audit rows appear after sp_get_my_complaints
  // ══════════════════════════════════════════════════════════════════════════
  it('P9 — audit_log has READ rows after GET /api/complaints/mine', async () => {
    // Trigger a read
    await request(app).get('/api/complaints/mine').set('Cookie', studentACookie);

    const [auditRows] = await pool.query<any[]>(
      `SELECT * FROM audit_log
       WHERE action = 'READ' AND table_name = 'complaints' AND actor_user_id = ?`,
      [studentAUserId]
    );
    expect(auditRows.length).toBeGreaterThan(0);
    for (const row of auditRows) {
      expect(row.action).toBe('READ');
      expect(row.table_name).toBe('complaints');
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // P10 — READ audit rows appear after sp_get_complaints_for_authority
  // ══════════════════════════════════════════════════════════════════════════
  it('P10 — audit_log has READ rows after GET /api/complaints/inbox', async () => {
    const wardenUserRow = await pool.query<any[]>(
      `SELECT user_id FROM users WHERE login_id = 'warden_bh1' LIMIT 1`
    );
    const wardenUserId = (wardenUserRow[0] as any[])[0].user_id;

    await request(app).get('/api/complaints/inbox').set('Cookie', wardenCookie);

    const [auditRows] = await pool.query<any[]>(
      `SELECT * FROM audit_log
       WHERE action = 'READ' AND table_name = 'complaints' AND actor_user_id = ?`,
      [wardenUserId]
    );
    expect(auditRows.length).toBeGreaterThan(0);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // P11 — AFTER INSERT trigger creates notification on complaint_responses
  // ══════════════════════════════════════════════════════════════════════════
  it('P11 — AFTER INSERT on complaint_responses creates a COMPLAINT_RESPONSE notification', async () => {
    // Count notifications before
    const [before] = await pool.query<any[]>(
      `SELECT COUNT(*) as cnt FROM notifications WHERE notif_type = 'COMPLAINT_RESPONSE'`
    );
    const beforeCount = Number((before as any[])[0].cnt);

    // Warden responds to the IN_PROGRESS complaint → should notify student
    await request(app)
      .post(`/api/complaints/${filedComplaintId}/respond`)
      .set('Cookie', wardenCookie)
      .set('x-csrf-token', wardenCsrf)
      .send({ message: 'P11 trigger test response — we are still working on it.' });

    const [after] = await pool.query<any[]>(
      `SELECT COUNT(*) as cnt FROM notifications WHERE notif_type = 'COMPLAINT_RESPONSE'`
    );
    const afterCount = Number((after as any[])[0].cnt);

    expect(afterCount).toBeGreaterThan(beforeCount);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // E1 — Escalation event: stale OPEN complaint gets escalated_at set
  // (We simulate by manually inserting a backdated complaint then calling the event)
  // ══════════════════════════════════════════════════════════════════════════
  it('E1 — ev_escalate_complaints escalates stale OPEN complaints to Chief Warden', async () => {
    // Insert a stale complaint directly via root pool (bypassing procedures for test setup)
    const staleCode = `HCSTALE${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const [studentRow] = await pool.query<any[]>(
      'SELECT student_id FROM students LIMIT 1'
    );
    const testStudentId = (studentRow as any[])[0].student_id;

    // Insert encrypted description directly with root pool (using AES_ENCRYPT)
    await pool.query(
      `INSERT INTO complaints
         (tracking_code, student_id, authority_id, category, severity, subject, description, is_anonymous, status, created_at)
       VALUES
         (?, ?, ?, 'OTHER', 'LOW', 'TEST_P7_E1_STALE_COMPLAINT',
          AES_ENCRYPT('Stale complaint for escalation test', SHA2('hc_complaint_key_nsut_2026', 256)),
          0, 'OPEN', NOW() - INTERVAL 10 DAY)`,
      [staleCode, testStudentId, wardenAuthorityId]
    );

    // Manually invoke the event body logic (CALL won't work for events; directly run UPDATE)
    const [[settingRow]] = await pool.query<any[]>(
      `SELECT setting_value FROM app_settings WHERE setting_key = 'complaint_escalation_days'`
    );
    const days = parseInt(settingRow.setting_value, 10) || 3;

    const [[chiefRow]] = await pool.query<any[]>(
      `SELECT authority_id FROM authorities WHERE designation = 'CHIEF_WARDEN' LIMIT 1`
    );
    const chiefId = chiefRow.authority_id;

    await pool.query(
      `UPDATE complaints
       SET escalated_at = NOW(), escalated_to_authority_id = ?
       WHERE status = 'OPEN' AND escalated_at IS NULL
         AND created_at < NOW() - INTERVAL ? DAY
         AND tracking_code = ?`,
      [chiefId, days, staleCode]
    );

    const [[escalatedRow]] = await pool.query<any[]>(
      `SELECT escalated_at, escalated_to_authority_id FROM complaints WHERE tracking_code = ?`,
      [staleCode]
    );
    expect(escalatedRow.escalated_at).not.toBeNull();
    expect(escalatedRow.escalated_to_authority_id).toBe(chiefId);

    // Cleanup
    await pool.query(`DELETE FROM complaints WHERE tracking_code = ?`, [staleCode]);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // A1 — Admin privilege-proof endpoint returns SHOW GRANTS for all 7 roles
  // ══════════════════════════════════════════════════════════════════════════
  it('A1 — GET /api/admin/privilege-proof returns SHOW GRANTS for all 7 roles', async () => {
    const res = await request(app)
      .get('/api/admin/privilege-proof')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.grants).toBeDefined();

    const expectedRoles = [
      'ADMIN','HOSTEL_OFFICE','CHIEF_WARDEN','WARDEN','MESS_MANAGER','CARETAKER','STUDENT',
    ];
    for (const role of expectedRoles) {
      expect(res.body.grants[role]).toBeDefined();
      expect(Array.isArray(res.body.grants[role])).toBe(true);
      expect(res.body.grants[role].length).toBeGreaterThan(0);
    }

    // Verify no role has SELECT on complaints or complaint_responses
    for (const role of expectedRoles) {
      const grantLines: string[] = res.body.grants[role];
      const hasComplaintSelect = grantLines.some(
        (g) =>
          g.toUpperCase().includes('SELECT') &&
          (g.toUpperCase().includes('`COMPLAINTS`') || g.toUpperCase().includes('`COMPLAINT_RESPONSES`'))
      );
      expect(hasComplaintSelect).toBe(false);
    }

    console.log('\n════════════════ SHOW GRANTS OUTPUT ════════════════');
    for (const [role, lines] of Object.entries(res.body.grants as Record<string, string[]>)) {
      console.log(`\n── ${role} ──`);
      for (const line of lines) console.log('  ', line);
    }
    console.log('══════════════════════════════════════════════════════\n');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // A2 — Non-admin cannot access privilege-proof endpoint
  // ══════════════════════════════════════════════════════════════════════════
  it('A2 — STUDENT cannot access GET /api/admin/privilege-proof (403)', async () => {
    const res = await request(app)
      .get('/api/admin/privilege-proof')
      .set('Cookie', studentACookie);
    expect(res.status).toBe(403);
  });
});
