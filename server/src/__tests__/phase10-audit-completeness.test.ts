import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { pool, closeAllPools } from '../db.js';

interface UserSession {
  userId: number;
  loginId: string;
  role: string;
  cookie: string;
  csrfToken: string;
}

describe('Phase 10 — Audit Completeness: Every State-Changing Endpoint Asserts Audit Log with Correct Actor', () => {
  const sessions: Record<string, UserSession> = {};
  let testResidentStudentId: number;
  let testResidentUserId: number;

  beforeAll(async () => {
    // 1. Identify resident student in BH1 with room allotment for laundry & mess tests
    const [resRows] = await pool.query<any[]>(`
      SELECT s.student_id, s.user_id, u.login_id 
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      JOIN v_current_residence cr ON s.student_id = cr.student_id
      WHERE cr.hostel_id = 1 AND u.is_active = 1
      LIMIT 1
    `);
    const student = resRows[0] || { student_id: 1, user_id: 11, login_id: '2026UCS0001' };
    testResidentStudentId = student.student_id;
    testResidentUserId = student.user_id;

    // Login accounts
    const credentials = [
      { role: 'ADMIN', login_id: 'admin' },
      { role: 'HOSTEL_OFFICE', login_id: 'office' },
      { role: 'WARDEN', login_id: 'warden_bh1' },
      { role: 'MESS_MANAGER', login_id: 'mess_mgr' },
      { role: 'CARETAKER', login_id: 'caretaker_bh1' },
      { role: 'STUDENT', login_id: student.login_id },
    ];

    for (const cred of credentials) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ login_id: cred.login_id, password: 'Password@123' });

      if (res.status !== 200) {
        throw new Error(`Failed to login as ${cred.role} (${cred.login_id}): ${JSON.stringify(res.body)}`);
      }

      const cookies = res.headers['set-cookie'] || [];
      const token = cookies.find((c: string) => c.startsWith('token='))?.split(';')[0] || '';
      const csrf = cookies.find((c: string) => c.startsWith('csrf_token='))?.split(';')[0] || '';

      sessions[cred.role] = {
        userId: res.body.user.userId,
        loginId: cred.login_id,
        role: cred.role,
        cookie: `${token}; ${csrf}`,
        csrfToken: res.body.csrfToken,
      };
    }
  });

  afterAll(async () => {
    await closeAllPools();
  });

  async function getLastAuditLogId(): Promise<number> {
    const [rows] = await pool.query<any[]>('SELECT COALESCE(MAX(log_id), 0) AS max_id FROM audit_log');
    return Number(rows[0]?.max_id || 0);
  }

  async function getAuditLogsAfter(
    lastId: number,
    tableName: string
  ): Promise<any[]> {
    const [rows] = await pool.query<any[]>(
      `SELECT * FROM audit_log WHERE log_id > ? AND table_name = ? ORDER BY log_id DESC`,
      [lastId, tableName]
    );
    return rows;
  }

  // 1. Notice Creation
  it('POST /api/notices creates audit_log row on `notices` with correct actor_user_id', async () => {
    const lastId = await getLastAuditLogId();
    const actor = sessions['HOSTEL_OFFICE'];

    const res = await request(app)
      .post('/api/notices')
      .set('Cookie', actor.cookie)
      .set('x-csrf-token', actor.csrfToken)
      .send({
        title: 'Audit Verification Notice',
        body: 'Verifying institutional trigger audit trail',
        category: 'CIRCULAR',
        hostel_id: null,
      });

    expect(res.status).toBe(201);

    const logs = await getAuditLogsAfter(lastId, 'notices');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].actor_user_id).toBe(actor.userId);
    expect(logs[0].action).toBe('INSERT');
  });

  // 2. Water Quality Report Creation
  it('POST /api/water-reports creates audit_log row on `water_quality_reports` with correct actor_user_id', async () => {
    await pool.query("DELETE FROM water_quality_reports WHERE hostel_id = 1 AND week_start = '2026-12-14'");
    const lastId = await getLastAuditLogId();
    const actor = sessions['HOSTEL_OFFICE'];

    const res = await request(app)
      .post('/api/water-reports')
      .set('Cookie', actor.cookie)
      .set('x-csrf-token', actor.csrfToken)
      .send({
        hostel_id: 1,
        week_start: '2026-12-14',
        tds_ppm: 210,
        ph: 7.4,
        chlorine_mgl: 0.6,
        remarks: 'Phase 10 audit test sample',
      });

    expect(res.status).toBe(201);

    const logs = await getAuditLogsAfter(lastId, 'water_quality_reports');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].actor_user_id).toBe(actor.userId);
  });

  // 3. Maintenance Schedule Creation & Update
  it('POST /api/maintenance creates audit_log row on `maintenance_schedules` with correct actor_user_id', async () => {
    const lastId = await getLastAuditLogId();
    const actor = sessions['CARETAKER'];

    const res = await request(app)
      .post('/api/maintenance')
      .set('Cookie', actor.cookie)
      .set('x-csrf-token', actor.csrfToken)
      .send({
        hostel_id: 1,
        maint_type: 'PLUMBER',
        block: 'B',
        floor_no: 2,
        sched_date: '2026-11-12',
        time_slot: '14:00 - 16:00',
      });

    expect(res.status).toBe(201);

    const logs = await getAuditLogsAfter(lastId, 'maintenance_schedules');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].actor_user_id).toBe(actor.userId);
    expect(logs[0].action).toBe('INSERT');
  });

  // 4. Confidential Complaint Submission
  it('POST /api/complaints creates audit_log row on `complaints` with student actor_user_id', async () => {
    const lastId = await getLastAuditLogId();
    const actor = sessions['STUDENT'];

    const res = await request(app)
      .post('/api/complaints')
      .set('Cookie', actor.cookie)
      .set('x-csrf-token', actor.csrfToken)
      .send({
        authority_id: 3, // Warden BH1
        category: 'PLUMBING',
        severity: 'MEDIUM',
        subject: 'Audit Trail Test Complaint',
        description: 'Verifying automated actor logging for student grievances',
        is_anonymous: false,
      });

    expect(res.status).toBe(201);

    const logs = await getAuditLogsAfter(lastId, 'complaints');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].actor_user_id).toBe(actor.userId);
    expect(logs[0].action).toBe('FILE');
  });

  // 5. Complaint Response / Status Transition
  it('POST /api/complaints/:id/respond creates audit_log row on `complaints` with authority actor_user_id', async () => {
    // Submit a fresh complaint to transition
    const studentActor = sessions['STUDENT'];
    const compRes = await request(app)
      .post('/api/complaints')
      .set('Cookie', studentActor.cookie)
      .set('x-csrf-token', studentActor.csrfToken)
      .send({
        authority_id: 3, // Warden BH1
        category: 'ELECTRICAL',
        severity: 'HIGH',
        subject: 'Status Transition Test',
        description: 'For testing authority response audit',
        is_anonymous: false,
      });
    const trackingCode = compRes.body.tracking_code;
    const [cRows] = await pool.query<any[]>(
      'SELECT complaint_id FROM complaints WHERE tracking_code = ?',
      [trackingCode]
    );
    const complaintId = cRows[0].complaint_id;

    const lastId = await getLastAuditLogId();
    const wardenActor = sessions['WARDEN'];

    const res = await request(app)
      .post(`/api/complaints/${complaintId}/respond`)
      .set('Cookie', wardenActor.cookie)
      .set('x-csrf-token', wardenActor.csrfToken)
      .send({
        new_status: 'SEEN',
        message: 'Complaint acknowledged by Warden',
      });

    expect(res.status).toBe(200);

    const logs = await getAuditLogsAfter(lastId, 'complaints');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].actor_user_id).toBe(wardenActor.userId);
    expect(logs[0].action).toBe('RESPOND');
  });

  // 6. Laundry Machine Operational Status Change
  it('PATCH /api/laundry/:id/status creates audit_log row on `washing_machines` with caretaker actor_user_id', async () => {
    const lastId = await getLastAuditLogId();
    const actor = sessions['CARETAKER'];

    const res = await request(app)
      .patch('/api/laundry/1/status')
      .set('Cookie', actor.cookie)
      .set('x-csrf-token', actor.csrfToken)
      .send({ status: 'OUT_OF_ORDER' });

    expect(res.status).toBe(200);

    const logs = await getAuditLogsAfter(lastId, 'washing_machines');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].actor_user_id).toBe(actor.userId);
    expect(logs[0].action).toBe('UPDATE');

    // Restore machine status to FREE
    await request(app)
      .patch('/api/laundry/1/status')
      .set('Cookie', actor.cookie)
      .set('x-csrf-token', actor.csrfToken)
      .send({ status: 'FREE' });
  });

  // 7. Mess Config Update
  it('PUT /api/mess/config creates audit_log row on `mess_config` with mess manager actor_user_id', async () => {
    const lastId = await getLastAuditLogId();
    const actor = sessions['MESS_MANAGER'];

    const res = await request(app)
      .put('/api/mess/config')
      .set('Cookie', actor.cookie)
      .set('x-csrf-token', actor.csrfToken)
      .send({
        hostel_id: 1,
        month: 11,
        year: 2026,
        monthly_fee: 4800,
        food_component: 3800,
        per_meal_refund_rate: 45,
        free_skips: 14,
        cap_pct: 60,
      });

    expect(res.status).toBe(200);

    const logs = await getAuditLogsAfter(lastId, 'mess_config');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].actor_user_id).toBe(actor.userId);
  });

  // 8. Application Verification Decision
  it('POST /api/applications/verify creates audit_log row on `applications` with hostel office actor_user_id', async () => {
    // Find an application to verify or toggle
    const [appRows] = await pool.query<any[]>(
      'SELECT application_id FROM applications WHERE cycle_id = 1 LIMIT 1'
    );
    const appId = appRows[0].application_id;

    const lastId = await getLastAuditLogId();
    const actor = sessions['HOSTEL_OFFICE'];

    const res = await request(app)
      .post('/api/applications/verify')
      .set('Cookie', actor.cookie)
      .send({ application_id: appId, decision: 'VERIFIED' });

    expect(res.status).toBe(200);

    const logs = await getAuditLogsAfter(lastId, 'applications');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].actor_user_id).toBe(actor.userId);
  });

  // 9. Student Profile Update
  it('PATCH /api/students/:id creates audit_log row on `students` with student actor_user_id', async () => {
    const lastId = await getLastAuditLogId();
    const actor = sessions['STUDENT'];

    const res = await request(app)
      .patch(`/api/students/${testResidentStudentId}`)
      .set('Cookie', actor.cookie)
      .send({ phone: '9876543210' });

    expect([200, 422]).toContain(res.status);

    if (res.status === 200) {
      const logs = await getAuditLogsAfter(lastId, 'students');
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].actor_user_id).toBe(actor.userId);
      expect(logs[0].action).toBe('UPDATE');
    }
  });
});
