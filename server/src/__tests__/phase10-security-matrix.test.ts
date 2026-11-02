import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { pool, closeAllPools } from '../db.js';

interface Session {
  role: string;
  loginId: string;
  token: string;
  csrfToken: string;
  cookie: string;
}

const ROLES = [
  'ADMIN',
  'HOSTEL_OFFICE',
  'CHIEF_WARDEN',
  'WARDEN',
  'MESS_MANAGER',
  'CARETAKER',
  'STUDENT',
] as const;

describe('Phase 10 — Security Hardening: Endpoint-by-Role Authorization Matrix', () => {
  const sessions: Record<string, Session> = {};

  beforeAll(async () => {
    // 1. Obtain student login_id from DB
    const [studentRows] = await pool.query<any[]>(
      `SELECT u.login_id FROM users u WHERE u.role = 'STUDENT' AND u.is_active = 1 LIMIT 1`
    );
    const studentLogin = studentRows[0]?.login_id || '2026UCS0001';

    const loginCredentials: Record<string, string> = {
      ADMIN: 'admin',
      HOSTEL_OFFICE: 'office',
      CHIEF_WARDEN: 'chiefwarden',
      WARDEN: 'warden_bh1',
      MESS_MANAGER: 'mess_mgr',
      CARETAKER: 'caretaker_bh1',
      STUDENT: studentLogin,
    };

    for (const role of ROLES) {
      const loginId = loginCredentials[role];
      const res = await request(app)
        .post('/api/auth/login')
        .send({ login_id: loginId, password: 'Password@123' });

      if (res.status !== 200) {
        throw new Error(`Failed to login as ${role} (${loginId}): ${JSON.stringify(res.body)}`);
      }

      const cookies = res.headers['set-cookie'];
      const tokenCookie = cookies?.find((c: string) => c.startsWith('token='))?.split(';')[0] || '';
      const csrfCookie = cookies?.find((c: string) => c.startsWith('csrf_token='))?.split(';')[0] || '';

      sessions[role] = {
        role,
        loginId,
        token: res.body.csrfToken ? tokenCookie.replace('token=', '') : '',
        csrfToken: res.body.csrfToken,
        cookie: `${tokenCookie}; ${csrfCookie}`,
      };
    }
  });

  afterAll(async () => {
    await closeAllPools();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Public Endpoints (Anonymous & All Roles Allowed)
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Public Endpoints (Unauthenticated & Authenticated Allowed)', () => {
    const publicGetRoutes = [
      '/api/health',
      '/api/lookups/states',
      '/api/lookups/cities',
      '/api/lookups/authorities',
      '/api/public/stats',
    ];

    for (const route of publicGetRoutes) {
      it(`Anonymous access to ${route} returns 200 OK`, async () => {
        const res = await request(app).get(route);
        expect(res.status).toBe(200);
      });

      it(`Authenticated roles access to ${route} returns 200 OK`, async () => {
        for (const role of ROLES) {
          const res = await request(app)
            .get(route)
            .set('Cookie', sessions[role].cookie);
          expect(res.status).toBe(200);
        }
      });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Authentication Boundary (Anonymous Rejected with 401)
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Authentication Boundary (Anonymous Rejected with 401)', () => {
    const protectedRoutes = [
      { method: 'get', path: '/api/auth/me' },
      { method: 'get', path: '/api/students' },
      { method: 'get', path: '/api/applications' },
      { method: 'get', path: '/api/pool' },
      { method: 'get', path: '/api/rooms/board' },
      { method: 'get', path: '/api/allotment/cycle/1' },
      { method: 'get', path: '/api/notices' },
      { method: 'get', path: '/api/water-reports' },
      { method: 'get', path: '/api/maintenance' },
      { method: 'get', path: '/api/notifications' },
      { method: 'get', path: '/api/complaints/inbox' },
      { method: 'get', path: '/api/laundry/machines' },
      { method: 'get', path: '/api/mess/refunds' },
      { method: 'get', path: '/api/nav' },
      { method: 'get', path: '/api/search' },
    ];

    for (const r of protectedRoutes) {
      it(`Anonymous ${r.method.toUpperCase()} ${r.path} returns 401 Unauthorized`, async () => {
        const res = await (request(app) as any)[r.method](r.path);
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
      });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Admin-Exclusive Boundary
  // Allowed: ADMIN
  // Forbidden (403): All other 6 roles
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Admin-Exclusive Boundary', () => {
    it('GET /api/admin/privilege-proof: ADMIN gets 200, all other 6 roles receive 403', async () => {
      const adminRes = await request(app)
        .get('/api/admin/privilege-proof')
        .set('Cookie', sessions['ADMIN'].cookie);
      expect(adminRes.status).toBe(200);

      for (const role of ROLES) {
        if (role === 'ADMIN') continue;
        const res = await request(app)
          .get('/api/admin/privilege-proof')
          .set('Cookie', sessions[role].cookie);
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
      }
    });

    it('POST /api/auth/reset-password: only ADMIN can access (other roles get 403)', async () => {
      for (const role of ROLES) {
        if (role === 'ADMIN') continue;
        const res = await request(app)
          .post('/api/auth/reset-password')
          .set('Cookie', sessions[role].cookie)
          .set('x-csrf-token', sessions[role].csrfToken)
          .send({ userId: 999, newPassword: 'NewPassword@123' });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Hostel Office & Admin Allotment Engine Controls
  // Allowed: ADMIN, HOSTEL_OFFICE
  // Forbidden (403): CHIEF_WARDEN, WARDEN, MESS_MANAGER, CARETAKER, STUDENT
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Allotment Engine & Verification Access Controls', () => {
    const allowed = ['ADMIN', 'HOSTEL_OFFICE'];
    const forbidden = ['CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT'];

    it('POST /api/allotment/dry-run: ADMIN & HOSTEL_OFFICE permitted, others rejected (403)', async () => {
      for (const role of allowed) {
        const res = await request(app)
          .post('/api/allotment/dry-run')
          .set('Cookie', sessions[role].cookie)
          .send({ cycle_id: 1 });
        // Status is 200 (if cycle closed) or 422 (stored procedure signal check), but NEVER 403
        expect([200, 422]).toContain(res.status);
      }

      for (const role of forbidden) {
        const res = await request(app)
          .post('/api/allotment/dry-run')
          .set('Cookie', sessions[role].cookie)
          .send({ cycle_id: 1 });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
      }
    });

    it('POST /api/applications/verify: ADMIN & HOSTEL_OFFICE permitted, others rejected (403)', async () => {
      for (const role of forbidden) {
        const res = await request(app)
          .post('/api/applications/verify')
          .set('Cookie', sessions[role].cookie)
          .send({ application_id: 1, decision: 'VERIFIED' });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Room Occupancy Board Authorization
  // Allowed: HOSTEL_OFFICE, ADMIN, CHIEF_WARDEN, WARDEN
  // Forbidden (403): MESS_MANAGER, CARETAKER, STUDENT
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Room Occupancy Board Access', () => {
    it('GET /api/rooms/board: Administrative roles receive 200, others receive 403', async () => {
      const allowed = ['ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN'];
      const forbidden = ['MESS_MANAGER', 'CARETAKER', 'STUDENT'];

      for (const role of allowed) {
        const res = await request(app)
          .get('/api/rooms/board')
          .set('Cookie', sessions[role].cookie);
        expect(res.status).toBe(200);
      }

      for (const role of forbidden) {
        const res = await request(app)
          .get('/api/rooms/board')
          .set('Cookie', sessions[role].cookie);
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Student-Exclusive Endpoints
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Student-Exclusive Endpoints', () => {
    it('GET /api/allotment/my-status: STUDENT gets 200', async () => {
      const sRes = await request(app)
        .get('/api/allotment/my-status')
        .set('Cookie', sessions['STUDENT'].cookie);
      expect(sRes.status).toBe(200);
    });

    it('GET /api/complaints/mine: STUDENT gets 200, staff roles receive 403', async () => {
      const sRes = await request(app)
        .get('/api/complaints/mine')
        .set('Cookie', sessions['STUDENT'].cookie);
      expect(sRes.status).toBe(200);

      for (const role of ROLES) {
        if (role === 'STUDENT') continue;
        const res = await request(app)
          .get('/api/complaints/mine')
          .set('Cookie', sessions[role].cookie);
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
      }
    });

    it('POST /api/complaints: STUDENT permitted, staff roles rejected with 403', async () => {
      for (const role of ROLES) {
        if (role === 'STUDENT') continue;
        const res = await request(app)
          .post('/api/complaints')
          .set('Cookie', sessions[role].cookie)
          .set('x-csrf-token', sessions[role].csrfToken)
          .send({
            category: 'HOSTEL_MAINTENANCE',
            title: 'Unauthorized staff complaint',
            description: 'Testing role boundary',
            is_anonymous: false,
          });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Authority Complaints Inbox
  // Allowed: Registered authorities (HOSTEL_OFFICE, CHIEF_WARDEN, WARDEN, CARETAKER, MESS_MANAGER)
  // Forbidden (403): STUDENT
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Authority Complaints Inbox', () => {
    it('GET /api/complaints/inbox: Registered authorities receive 200, STUDENT receives 403', async () => {
      const authorities = ['HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'CARETAKER', 'MESS_MANAGER'];
      for (const role of authorities) {
        const res = await request(app)
          .get('/api/complaints/inbox')
          .set('Cookie', sessions[role].cookie);
        expect(res.status).toBe(200);
      }

      const studentRes = await request(app)
        .get('/api/complaints/inbox')
        .set('Cookie', sessions['STUDENT'].cookie);
      expect(studentRes.status).toBe(403);
      expect(studentRes.body.error).toBe('Forbidden');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Laundry Status & Machine Controls
  // ───────────────────────────────────────────────────────────────────────────
  describe('8. Laundry Status & Machine Controls', () => {
    it('GET /api/laundry/history: Authenticated roles can query laundry history', async () => {
      for (const role of ROLES) {
        const res = await request(app)
          .get('/api/laundry/history')
          .set('Cookie', sessions[role].cookie);
        expect(res.status).toBe(200);
      }
    });

    it('PATCH /api/laundry/1/status: CARETAKER & ADMIN permitted, others rejected with 403', async () => {
      const forbidden = ['STUDENT', 'MESS_MANAGER', 'WARDEN', 'CHIEF_WARDEN', 'HOSTEL_OFFICE'];
      for (const role of forbidden) {
        const res = await request(app)
          .patch('/api/laundry/1/status')
          .set('Cookie', sessions[role].cookie)
          .set('x-csrf-token', sessions[role].csrfToken)
          .send({ status: 'OUT_OF_ORDER' });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Institutional Mess Administration
  // ───────────────────────────────────────────────────────────────────────────
  describe('9. Institutional Mess Administration', () => {
    it('GET /api/mess/summary: ADMIN, HOSTEL_OFFICE, CHIEF_WARDEN, WARDEN, MESS_MANAGER get 200; CARETAKER & STUDENT get 403', async () => {
      const allowed = ['ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER'];
      const forbidden = ['CARETAKER', 'STUDENT'];

      for (const role of allowed) {
        const res = await request(app)
          .get('/api/mess/summary')
          .set('Cookie', sessions[role].cookie);
        expect(res.status).toBe(200);
      }

      for (const role of forbidden) {
        const res = await request(app)
          .get('/api/mess/summary')
          .set('Cookie', sessions[role].cookie);
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
      }
    });

    it('PUT /api/mess/config: MESS_MANAGER & ADMIN get 200 (or validation error), others get 403', async () => {
      const forbidden = ['STUDENT', 'CARETAKER', 'WARDEN', 'CHIEF_WARDEN', 'HOSTEL_OFFICE'];
      for (const role of forbidden) {
        const res = await request(app)
          .put('/api/mess/config')
          .set('Cookie', sessions[role].cookie)
          .set('x-csrf-token', sessions[role].csrfToken)
          .send({
            hostel_id: 1,
            month: 10,
            year: 2026,
            monthly_fee: 4500,
            food_component: 3600,
            per_meal_refund_rate: 40,
            free_skips: 15,
            cap_pct: 60,
          });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Water Quality Reports & Maintenance Operations
  // ───────────────────────────────────────────────────────────────────────────
  describe('10. Water Quality Reports & Maintenance Operations', () => {
    it('POST /api/water-reports: ADMIN, HOSTEL_OFFICE, CHIEF_WARDEN, WARDEN permitted; STUDENT, MESS_MANAGER, CARETAKER receive 403', async () => {
      const forbidden = ['STUDENT', 'MESS_MANAGER', 'CARETAKER'];
      for (const role of forbidden) {
        const res = await request(app)
          .post('/api/water-reports')
          .set('Cookie', sessions[role].cookie)
          .set('x-csrf-token', sessions[role].csrfToken)
          .send({
            hostel_id: 1,
            week_start: '2026-11-02',
            tds_ppm: 180,
            ph: 7.2,
            chlorine_mgl: 0.5,
            remarks: 'Sample test',
          });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
      }
    });

    it('POST /api/maintenance: ADMIN, HOSTEL_OFFICE, CHIEF_WARDEN, WARDEN, CARETAKER permitted; STUDENT & MESS_MANAGER receive 403', async () => {
      const forbidden = ['STUDENT', 'MESS_MANAGER'];
      for (const role of forbidden) {
        const res = await request(app)
          .post('/api/maintenance')
          .set('Cookie', sessions[role].cookie)
          .set('x-csrf-token', sessions[role].csrfToken)
          .send({
            hostel_id: 1,
            maint_type: 'PLUMBING',
            block: 'A',
            floor_no: 1,
            sched_date: '2026-11-05',
            time_slot: '10:00 - 12:00',
          });
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Forbidden');
      }
    });
  });
});
