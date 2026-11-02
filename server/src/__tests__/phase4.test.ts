import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { pool, withRequestConn } from '../db.js';

describe('Phase 4: Students, Applications & Verification', () => {
  let adminCookie: string;
  let officeCookie: string;
  let wardenBh1Cookie: string;
  let studentCookie: string;
  let studentUserId: number;
  let studentId: number;

  beforeAll(async () => {
    // 1. Login ADMIN
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: 'admin', password: 'Password@123' });
    adminCookie = adminRes.headers['set-cookie'][0];

    // 2. Login HOSTEL_OFFICE
    const officeRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: 'office', password: 'Password@123' });
    officeCookie = officeRes.headers['set-cookie'][0];

    // 3. Login WARDEN BH1
    const wardenRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: 'warden_bh1', password: 'Password@123' });
    wardenBh1Cookie = wardenRes.headers['set-cookie'][0];

    // 4. Login STUDENT (2026UCSDS0001)
    const studentRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: '2026UCSDS0001', password: 'Password@123' });
    studentCookie = studentRes.headers['set-cookie'][0];

    // Fetch student info
    const [sRows] = await pool.query<any[]>(
      'SELECT student_id, user_id FROM students WHERE roll_no = ?',
      ['2026UCSDS0001']
    );
    studentId = sRows[0].student_id;
    studentUserId = sRows[0].user_id;

    // Create an OPEN cycle 999 for testing submissions
    await pool.query(`
      INSERT INTO allotment_cycles (cycle_id, academic_year, status, opened_on)
      VALUES (999, '2027-28', 'OPEN', CURDATE())
      ON DUPLICATE KEY UPDATE status = 'OPEN';
    `);
  });

  afterAll(async () => {
    // Clean up test cycle and any test applications
    await pool.query('DELETE FROM audit_log WHERE table_name = "applications" AND details LIKE "%999%"');
    await pool.query('DELETE FROM applications WHERE cycle_id = 999');
    await pool.query('DELETE FROM allotment_cycles WHERE cycle_id = 999');
  });

  // --------------------------------------------------------------------------
  // 1. Lookups API
  // --------------------------------------------------------------------------
  describe('1. Lookups API', () => {
    it('GET /api/lookups/states should return Indian states', async () => {
      const res = await request(app).get('/api/lookups/states');
      expect(res.status).toBe(200);
      expect(res.body.states).toBeDefined();
      expect(res.body.states.length).toBeGreaterThan(10);
      expect(res.body.states.some((s: any) => s.state_name === 'Delhi')).toBe(true);
    });

    it('GET /api/lookups/cities should return cities, with optional state_id filter', async () => {
      const allRes = await request(app).get('/api/lookups/cities');
      expect(allRes.status).toBe(200);
      expect(allRes.body.cities.length).toBeGreaterThan(20);

      const delhiRes = await request(app).get('/api/lookups/cities?state_id=1');
      expect(delhiRes.status).toBe(200);
      expect(delhiRes.body.cities.every((c: any) => c.state_id === 1)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Database Procedures: sp_submit_application
  // --------------------------------------------------------------------------
  describe('2. Stored Routine: sp_submit_application', () => {
    it('should submit an application for an OPEN cycle and compute Haversine distance', async () => {
      // Pick student 1200 who hasn't applied to cycle 999
      const [res] = await pool.query<any[]>('CALL sp_submit_application(1200, 999)');
      const appRecord = res[0][0];

      expect(appRecord).toBeDefined();
      expect(appRecord.cycle_id).toBe(999);
      expect(appRecord.student_id).toBe(1200);
      expect(Number(appRecord.distance_km)).toBeGreaterThan(0);
      expect([1, 2, 3, 4]).toContain(appRecord.distance_band);
      expect(appRecord.verification_status).toBe('PENDING');
    });

    it('should reject duplicate applications for the same student in the same cycle', async () => {
      await expect(pool.query('CALL sp_submit_application(1200, 999)')).rejects.toThrow(
        /An application for this student in this cycle already exists/
      );
    });

    it('should reject application submission when cycle is not OPEN (e.g. cycle 1 is ALLOTTED)', async () => {
      await expect(pool.query('CALL sp_submit_application(1201, 1)')).rejects.toThrow(
        /Allotment cycle is not open for applications/
      );
    });
  });

  // --------------------------------------------------------------------------
  // 3. Database Procedures: sp_verify_application & sp_bulk_verify
  // --------------------------------------------------------------------------
  describe('3. Stored Routine: Verification & Atomic Bulk Verification', () => {
    let testAppId: number;

    beforeAll(async () => {
      const [res] = await pool.query<any[]>('SELECT application_id FROM applications WHERE cycle_id = 999 LIMIT 1');
      testAppId = res[0].application_id;
    });

    it('should verify a single application and record an audit log entry', async () => {
      await withRequestConn('HOSTEL_OFFICE', 2, async (conn) => {
        const [callRes] = await conn.query<any[]>('CALL sp_verify_application(?, "VERIFIED")', [testAppId]);
        expect(callRes[0][0].verification_status).toBe('VERIFIED');
      });

      // Check audit_log
      const [auditRows] = await pool.query<any[]>(
        'SELECT * FROM audit_log WHERE table_name = "applications" AND record_id = ? AND action = "VERIFY_APPLICATION"',
        [testAppId]
      );
      expect(auditRows.length).toBeGreaterThan(0);
      expect(auditRows[0].details.decision).toBe('VERIFIED');
    });

    it('should bulk verify applications atomically in one transaction with audit log', async () => {
      // Submit a second test application in cycle 999
      await pool.query('CALL sp_submit_application(1202, 999)');
      const [twoApps] = await pool.query<any[]>(
        'SELECT application_id FROM applications WHERE cycle_id = 999 ORDER BY application_id DESC LIMIT 2'
      );
      const appIds = twoApps.map((a) => a.application_id);

      await withRequestConn('HOSTEL_OFFICE', 2, async (conn) => {
        const [bulkRes] = await conn.query<any[]>(
          'CALL sp_bulk_verify(?, "REJECTED")',
          [JSON.stringify(appIds)]
        );
        expect(bulkRes[0][0].updated_count).toBe(2);
      });

      // Verify statuses updated
      const [verifiedRows] = await pool.query<any[]>(
        `SELECT verification_status FROM applications WHERE application_id IN (${appIds.join(',')})`
      );
      expect(verifiedRows.every((r) => r.verification_status === 'REJECTED')).toBe(true);

      // Verify audit record
      const [bulkAudit] = await pool.query<any[]>(
        'SELECT * FROM audit_log WHERE action = "BULK_VERIFY_APPLICATIONS" ORDER BY log_id DESC LIMIT 1'
      );
      expect(bulkAudit.length).toBe(1);
      expect(bulkAudit[0].details.decision).toBe('REJECTED');
      expect(bulkAudit[0].details.updated_count).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Role-Scoped Views: v_scoped_students & v_scoped_applications
  // --------------------------------------------------------------------------
  describe('4. Role-Scoped Views', () => {
    it('ADMIN and HOSTEL_OFFICE should see all 2,000 students', async () => {
      await withRequestConn('HOSTEL_OFFICE', 2, async (conn) => {
        const [rows] = await conn.query<any[]>('SELECT COUNT(*) AS c FROM v_scoped_students');
        expect(Number(rows[0].c)).toBe(2000);
      });

      await withRequestConn('ADMIN', 1, async (conn) => {
        const [rows] = await conn.query<any[]>('SELECT COUNT(*) AS c FROM v_scoped_students');
        expect(Number(rows[0].c)).toBe(2000);
      });
    });

    it('WARDEN BH1 should only see residents of Boys Hostel 1', async () => {
      await withRequestConn('WARDEN', 4, async (conn) => {
        const [rows] = await conn.query<any[]>('SELECT COUNT(*) AS c, MIN(hostel_id) AS min_h, MAX(hostel_id) AS max_h FROM v_scoped_students');
        expect(Number(rows[0].c)).toBe(84); // 84 residents allotted in BH1
        expect(rows[0].min_h).toBe(1);
        expect(rows[0].max_h).toBe(1);
      });
    });

    it('STUDENT should only see their own profile', async () => {
      await withRequestConn('STUDENT', studentUserId, async (conn) => {
        const [rows] = await conn.query<any[]>('SELECT COUNT(*) AS c, MAX(roll_no) AS roll FROM v_scoped_students');
        expect(Number(rows[0].c)).toBe(1);
        expect(rows[0].roll).toBe('2026UCSDS0001');
      });
    });
  });

  // --------------------------------------------------------------------------
  // 5. REST API: /api/students
  // --------------------------------------------------------------------------
  describe('5. REST API: GET and PATCH /api/students', () => {
    it('GET /api/students should support keyset pagination of 50 rows with total count', async () => {
      const res = await request(app)
        .get('/api/students?limit=50&sort_by=roll_no&sort_order=asc')
        .set('Cookie', officeCookie);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(50);
      expect(res.body.total).toBe(2000);
      expect(res.body.hasMore).toBe(true);
      expect(res.body.nextCursor).toBeDefined();

      // Fetch next page via cursor
      const page2 = await request(app)
        .get(`/api/students?limit=50&sort_by=roll_no&sort_order=asc&cursor=${res.body.nextCursor}`)
        .set('Cookie', officeCookie);

      expect(page2.status).toBe(200);
      expect(page2.body.items).toHaveLength(50);
      // Verify no duplicate keys across page boundary
      expect(page2.body.items[0].roll_no > res.body.items[49].roll_no).toBe(true);
    });

    it('GET /api/students should support server-side search and filters', async () => {
      const res = await request(app)
        .get('/api/students?search=Aarav&gender=M&branch=IT')
        .set('Cookie', officeCookie);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(res.body.items.every((s: any) => s.gender === 'M' && s.branch === 'IT')).toBe(true);
    });

    it('GET /api/students/:id should return student details and application history', async () => {
      const res = await request(app)
        .get(`/api/students/${studentId}`)
        .set('Cookie', officeCookie);

      expect(res.status).toBe(200);
      expect(res.body.student_id).toBe(studentId);
      expect(res.body.roll_no).toBe('2026UCSDS0001');
      expect(res.body.applications).toBeDefined();
    });

    it('PATCH /api/students/:id should reject study habit change if an application exists', async () => {
      // Student 1 has an application in cycle 1
      const res = await request(app)
        .patch(`/api/students/${studentId}`)
        .set('Cookie', studentCookie)
        .send({ study_habit: 'NIGHT' });

      // trg_students_before_update triggers 45000 -> mapped to HTTP 422
      expect(res.status).toBe(422);
      expect(res.body.message).toMatch(/Study habit cannot be changed once an application has been submitted/);
    });
  });

  // --------------------------------------------------------------------------
  // 6. REST API: /api/applications & CSV Export
  // --------------------------------------------------------------------------
  describe('6. REST API: /api/applications', () => {
    it('GET /api/applications should filter by cycle, status, band, and return keyset pagination', async () => {
      const res = await request(app)
        .get('/api/applications?cycle_id=1&verification_status=PENDING&limit=50')
        .set('Cookie', officeCookie);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(120); // 120 pending applications seeded in cycle 1
      expect(res.body.items).toHaveLength(50);
      expect(res.body.hasMore).toBe(true);
      expect(res.body.items.every((a: any) => a.verification_status === 'PENDING')).toBe(true);
    });

    it('GET /api/applications/kpis should return live KPI counts', async () => {
      const res = await request(app)
        .get('/api/applications/kpis?cycle_id=1')
        .set('Cookie', officeCookie);

      expect(res.status).toBe(200);
      expect(res.body.totalApplications).toBe(1150);
      expect(res.body.pendingVerification).toBe(120);
      expect(res.body.verifiedApplications).toBe(950);
      expect(res.body.rejectedApplications).toBe(80);
      expect(res.body.totalStudents).toBe(2000);
      expect(res.body.totalCapacity).toBe(300);
    });

    it('POST /api/applications/verify should handle single verification via endpoint', async () => {
      // Create a test application in cycle 999 for endpoint testing
      await pool.query('CALL sp_submit_application(1205, 999)');
      const [pending] = await pool.query<any[]>(
        'SELECT application_id FROM applications WHERE cycle_id = 999 AND student_id = 1205 LIMIT 1'
      );
      const appId = pending[0].application_id;

      const res = await request(app)
        .post('/api/applications/verify')
        .set('Cookie', officeCookie)
        .send({ application_id: appId, decision: 'VERIFIED' });

      expect(res.status).toBe(200);
      expect(res.body.decision).toBe('VERIFIED');
    });

    it('POST /api/applications/verify should handle bulk verification via endpoint', async () => {
      await pool.query('CALL sp_submit_application(1206, 999)');
      await pool.query('CALL sp_submit_application(1207, 999)');
      const [pending] = await pool.query<any[]>(
        'SELECT application_id FROM applications WHERE cycle_id = 999 AND student_id IN (1206, 1207)'
      );
      const appIds = pending.map((p) => p.application_id);

      const res = await request(app)
        .post('/api/applications/verify')
        .set('Cookie', officeCookie)
        .send({ application_ids: appIds, decision: 'REJECTED' });

      expect(res.status).toBe(200);
      expect(res.body.updatedCount).toBe(2);
      expect(res.body.decision).toBe('REJECTED');
    });

    it('GET /api/applications/export should reject non-staff roles with 403', async () => {
      const res = await request(app)
        .get('/api/applications/export?cycle_id=1')
        .set('Cookie', studentCookie);

      expect(res.status).toBe(403);
    });

    it('GET /api/applications/export should return CSV data for HOSTEL_OFFICE and ADMIN', async () => {
      const res = await request(app)
        .get('/api/applications/export?cycle_id=1&verification_status=VERIFIED')
        .set('Cookie', officeCookie);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment; filename=');
      expect(res.text).toContain('Application ID,Roll Number,Full Name');
      expect(res.text.split('\r\n').length).toBeGreaterThan(900); // 950 verified applications
    });
  });
});
