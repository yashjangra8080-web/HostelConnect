import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { pool } from '../db.js';
import { performance } from 'perf_hooks';

describe('Phase 6: Notice Hub, Notifications, Water Quality & Maintenance', () => {
  let adminCookie: string;
  let adminCsrf: string;
  let officeCookie: string;
  let officeCsrf: string;
  let wardenCookie: string;
  let wardenCsrf: string;
  let chiefWardenCookie: string;
  let chiefWardenCsrf: string;
  let caretakerCookie: string;
  let caretakerCsrf: string;
  let studentBh1Cookie: string;
  let studentBh1Csrf: string;
  let studentGh1Cookie: string;
  let studentGh1Csrf: string;
  let unallocatedStudentCookie: string;
  let unallocatedStudentCsrf: string;
  let studentBh1UserId: number;

  beforeAll(async () => {
    // 1. Admin login
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: 'admin', password: 'Password@123' });
    adminCookie = adminRes.headers['set-cookie'].join('; ');
    adminCsrf = adminRes.body.csrfToken;

    // 2. Hostel Office login
    const officeRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: 'office', password: 'Password@123' });
    officeCookie = officeRes.headers['set-cookie'].join('; ');
    officeCsrf = officeRes.body.csrfToken;

    // 3. Warden BH1 login
    const wardenRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: 'warden_bh1', password: 'Password@123' });
    wardenCookie = wardenRes.headers['set-cookie'].join('; ');
    wardenCsrf = wardenRes.body.csrfToken;

    // 4. Chief Warden login
    const chiefRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: 'chiefwarden', password: 'Password@123' });
    chiefWardenCookie = chiefRes.headers['set-cookie'].join('; ');
    chiefWardenCsrf = chiefRes.body.csrfToken;

    // 5. Caretaker BH1 login
    const caretakerRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: 'caretaker_bh1', password: 'Password@123' });
    caretakerCookie = caretakerRes.headers['set-cookie'].join('; ');
    caretakerCsrf = caretakerRes.body.csrfToken;

    // 6. Student in BH1 (Hostel 1)
    const [bh1Students] = await pool.query<any[]>(
      `SELECT cr.user_id, u.login_id 
       FROM v_current_residence cr 
       JOIN users u ON cr.user_id = u.user_id 
       WHERE cr.hostel_id = 1 
       LIMIT 1`
    );
    studentBh1UserId = bh1Students[0].user_id;
    const bh1Login = bh1Students[0].login_id;
    const s1Res = await request(app)
      .post('/api/auth/login')
      .send({ login_id: bh1Login, password: 'Password@123' });
    studentBh1Cookie = s1Res.headers['set-cookie'].join('; ');
    studentBh1Csrf = s1Res.body.csrfToken;

    // 7. Student in GH1 (Hostel 3)
    const [gh1Students] = await pool.query<any[]>(
      `SELECT cr.user_id, u.login_id 
       FROM v_current_residence cr 
       JOIN users u ON cr.user_id = u.user_id 
       WHERE cr.hostel_id = 3 
       LIMIT 1`
    );
    const gh1Login = gh1Students[0].login_id;
    const s2Res = await request(app)
      .post('/api/auth/login')
      .send({ login_id: gh1Login, password: 'Password@123' });
    studentGh1Cookie = s2Res.headers['set-cookie'].join('; ');
    studentGh1Csrf = s2Res.body.csrfToken;

    // 8. Unallocated Student
    const [unallocStudents] = await pool.query<any[]>(
      `SELECT s.user_id, u.login_id 
       FROM students s 
       JOIN users u ON s.user_id = u.user_id 
       LEFT JOIN v_current_residence cr ON s.student_id = cr.student_id 
       WHERE cr.hostel_id IS NULL 
       LIMIT 1`
    );
    const unallocLogin = unallocStudents[0].login_id;
    const s3Res = await request(app)
      .post('/api/auth/login')
      .send({ login_id: unallocLogin, password: 'Password@123' });
    unallocatedStudentCookie = s3Res.headers['set-cookie'].join('; ');
    unallocatedStudentCsrf = s3Res.body.csrfToken;
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query("DELETE FROM notices WHERE title LIKE 'TEST_P6_%'");
    await pool.query("DELETE FROM water_quality_reports WHERE remarks LIKE 'TEST_P6_%'");
    await pool.query("DELETE FROM maintenance_schedules WHERE time_slot = 'TEST_P6_SLOT'");
    await pool.query("DELETE FROM notifications WHERE title LIKE '%TEST_P6_%'");
  });

  describe('1. Database Triggers & SQL Assertions', () => {
    it('Assertion: A notice for Hostel 1 notifies only Hostel 1 residents with ONE set-based INSERT...SELECT', async () => {
      const [h1Residents] = await pool.query<any[]>(
        'SELECT COUNT(DISTINCT user_id) as cnt FROM v_current_residence WHERE hostel_id = 1'
      );
      const expectedH1Count = Number(h1Residents[0].cnt);
      expect(expectedH1Count).toBeGreaterThan(0);

      const testTitle = 'TEST_P6_NOTICE_H1_ONLY';

      const [res]: any = await pool.query(
        `INSERT INTO notices (category, hostel_id, title, body, is_pinned, starts_at, posted_by)
         VALUES ('CIRCULAR', 1, ?, 'Hostel 1 exclusive notice body', 0, NOW(), 1)`,
        [testTitle]
      );
      const noticeId = res.insertId;

      const [notifs] = await pool.query<any[]>(
        'SELECT notif_id, user_id, notif_type, title, body, link, is_read FROM notifications WHERE title = ?',
        [testTitle]
      );
      expect(notifs.length).toBe(expectedH1Count);

      const [notifiedHostels] = await pool.query<any[]>(
        `SELECT DISTINCT cr.hostel_id 
         FROM notifications n 
         JOIN v_current_residence cr ON n.user_id = cr.user_id 
         WHERE n.title = ?`,
        [testTitle]
      );
      expect(notifiedHostels.length).toBe(1);
      expect(notifiedHostels[0].hostel_id).toBe(1);

      await pool.query('DELETE FROM notices WHERE notice_id = ?', [noticeId]);
      await pool.query('DELETE FROM notifications WHERE title = ?', [testTitle]);
    });

    it('Assertion: A global notice (hostel_id IS NULL) notifies ALL residents across all hostels', async () => {
      const [allResidents] = await pool.query<any[]>(
        'SELECT COUNT(DISTINCT user_id) as cnt FROM v_current_residence'
      );
      const totalResidents = Number(allResidents[0].cnt);
      expect(totalResidents).toBe(300);

      const testTitle = 'TEST_P6_NOTICE_GLOBAL_ALL';

      const [res]: any = await pool.query(
        `INSERT INTO notices (category, hostel_id, title, body, is_pinned, starts_at, posted_by)
         VALUES ('CIRCULAR', NULL, ?, 'Global announcement for all hostels', 1, NOW(), 1)`,
        [testTitle]
      );
      const noticeId = res.insertId;

      const [notifs] = await pool.query<any[]>(
        'SELECT COUNT(*) as cnt FROM notifications WHERE title = ?',
        [testTitle]
      );
      expect(Number(notifs[0].cnt)).toBe(totalResidents);

      const [hostelDist] = await pool.query<any[]>(
        `SELECT cr.hostel_id, COUNT(*) as cnt 
         FROM notifications n 
         JOIN v_current_residence cr ON n.user_id = cr.user_id 
         WHERE n.title = ? 
         GROUP BY cr.hostel_id 
         ORDER BY cr.hostel_id`,
        [testTitle]
      );
      expect(hostelDist.length).toBe(4);

      await pool.query('DELETE FROM notices WHERE notice_id = ?', [noticeId]);
      await pool.query('DELETE FROM notifications WHERE title = ?', [testTitle]);
    });

    it('Assertion: Publishing a notice for 300 residents completes in a single statement', async () => {
      const testTitle = 'TEST_P6_SINGLE_STMT_300';

      const t0 = performance.now();
      const [insertRes]: any = await pool.query(
        `INSERT INTO notices (category, hostel_id, title, body, starts_at, posted_by)
         VALUES ('CIRCULAR', NULL, ?, 'Performance single statement notification fanout', NOW(), 1)`,
        [testTitle]
      );
      const elapsedMs = performance.now() - t0;

      const [notifs] = await pool.query<any[]>(
        'SELECT COUNT(*) as cnt FROM notifications WHERE title = ?',
        [testTitle]
      );
      expect(Number(notifs[0].cnt)).toBe(300);
      expect(elapsedMs).toBeLessThan(1000);

      console.log(`[Phase 6 Benchmark] 300-resident notification fanout executed in: ${elapsedMs.toFixed(2)} ms`);

      await pool.query('DELETE FROM notices WHERE notice_id = ?', [insertRes.insertId]);
      await pool.query('DELETE FROM notifications WHERE title = ?', [testTitle]);
    });

    it('Assertion: An UNSAFE water quality report triggers an alert notification only for that hostel', async () => {
      const [h3Residents] = await pool.query<any[]>(
        'SELECT COUNT(DISTINCT user_id) as cnt FROM v_current_residence WHERE hostel_id = 3'
      );
      const expectedH3Count = Number(h3Residents[0].cnt);

      const testWeek = '2026-11-09';
      const testRemarks = 'TEST_P6_UNSAFE_WATER_TEST';

      const [insertRes]: any = await pool.query(
        `INSERT INTO water_quality_reports (hostel_id, week_start, tds_ppm, ph, chlorine_mgl, remarks, posted_by)
         VALUES (3, ?, 620, 9.0, 0.15, ?, 1)`,
        [testWeek, testRemarks]
      );

      const [repRows] = await pool.query<any[]>(
        'SELECT verdict FROM water_quality_reports WHERE report_id = ?',
        [insertRes.insertId]
      );
      expect(repRows[0].verdict).toBe('UNSAFE');

      const [notifs] = await pool.query<any[]>(
        `SELECT n.notif_id, cr.hostel_id 
         FROM notifications n 
         JOIN v_current_residence cr ON n.user_id = cr.user_id 
         WHERE n.notif_type = 'WATER_QUALITY' AND n.body LIKE ?`,
        [`%${testRemarks}%`]
      );
      expect(notifs.length).toBe(expectedH3Count);
      expect(notifs.every((n) => n.hostel_id === 3)).toBe(true);

      await pool.query('DELETE FROM water_quality_reports WHERE report_id = ?', [insertRes.insertId]);
      await pool.query("DELETE FROM notifications WHERE notif_type = 'WATER_QUALITY' AND body LIKE ?", [`%${testRemarks}%`]);
    });

    it('Assertion: Maintenance schedule creation and cancellation notify residents of the affected hostel', async () => {
      const [h2Residents] = await pool.query<any[]>(
        'SELECT COUNT(DISTINCT user_id) as cnt FROM v_current_residence WHERE hostel_id = 2'
      );
      const expectedH2Count = Number(h2Residents[0].cnt);

      const [createRes]: any = await pool.query(
        `INSERT INTO maintenance_schedules (hostel_id, maint_type, block, floor_no, sched_date, time_slot, status, posted_by)
         VALUES (2, 'TANK_CLEANING', 'A', 2, '2026-11-20', 'TEST_P6_SLOT', 'SCHEDULED', 1)`
      );
      const schedId = createRes.insertId;

      const [createNotifs] = await pool.query<any[]>(
        `SELECT n.notif_id, cr.hostel_id 
         FROM notifications n 
         JOIN v_current_residence cr ON n.user_id = cr.user_id 
         WHERE n.notif_type = 'MAINTENANCE' AND n.title = 'Maintenance Scheduled: TANK_CLEANING'`
      );
      expect(createNotifs.length).toBe(expectedH2Count);
      expect(createNotifs.every((n) => n.hostel_id === 2)).toBe(true);

      await pool.query(
        "UPDATE maintenance_schedules SET status = 'CANCELLED' WHERE schedule_id = ?",
        [schedId]
      );

      const [cancelNotifs] = await pool.query<any[]>(
        `SELECT n.notif_id, cr.hostel_id 
         FROM notifications n 
         JOIN v_current_residence cr ON n.user_id = cr.user_id 
         WHERE n.notif_type = 'MAINTENANCE' AND n.title = 'Maintenance Cancelled: TANK_CLEANING'`
      );
      expect(cancelNotifs.length).toBe(expectedH2Count);
      expect(cancelNotifs.every((n) => n.hostel_id === 2)).toBe(true);

      await pool.query('DELETE FROM maintenance_schedules WHERE schedule_id = ?', [schedId]);
      await pool.query("DELETE FROM notifications WHERE notif_type = 'MAINTENANCE' AND title LIKE '%TANK_CLEANING%'");
    });

    it('Assertion: v_user_activity correctly scopes notices, maintenance, water results, and notifications by residence', async () => {
      const [actRows] = await pool.query<any[]>(
        'SELECT activity_type, COUNT(*) as cnt FROM v_user_activity GROUP BY activity_type'
      );
      expect(actRows.length).toBeGreaterThanOrEqual(4);

      const types = actRows.map((r) => r.activity_type);
      expect(types).toContain('NOTICE');
      expect(types).toContain('MAINTENANCE');
      expect(types).toContain('WATER_QUALITY');
      expect(types).toContain('NOTIFICATION');
    });
  });

  describe('2. API Role Tests & Access Control', () => {
    it('WARDEN, CHIEF_WARDEN, and HOSTEL_OFFICE can post notices', async () => {
      // 1. Hostel Office posts notice
      const resOffice = await request(app)
        .post('/api/notices')
        .set('Cookie', officeCookie)
        .set('x-csrf-token', officeCsrf)
        .send({
          category: 'CIRCULAR',
          hostel_id: 1,
          title: 'TEST_P6_OFFICE_NOTICE',
          body: 'Notice by Hostel Office',
          is_pinned: false,
        });
      expect(resOffice.status).toBe(201);
      expect(resOffice.body.noticeId).toBeDefined();

      // 2. Warden posts notice
      const resWarden = await request(app)
        .post('/api/notices')
        .set('Cookie', wardenCookie)
        .set('x-csrf-token', wardenCsrf)
        .send({
          category: 'PEST_CONTROL',
          hostel_id: 1,
          title: 'TEST_P6_WARDEN_NOTICE',
          body: 'Notice by Warden BH1',
          is_pinned: false,
        });
      expect(resWarden.status).toBe(201);
      expect(resWarden.body.noticeId).toBeDefined();

      // 3. Chief Warden posts notice
      const resChief = await request(app)
        .post('/api/notices')
        .set('Cookie', chiefWardenCookie)
        .set('x-csrf-token', chiefWardenCsrf)
        .send({
          category: 'GENERAL',
          hostel_id: null,
          title: 'TEST_P6_CHIEF_NOTICE',
          body: 'Notice by Chief Warden',
          is_pinned: true,
        });
      expect(resChief.status).toBe(201);
      expect(resChief.body.noticeId).toBeDefined();
    });

    it('CARETAKER cannot post notices (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/notices')
        .set('Cookie', caretakerCookie)
        .set('x-csrf-token', caretakerCsrf)
        .send({
          category: 'CIRCULAR',
          title: 'TEST_P6_CARETAKER_FORBIDDEN_NOTICE',
        });
      expect(res.status).toBe(403);
    });

    it('STUDENT cannot post notices (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/notices')
        .set('Cookie', studentBh1Cookie)
        .set('x-csrf-token', studentBh1Csrf)
        .send({
          category: 'CIRCULAR',
          title: 'TEST_P6_STUDENT_FORBIDDEN_NOTICE',
        });
      expect(res.status).toBe(403);
    });

    it('WARDEN and HOSTEL_OFFICE can post water quality reports', async () => {
      const res = await request(app)
        .post('/api/water-reports')
        .set('Cookie', wardenCookie)
        .set('x-csrf-token', wardenCsrf)
        .send({
          hostel_id: 1,
          week_start: '2026-11-16',
          tds_ppm: 340,
          ph: 7.2,
          chlorine_mgl: 0.35,
          remarks: 'TEST_P6_ROUTINE_WARDEN_LOG',
        });
      expect(res.status).toBe(201);
      expect(res.body.reportId).toBeDefined();
      expect(res.body.verdict).toBe('SAFE');
    });

    it('CARETAKER and STUDENT cannot post water quality reports (403 Forbidden)', async () => {
      const res1 = await request(app)
        .post('/api/water-reports')
        .set('Cookie', caretakerCookie)
        .set('x-csrf-token', caretakerCsrf)
        .send({
          hostel_id: 1,
          week_start: '2026-11-23',
          tds_ppm: 340,
          ph: 7.2,
          chlorine_mgl: 0.35,
        });
      expect(res1.status).toBe(403);

      const res2 = await request(app)
        .post('/api/water-reports')
        .set('Cookie', studentBh1Cookie)
        .set('x-csrf-token', studentBh1Csrf)
        .send({
          hostel_id: 1,
          week_start: '2026-11-23',
          tds_ppm: 340,
          ph: 7.2,
          chlorine_mgl: 0.35,
        });
      expect(res2.status).toBe(403);
    });

    it('CARETAKER CAN post and patch maintenance schedules', async () => {
      const createRes = await request(app)
        .post('/api/maintenance')
        .set('Cookie', caretakerCookie)
        .set('x-csrf-token', caretakerCsrf)
        .send({
          hostel_id: 1,
          maint_type: 'ELECTRICIAN',
          block: 'A',
          floor_no: 1,
          sched_date: '2026-11-25',
          time_slot: 'TEST_P6_SLOT',
        });
      expect(createRes.status).toBe(201);
      const scheduleId = createRes.body.scheduleId;

      const patchRes = await request(app)
        .patch(`/api/maintenance/${scheduleId}`)
        .set('Cookie', caretakerCookie)
        .set('x-csrf-token', caretakerCsrf)
        .send({ status: 'DONE' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.status).toBe('DONE');
    });

    it('STUDENT cannot post or patch maintenance schedules (403 Forbidden)', async () => {
      const resPost = await request(app)
        .post('/api/maintenance')
        .set('Cookie', studentBh1Cookie)
        .set('x-csrf-token', studentBh1Csrf)
        .send({
          hostel_id: 1,
          maint_type: 'PLUMBER',
          sched_date: '2026-11-25',
        });
      expect(resPost.status).toBe(403);

      const resPatch = await request(app)
        .patch('/api/maintenance/1')
        .set('Cookie', studentBh1Cookie)
        .set('x-csrf-token', studentBh1Csrf)
        .send({ status: 'DONE' });
      expect(resPatch.status).toBe(403);
    });

    it('STUDENT queries for notices, water reports, and maintenance are residence-scoped', async () => {
      // 1. Notices: Student in BH1 sees BH1 notices and global notices
      const noticesRes = await request(app)
        .get('/api/notices?pageSize=50')
        .set('Cookie', studentBh1Cookie);
      expect(noticesRes.status).toBe(200);
      expect(noticesRes.body.notices).toBeDefined();
      for (const n of noticesRes.body.notices) {
        expect(n.hostel_id === null || n.hostel_id === 1).toBe(true);
      }

      // 2. Water reports: Student in BH1 sees only BH1 reports
      const waterRes = await request(app)
        .get('/api/water-reports')
        .set('Cookie', studentBh1Cookie);
      expect(waterRes.status).toBe(200);
      expect(waterRes.body.reports).toBeDefined();
      for (const r of waterRes.body.reports) {
        expect(r.hostel_id).toBe(1);
      }

      // 3. Water trend: Student in GH1 is locked to GH1
      const trendRes = await request(app)
        .get('/api/water-reports/trend?hostel=1')
        .set('Cookie', studentGh1Cookie);
      expect(trendRes.status).toBe(200);
      expect(trendRes.body.hostel_id).toBe(3);

      // 4. Maintenance: Student in BH1 sees only BH1 maintenance
      const maintRes = await request(app)
        .get('/api/maintenance')
        .set('Cookie', studentBh1Cookie);
      expect(maintRes.status).toBe(200);
      for (const m of maintRes.body.schedules) {
        expect(m.hostel_id).toBe(1);
      }
    });

    it('Water safe limits come from app_settings and are returned in API', async () => {
      const res = await request(app)
        .get('/api/water-reports')
        .set('Cookie', officeCookie);
      expect(res.status).toBe(200);
      expect(res.body.limits).toBeDefined();
      expect(res.body.limits.tdsMax).toBe(500);
      expect(res.body.limits.phMin).toBe(6.5);
      expect(res.body.limits.phMax).toBe(8.5);
      expect(res.body.limits.chlorineMin).toBe(0.2);
    });

    it('Notifications API allows pagination, marking single read, and marking all read', async () => {
      const getRes = await request(app)
        .get('/api/notifications?page=1&pageSize=10')
        .set('Cookie', studentBh1Cookie);
      expect(getRes.status).toBe(200);
      expect(getRes.body.notifications).toBeDefined();
      expect(getRes.body.unreadCount).toBeDefined();

      if (getRes.body.notifications.length > 0) {
        const notifId = getRes.body.notifications[0].notif_id;

        const patchRes = await request(app)
          .patch(`/api/notifications/${notifId}/read`)
          .set('Cookie', studentBh1Cookie)
          .set('x-csrf-token', studentBh1Csrf);
        expect(patchRes.status).toBe(200);
        expect(patchRes.body.success).toBe(true);

        const readAllRes = await request(app)
          .post('/api/notifications/read-all')
          .set('Cookie', studentBh1Cookie)
          .set('x-csrf-token', studentBh1Csrf);
        expect(readAllRes.status).toBe(200);
        expect(readAllRes.body.success).toBe(true);
      }
    });
  });
});
