import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { pool, closeAllPools } from '../db.js';

describe('Phase 10 — Security Hardening: SQL Injection, Fuzzing, CSRF, Rate Limits & Cookie Flags', () => {
  let adminCookie: string;
  let adminCsrf: string;
  let studentCookie: string;
  let studentCsrf: string;

  beforeAll(async () => {
    // Admin login
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: 'admin', password: 'Password@123' });
    const adminCookies = adminRes.headers['set-cookie'] || [];
    const aToken = adminCookies.find((c: string) => c.startsWith('token='))?.split(';')[0] || '';
    const aCsrf = adminCookies.find((c: string) => c.startsWith('csrf_token='))?.split(';')[0] || '';
    adminCookie = `${aToken}; ${aCsrf}`;
    adminCsrf = adminRes.body.csrfToken;

    // Student login
    const [sRows] = await pool.query<any[]>(
      `SELECT u.login_id FROM users u WHERE u.role = 'STUDENT' AND u.is_active = 1 LIMIT 1`
    );
    const sLogin = sRows[0]?.login_id || '2026UCS0001';
    const sRes = await request(app)
      .post('/api/auth/login')
      .send({ login_id: sLogin, password: 'Password@123' });
    const sCookies = sRes.headers['set-cookie'] || [];
    const sToken = sCookies.find((c: string) => c.startsWith('token='))?.split(';')[0] || '';
    const sCsrf = sCookies.find((c: string) => c.startsWith('csrf_token='))?.split(';')[0] || '';
    studentCookie = `${sToken}; ${sCsrf}`;
    studentCsrf = sRes.body.csrfToken;
  });

  afterAll(async () => {
    await closeAllPools();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. SQL Injection Resilience Across Search, Filter & Sort Parameters
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. SQL Injection Resilience Across Parameters', () => {
    const sqliPayloads = [
      "' OR '1'='1",
      "' OR 1=1 -- ",
      "1; DROP TABLE students; --",
      "' UNION SELECT 1, 'admin', 'hash', '2026', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 -- ",
      "1' OR SLEEP(2) --",
      "admin' --",
      "'; EXEC xp_cmdshell('dir'); --",
      "<script>alert('xss')</script>",
      "%27%20OR%201%3D1--",
    ];

    it('Search endpoint /api/search rejects or safely parameterizes SQLi payloads', async () => {
      for (const payload of sqliPayloads) {
        const res = await request(app)
          .get(`/api/search?q=${encodeURIComponent(payload)}`)
          .set('Cookie', adminCookie);

        // Expect successful handling without SQL syntax error or 500 failure
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('results');
        expect(Array.isArray(res.body.results)).toBe(true);
      }
    });

    it('Student directory /api/students safely handles SQLi in search, filters & sort', async () => {
      for (const payload of sqliPayloads) {
        // Test in search param
        const resSearch = await request(app)
          .get(`/api/students?search=${encodeURIComponent(payload)}`)
          .set('Cookie', adminCookie);
        expect(resSearch.status).toBe(200);

        // Test in sort_by (schema whitelisting rejects invalid column names)
        const resSort = await request(app)
          .get(`/api/students?sort_by=${encodeURIComponent(payload)}`)
          .set('Cookie', adminCookie);
        expect([400, 422]).toContain(resSort.status);

        // Test in sort_order (schema whitelisting rejects non asc/desc)
        const resOrder = await request(app)
          .get(`/api/students?sort_order=${encodeURIComponent(payload)}`)
          .set('Cookie', adminCookie);
        expect([400, 422]).toContain(resOrder.status);
      }
    });

    it('Applications queue /api/applications safely handles SQLi in status, cycle & branch', async () => {
      for (const payload of sqliPayloads) {
        // Filter enum validation prevents injection
        const resStatus = await request(app)
          .get(`/api/applications?verification_status=${encodeURIComponent(payload)}`)
          .set('Cookie', adminCookie);
        expect([400, 422]).toContain(resStatus.status);

        // Cycle ID integer coercion prevents injection
        const resCycle = await request(app)
          .get(`/api/applications?cycle_id=${encodeURIComponent(payload)}`)
          .set('Cookie', adminCookie);
        expect([400, 422]).toContain(resCycle.status);

        // Free-text branch filter is parameterized with ?
        const resBranch = await request(app)
          .get(`/api/applications?branch=${encodeURIComponent(payload)}`)
          .set('Cookie', adminCookie);
        expect(resBranch.status).toBe(200);
      }
    });

    it('Public Transparency Pool /api/pool safely handles SQLi in sortField & sortOrder', async () => {
      for (const payload of sqliPayloads) {
        const res = await request(app)
          .get(`/api/pool?search=${encodeURIComponent(payload)}`)
          .set('Cookie', adminCookie);
        expect(res.status).toBe(200);

        const resSort = await request(app)
          .get(`/api/pool?sortField=${encodeURIComponent(payload)}`)
          .set('Cookie', adminCookie);
        expect([400, 422]).toContain(resSort.status);
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Malformed Input & Fuzzing (Type Coercion & Boundary Violations)
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Malformed Input Fuzzing & Boundary Handling', () => {
    it('Rejects non-integer, negative, or absurdly large limits & pagination params', async () => {
      const invalidLimits = ['-1', '0', '99999999999', 'abc', 'NaN', '1.5', 'null'];

      for (const limit of invalidLimits) {
        const res = await request(app)
          .get(`/api/students?limit=${encodeURIComponent(limit)}`)
          .set('Cookie', adminCookie);
        expect([400, 422]).toContain(res.status);
      }
    });

    it('Rejects corrupted, forged or malformed base64 keyset pagination cursors', async () => {
      const corruptCursors = [
        'invalid!@#base64',
        Buffer.from('not json at all').toString('base64'),
        Buffer.from(JSON.stringify({ notId: 123 })).toString('base64'),
        Buffer.from(JSON.stringify({ id: 'string-instead-of-number' })).toString('base64'),
        Buffer.from(JSON.stringify({ id: -999999 })).toString('base64'),
      ];

      for (const cursor of corruptCursors) {
        const res = await request(app)
          .get(`/api/students?cursor=${encodeURIComponent(cursor)}`)
          .set('Cookie', adminCookie);

        // Endpoint falls back gracefully to first page or rejects with 400, never 500 crash
        expect([200, 400]).toContain(res.status);
      }
    });

    it('Rejects malformed date and integer ranges in water reports and maintenance', async () => {
      const resWater = await request(app)
        .post('/api/water-reports')
        .set('Cookie', adminCookie)
        .set('x-csrf-token', adminCsrf)
        .send({
          hostel_id: 'not_an_int',
          week_start: 'not-a-date',
          tds_ppm: -50,
          ph: 99.9, // Out of pH scale 0-14
          chlorine_mgl: 'heavy',
        });
      expect([400, 422]).toContain(resWater.status);

      const resMaint = await request(app)
        .post('/api/maintenance')
        .set('Cookie', adminCookie)
        .set('x-csrf-token', adminCsrf)
        .send({
          hostel_id: 1,
          maint_type: 'INVALID_TYPE',
          floor_no: 'floor_two',
          sched_date: 'yesteryear',
        });
      expect([400, 422]).toContain(resMaint.status);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. CSRF Protection Middleware
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. CSRF Protection Middleware on Mutating Endpoints', () => {
    it('Rejects POST /api/notices when x-csrf-token is missing', async () => {
      const res = await request(app)
        .post('/api/notices')
        .set('Cookie', adminCookie)
        .send({
          title: 'Notice without CSRF token',
          body: 'This must be blocked',
          category: 'CIRCULAR',
        });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
      expect(res.body.message).toContain('CSRF token');
    });

    it('Rejects POST /api/notices when x-csrf-token is mismatched/forged', async () => {
      const res = await request(app)
        .post('/api/notices')
        .set('Cookie', adminCookie)
        .set('x-csrf-token', 'forged-attacker-csrf-token-12345678')
        .send({
          title: 'Notice with forged CSRF token',
          body: 'This must be blocked',
          category: 'CIRCULAR',
        });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('Rejects POST /api/complaints when x-csrf-token is missing', async () => {
      const res = await request(app)
        .post('/api/complaints')
        .set('Cookie', studentCookie)
        .send({
          category: 'HOSTEL_MAINTENANCE',
          title: 'Complaint without CSRF',
          description: 'Blocked request',
          is_anonymous: false,
        });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('Rejects PATCH /api/laundry/1/status when x-csrf-token is missing', async () => {
      const res = await request(app)
        .patch('/api/laundry/1/status')
        .set('Cookie', adminCookie)
        .send({ status: 'OUT_OF_ORDER' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Cookie Security Flags & Logout Cleanup
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Cookie Security Attributes & Session Lifecycle', () => {
    it('Issues JWT session in httpOnly SameSite=Strict cookie and non-httpOnly csrf_token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '198.51.100.1')
        .send({ login_id: 'admin', password: 'Password@123' });

      expect(res.status).toBe(200);
      const setCookies = res.headers['set-cookie'] || [];

      // token cookie
      const tokenCookie = setCookies.find((c: string) => c.startsWith('token='));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie?.toLowerCase()).toContain('httponly');
      expect(tokenCookie?.toLowerCase()).toContain('samesite=strict');
      expect(tokenCookie?.toLowerCase()).toContain('path=/');

      // csrf_token cookie
      const csrfCookie = setCookies.find((c: string) => c.startsWith('csrf_token='));
      expect(csrfCookie).toBeDefined();
      expect(csrfCookie?.toLowerCase()).toContain('samesite=strict');
      expect(csrfCookie?.toLowerCase()).toContain('path=/');
    });

    it('POST /api/auth/logout clears token and csrf_token cookies with max-age=0/expired', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      const setCookies = res.headers['set-cookie'] || [];

      const clearedToken = setCookies.find((c: string) => c.startsWith('token=;'));
      const clearedCsrf = setCookies.find((c: string) => c.startsWith('csrf_token=;'));

      expect(clearedToken).toBeDefined();
      expect(clearedCsrf).toBeDefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Rate Limiting Protection on Login
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Login Endpoint Rate Limiter', () => {
    it('Enforces HTTP 429 Too Many Requests after exceeding threshold from same IP', async () => {
      // Send 25 consecutive login attempts from a unique test IP
      const testIp = '203.0.113.42';
      const requests = [];
      for (let i = 0; i < 25; i++) {
        requests.push(
          request(app)
            .post('/api/auth/login')
            .set('X-Forwarded-For', testIp)
            .send({ login_id: `rate_limit_probe_${i}`, password: 'wrong' })
        );
      }

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);

      // At least one response beyond request 20 must be HTTP 429
      const has429 = statuses.some((s) => s === 429);
      expect(has429).toBe(true);

      const rateLimitedRes = responses.find((r) => r.status === 429);
      expect(rateLimitedRes?.body.error).toBe('TooManyRequests');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Credential & Token Log Redaction
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Credential & Token Log Redaction', () => {
    it('Sanitizes passwords, hashes, JWT tokens, and CSRF tokens before logging', async () => {
      const { sanitizeLogData } = await import('../utils/sanitize.js');

      const testPayload = {
        login_id: 'nsut_student',
        password: 'PlaintextPassword123!',
        newPassword: 'BrandNewPassword456!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy.sig',
        details: {
          password_hash: '$2a$10$encryptedhashvalue',
          csrfToken: 'd8f9a0c7e2b1',
          branch: 'COE',
        },
      };

      const sanitized = sanitizeLogData(testPayload);

      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.newPassword).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.details.password_hash).toBe('[REDACTED]');
      expect(sanitized.details.csrfToken).toBe('[REDACTED]');
      expect(sanitized.details.branch).toBe('COE');
      expect(sanitized.login_id).toBe('nsut_student');
    });
  });
});
