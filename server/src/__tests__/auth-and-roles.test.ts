import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../index.js';
import { pool, withRequestConn, getPoolForRole, closeAllPools } from '../db.js';

describe('Phase 2: Backend Core, Auth, DB Roles & Least Privilege', () => {
  afterAll(async () => {
    await closeAllPools();
  });

  // ==========================================================================
  // Test 1: All 7 roles can log in with seeded users
  // ==========================================================================
  describe('1. All 7 roles can log in with seeded users', () => {
    const seededRoles = [
      { role: 'ADMIN', login_id: 'admin' },
      { role: 'HOSTEL_OFFICE', login_id: 'office' },
      { role: 'CHIEF_WARDEN', login_id: 'chiefwarden' },
      { role: 'WARDEN', login_id: 'warden_bh1' },
      { role: 'MESS_MANAGER', login_id: 'mess_mgr' },
      { role: 'CARETAKER', login_id: 'caretaker_bh1' },
      { role: 'STUDENT', login_id: '2026UCSDS0001' },
    ];

    for (const { role, login_id } of seededRoles) {
      it(`should successfully authenticate ${role} (${login_id})`, async () => {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ login_id, password: 'Password@123' });

        expect(res.status).toBe(200);
        expect(res.body.user).toBeDefined();
        expect(res.body.user.role).toBe(role);
        expect(res.body.csrfToken).toBeDefined();
        expect(typeof res.body.csrfToken).toBe('string');

        // Check for httpOnly SameSite JWT cookie
        const setCookieHeaders = res.headers['set-cookie'] || [];
        const tokenCookie = setCookieHeaders.find((c: string) => c.startsWith('token='));
        expect(tokenCookie).toBeDefined();
        expect(tokenCookie).toContain('HttpOnly');
        expect(tokenCookie).toContain('SameSite=Strict');

        // Check for CSRF cookie
        const csrfCookie = setCookieHeaders.find((c: string) => c.startsWith('csrf_token='));
        expect(csrfCookie).toBeDefined();
      });
    }
  });

  // ==========================================================================
  // Test 2: Wrong password lockout works using users.failed_attempts & locked_until
  // ==========================================================================
  describe('2. Wrong password lockout works', () => {
    const testLoginId = 'test_lockout_user';
    let testUserId: number;

    beforeAll(async () => {
      const hash = await bcrypt.hash('CorrectPass@123', 10);
      await pool.query('DELETE FROM users WHERE login_id = ?', [testLoginId]);
      const [res] = await pool.query<any>(
        `INSERT INTO users (login_id, password_hash, role, is_active, must_change_password, failed_attempts, locked_until)
         VALUES (?, ?, 'STUDENT', 1, 0, 0, NULL)`,
        [testLoginId, hash]
      );
      testUserId = res.insertId;
    });

    afterAll(async () => {
      await pool.query('DELETE FROM users WHERE login_id = ?', [testLoginId]);
    });

    it('should increment failed_attempts and lock the account after 5 consecutive failures', async () => {
      // 4 wrong attempts
      for (let i = 1; i <= 4; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ login_id: testLoginId, password: 'WrongPassword' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('InvalidCredentials');
        expect(res.body.attemptsRemaining).toBe(5 - i);
      }

      // 5th wrong attempt triggers lockout
      const lockRes = await request(app)
        .post('/api/auth/login')
        .send({ login_id: testLoginId, password: 'WrongPassword' });

      expect(lockRes.status).toBe(429);
      expect(lockRes.body.error).toBe('AccountLocked');

      // Verify in DB that failed_attempts = 5 and locked_until is populated
      const [rows] = await pool.query<any[]>(
        'SELECT failed_attempts, locked_until FROM users WHERE user_id = ?',
        [testUserId]
      );
      expect(rows[0].failed_attempts).toBe(5);
      expect(rows[0].locked_until).not.toBeNull();
      expect(new Date(rows[0].locked_until).getTime()).toBeGreaterThan(Date.now());

      // Attempting to log in even with correct password while locked should fail with 429
      const lockedAttempt = await request(app)
        .post('/api/auth/login')
        .send({ login_id: testLoginId, password: 'CorrectPass@123' });

      expect(lockedAttempt.status).toBe(429);
      expect(lockedAttempt.body.error).toBe('AccountLocked');
    });
  });

  // ==========================================================================
  // Test 3: Write through API creates audit_log row with correct actor_user_id
  // ==========================================================================
  describe('3. API write creates audit_log row with correct actor_user_id', () => {
    it('should record the authenticated user ID as actor_user_id in audit_log via triggers', async () => {
      // Log in as hostel office staff (user_id = 2)
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ login_id: 'office', password: 'Password@123' });

      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers['set-cookie'];
      const csrfToken = loginRes.body.csrfToken;

      const noticeTitle = `Audit Test Notice ${Date.now()}`;

      // Post a notice through API
      const noticeRes = await request(app)
        .post('/api/notices')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          category: 'CIRCULAR',
          title: noticeTitle,
          body: 'This notice tests database audit logging.',
          is_pinned: false,
        });

      expect(noticeRes.status).toBe(201);
      const noticeId = noticeRes.body.noticeId;
      expect(noticeId).toBeDefined();

      // Query audit_log for this insert
      const [auditRows] = await pool.query<any[]>(
        `SELECT log_id, actor_user_id, action, table_name, record_id, details 
         FROM audit_log 
         WHERE table_name = 'notices' AND record_id = ? 
         ORDER BY log_id DESC LIMIT 1`,
        [noticeId]
      );

      expect(auditRows.length).toBe(1);
      const audit = auditRows[0];
      expect(audit.action).toBe('INSERT');
      expect(audit.record_id).toBe(noticeId);
      // actor_user_id MUST match office user_id (2)
      expect(audit.actor_user_id).toBe(2);

      // Clean up notice
      await pool.query('DELETE FROM notices WHERE notice_id = ?', [noticeId]);
      await pool.query('DELETE FROM audit_log WHERE table_name = "notices" AND record_id = ?', [noticeId]);
    });
  });

  // ==========================================================================
  // Test 4: Pooled connection never leaks previous user's @app_user_id
  // ==========================================================================
  describe('4. Pooled connection never leaks previous user @app_user_id', () => {
    it('should set @app_user_id during withRequestConn and always clear it in finally', async () => {
      const mockUserId = 7777;

      // 1. Run withRequestConn and assert inside callback that @app_user_id is set
      await withRequestConn('STUDENT', mockUserId, async (conn) => {
        const [rows] = await conn.query<any[]>('SELECT @app_user_id AS uid');
        expect(rows[0].uid).toBe(mockUserId);
      });

      // 2. Fetch a raw connection from the same STUDENT pool without setting @app_user_id
      const studentPool = getPoolForRole('STUDENT');
      const conn = await studentPool.getConnection();
      try {
        const [rows] = await conn.query<any[]>('SELECT @app_user_id AS uid');
        expect(rows[0].uid).toBeNull();
      } finally {
        conn.release();
      }

      // 3. Test that an exception inside withRequestConn still clears @app_user_id
      try {
        await withRequestConn('STUDENT', 8888, async () => {
          throw new Error('Deliberate callback failure');
        });
      } catch (err: any) {
        expect(err.message).toBe('Deliberate callback failure');
      }

      const connAfterErr = await studentPool.getConnection();
      try {
        const [rows] = await connAfterErr.query<any[]>('SELECT @app_user_id AS uid');
        expect(rows[0].uid).toBeNull();
      } finally {
        connAfterErr.release();
      }
    });
  });

  // ==========================================================================
  // Test 5: STUDENT cannot call a staff endpoint
  // ==========================================================================
  describe('5. STUDENT cannot call staff endpoints', () => {
    it('should return 403 Forbidden when STUDENT tries to call admin reset-password', async () => {
      // Log in as STUDENT
      const studentLogin = await request(app)
        .post('/api/auth/login')
        .send({ login_id: '2026UCSDS0001', password: 'Password@123' });

      expect(studentLogin.status).toBe(200);
      const cookies = studentLogin.headers['set-cookie'];
      const csrfToken = studentLogin.body.csrfToken;

      // Try calling admin endpoint /api/auth/reset-password
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({ userId: 1, newPassword: 'NewPassword@123' });

      expect(resetRes.status).toBe(403);
      expect(resetRes.body.error).toBe('Forbidden');
    });

    it('should return 403 Forbidden when STUDENT tries to post a notice', async () => {
      const studentLogin = await request(app)
        .post('/api/auth/login')
        .send({ login_id: '2026UCSDS0001', password: 'Password@123' });

      expect(studentLogin.status).toBe(200);
      const cookies = studentLogin.headers['set-cookie'];
      const csrfToken = studentLogin.body.csrfToken;

      const noticeRes = await request(app)
        .post('/api/notices')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          category: 'CIRCULAR',
          title: 'Unauthorized Student Notice',
        });

      expect(noticeRes.status).toBe(403);
      expect(noticeRes.body.error).toBe('Forbidden');
    });
  });

  // ==========================================================================
  // Test 6: Users with must_change_password=1 can only call change-password
  // ==========================================================================
  describe('6. must_change_password restriction & password change flow', () => {
    const forcedUserLogin = 'test_forced_pwd_user';
    let forcedUserId: number;

    beforeAll(async () => {
      const hash = await bcrypt.hash('OldPassword@123', 10);
      await pool.query('DELETE FROM users WHERE login_id = ?', [forcedUserLogin]);
      const [res] = await pool.query<any>(
        `INSERT INTO users (login_id, password_hash, role, is_active, must_change_password, failed_attempts, locked_until)
         VALUES (?, ?, 'STUDENT', 1, 1, 0, NULL)`,
        [forcedUserLogin, hash]
      );
      forcedUserId = res.insertId;
    });

    afterAll(async () => {
      await pool.query('DELETE FROM users WHERE login_id = ?', [forcedUserLogin]);
    });

    it('should reject access to protected resources until password is changed', async () => {
      // 1. Log in with must_change_password = 1
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ login_id: forcedUserLogin, password: 'OldPassword@123' });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.mustChangePassword).toBe(true);
      const cookies = loginRes.headers['set-cookie'];
      const csrfToken = loginRes.body.csrfToken;

      // 2. Attempt to access other authenticated resource -> 403 PasswordChangeRequired
      const noticeRes = await request(app)
        .get('/api/notices')
        .set('Cookie', cookies);

      expect(noticeRes.status).toBe(403);
      expect(noticeRes.body.error).toBe('PasswordChangeRequired');

      // 3. /api/auth/me is permitted
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookies);
      expect(meRes.status).toBe(200);

      // 4. Change password
      const changeRes = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', cookies)
        .set('x-csrf-token', csrfToken)
        .send({
          currentPassword: 'OldPassword@123',
          newPassword: 'BrandNewPassword@2026',
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.mustChangePassword).toBe(false);

      const updatedCookies = changeRes.headers['set-cookie'];

      // 5. Now protected resources are accessible with the new session
      const noticeAfterRes = await request(app)
        .get('/api/notices')
        .set('Cookie', updatedCookies);

      expect(noticeAfterRes.status).toBe(200);
    });
  });

  // ==========================================================================
  // Test 7: Live database counts from GET /api/public/stats
  // ==========================================================================
  describe('7. GET /api/public/stats returns live database counts', () => {
    it('should return live application, bed, and cycle stats', async () => {
      const res = await request(app).get('/api/public/stats');

      expect(res.status).toBe(200);
      expect(res.body.applications).toBeDefined();
      expect(res.body.applications.total).toBeGreaterThanOrEqual(0);
      expect(res.body.beds).toBeDefined();
      expect(res.body.beds.total).toBe(300); // 300 beds seeded
      expect(res.body.currentCycle).toBeDefined();
      expect(res.body.currentCycle.academic_year).toBe('2026-27');
    });
  });

  // ==========================================================================
  // Test 8: No role may SELECT from complaints or complaint_responses
  // ==========================================================================
  describe('8. Database Privileges: complaints & complaint_responses cannot be SELECTed by any role', () => {
    it('should deny direct SELECT on complaints table to hc_admin and hc_student', async () => {
      const adminPool = getPoolForRole('ADMIN');
      const studentPool = getPoolForRole('STUDENT');

      // hc_admin attempting direct SELECT on complaints
      await expect(adminPool.query('SELECT * FROM complaints LIMIT 1')).rejects.toThrow(
        /command denied to user/i
      );

      // hc_student attempting direct SELECT on complaints
      await expect(studentPool.query('SELECT * FROM complaints LIMIT 1')).rejects.toThrow(
        /command denied to user/i
      );

      // hc_admin attempting direct SELECT on complaint_responses
      await expect(adminPool.query('SELECT * FROM complaint_responses LIMIT 1')).rejects.toThrow(
        /command denied to user/i
      );

      // hc_student attempting direct SELECT on complaint_responses
      await expect(studentPool.query('SELECT * FROM complaint_responses LIMIT 1')).rejects.toThrow(
        /command denied to user/i
      );
    });
  });

  // ==========================================================================
  // Test 9: Error Mapper (SIGNAL SQLSTATE 45000 -> 422, ER_DUP_ENTRY -> 409)
  // ==========================================================================
  describe('9. Error Mapper & MySQL Exception Translation', () => {
    it('should map SIGNAL SQLSTATE 45000 to HTTP 422 with plain-language text', async () => {
      // Create a test route dynamically or test error middleware directly
      const mockReq: any = { method: 'POST', path: '/test-error' };
      const mockRes: any = {
        statusCode: 0,
        body: null,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: any) {
          this.body = payload;
          return this;
        },
      };

      const { errorHandler } = await import('../middleware/errorHandler.js');

      // 1. SIGNAL 45000
      const signalErr: any = new Error('Study habit cannot be changed once an application has been submitted.');
      signalErr.sqlState = '45000';
      signalErr.sqlMessage = 'Study habit cannot be changed once an application has been submitted.';
      signalErr.errno = 1644;

      errorHandler(signalErr, mockReq, mockRes, () => {});
      expect(mockRes.statusCode).toBe(422);
      expect(mockRes.body.error).toBe('Business Rule Violation');
      expect(mockRes.body.message).toBe('Study habit cannot be changed once an application has been submitted.');
      expect(mockRes.body.sqlState).toBe('45000');

      // 2. ER_DUP_ENTRY (1062) -> 409
      const dupErr: any = new Error('Duplicate entry for key login_id');
      dupErr.errno = 1062;
      dupErr.code = 'ER_DUP_ENTRY';

      errorHandler(dupErr, mockReq, mockRes, () => {});
      expect(mockRes.statusCode).toBe(409);
      expect(mockRes.body.error).toBe('Conflict');
      expect(mockRes.body.message).toContain('already exists');

      // 3. ER_ROW_IS_REFERENCED_2 (1451) -> 409
      const fkErr: any = new Error('Cannot delete or update parent row');
      fkErr.errno = 1451;
      fkErr.code = 'ER_ROW_IS_REFERENCED_2';

      errorHandler(fkErr, mockReq, mockRes, () => {});
      expect(mockRes.statusCode).toBe(409);
      expect(mockRes.body.error).toBe('Conflict');
    });
  });

  // ==========================================================================
  // Test 10: CSRF Validation & Log Redaction
  // ==========================================================================
  describe('10. CSRF Protection and Credential Log Redaction', () => {
    it('should reject mutating requests missing a valid CSRF token with 403 Forbidden', async () => {
      // Log in as ADMIN
      const adminLogin = await request(app)
        .post('/api/auth/login')
        .send({ login_id: 'admin', password: 'Password@123' });

      expect(adminLogin.status).toBe(200);
      const cookies = adminLogin.headers['set-cookie'];

      // Send mutating POST without x-csrf-token
      const resWithoutCsrf = await request(app)
        .post('/api/notices')
        .set('Cookie', cookies)
        .send({
          category: 'CIRCULAR',
          title: 'Notice without CSRF',
        });

      expect(resWithoutCsrf.status).toBe(403);
      expect(resWithoutCsrf.body.error).toBe('Forbidden');
      expect(resWithoutCsrf.body.message).toContain('CSRF token');
    });

    it('should sanitize and redact passwords and tokens before logging', async () => {
      const { sanitizeLogData } = await import('../utils/sanitize.js');

      const sensitivePayload = {
        login_id: 'student_123',
        password: 'SuperSecretPassword@123',
        newPassword: 'AnotherSecretPassword@456',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        nested: {
          password_hash: '$2a$10$xyz',
          csrfToken: 'abcdef123456',
          safeField: 'VisibleData',
        },
      };

      const sanitized = sanitizeLogData(sensitivePayload);

      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.newPassword).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.nested.password_hash).toBe('[REDACTED]');
      expect(sanitized.nested.csrfToken).toBe('[REDACTED]');
      expect(sanitized.nested.safeField).toBe('VisibleData');
      expect(sanitized.login_id).toBe('student_123');
    });
  });
});
