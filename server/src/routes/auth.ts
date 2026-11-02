import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { pool, withRequestConn, Role } from '../db.js';
import { requireAuth, requireRole, verifyCsrf } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const authRouter = Router();

// In-memory rate limiting map for login IP tracking
const loginRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const LOGIN_RATE_LIMIT_MAX = 20; // 20 requests
const LOGIN_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function loginRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = loginRateLimitMap.get(ip);

  if (entry && now < entry.resetAt) {
    if (entry.count >= LOGIN_RATE_LIMIT_MAX) {
      return res.status(429).json({
        error: 'TooManyRequests',
        message: 'Too many login attempts from this network. Please wait a minute.',
      });
    }
    entry.count++;
  } else {
    loginRateLimitMap.set(ip, { count: 1, resetAt: now + LOGIN_RATE_LIMIT_WINDOW_MS });
  }

  next();
}

// Validation schemas
const loginSchema = z.object({
  login_id: z.string().min(1, 'Login ID is required'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

const resetPasswordSchema = z.object({
  userId: z.number().int().positive('Valid user ID is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

/**
 * POST /api/auth/login
 * Validates credentials, checks account lockout, sets failed_attempts,
 * issues JWT in httpOnly SameSite cookie and CSRF token.
 */
authRouter.post(
  '/login',
  loginRateLimiter,
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { login_id, password } = req.body;

      // Use system pool to safely query user credentials
      const [userRows] = await pool.query<any[]>(
        `SELECT user_id, login_id, password_hash, role, is_active, 
                must_change_password, failed_attempts, locked_until 
         FROM users 
         WHERE login_id = ?`,
        [login_id]
      );

      if (!userRows || userRows.length === 0) {
        return res.status(401).json({
          error: 'InvalidCredentials',
          message: 'Invalid login credentials.',
        });
      }

      const user = userRows[0];

      if (!user.is_active) {
        return res.status(403).json({
          error: 'AccountDeactivated',
          message: 'Your account is currently deactivated. Contact Hostel Administration.',
        });
      }

      // Check account lockout
      if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
        const remainingMinutes = Math.ceil(
          (new Date(user.locked_until).getTime() - Date.now()) / (60 * 1000)
        );
        return res.status(429).json({
          error: 'AccountLocked',
          message: `Account is temporarily locked due to multiple failed login attempts. Try again in ${remainingMinutes} minute(s).`,
        });
      }

      // Verify bcrypt password
      const passwordMatch = await bcrypt.compare(password, user.password_hash);

      if (!passwordMatch) {
        const newFailedAttempts = (user.failed_attempts || 0) + 1;
        let newLockedUntil: Date | null = null;

        if (newFailedAttempts >= 5) {
          // Lock account for 15 minutes
          newLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        }

        await pool.query(
          `UPDATE users 
           SET failed_attempts = ?, locked_until = ? 
           WHERE user_id = ?`,
          [newFailedAttempts, newLockedUntil, user.user_id]
        );

        if (newFailedAttempts >= 5) {
          return res.status(429).json({
            error: 'AccountLocked',
            message: 'Account has been locked for 15 minutes due to 5 consecutive failed attempts.',
          });
        }

        return res.status(401).json({
          error: 'InvalidCredentials',
          message: 'Invalid login credentials.',
          attemptsRemaining: 5 - newFailedAttempts,
        });
      }

      // Successful password verification: reset failed attempts & lockout
      await pool.query(
        `UPDATE users 
         SET failed_attempts = 0, locked_until = NULL 
         WHERE user_id = ?`,
        [user.user_id]
      );

      // Generate CSRF token & JWT
      const csrfToken = crypto.randomBytes(32).toString('hex');
      const token = jwt.sign(
        {
          userId: user.user_id,
          loginId: user.login_id,
          role: user.role,
          mustChangePassword: Boolean(user.must_change_password),
          csrfToken,
        },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn as any }
      );

      const isProduction = config.nodeEnv === 'production';

      // Set httpOnly SameSite cookie for JWT session
      res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: isProduction,
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
      });

      // Set non-httpOnly SameSite cookie for CSRF verification
      res.cookie('csrf_token', csrfToken, {
        httpOnly: false,
        sameSite: 'strict',
        secure: isProduction,
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
      });

      return res.status(200).json({
        message: 'Login successful',
        user: {
          userId: user.user_id,
          loginId: user.login_id,
          role: user.role,
          mustChangePassword: Boolean(user.must_change_password),
        },
        csrfToken,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/logout
 * Clears JWT session cookie and CSRF cookie.
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token', { path: '/' });
  res.clearCookie('csrf_token', { path: '/' });
  return res.status(200).json({ message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 * Returns currently authenticated user details, resolved via role connection pool.
 */
authRouter.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = req.user!;

    const userProfile = await withRequestConn(session.role, session.userId, async (conn) => {
      const [users] = await conn.query<any[]>(
        `SELECT user_id, login_id, role, is_active, must_change_password, created_at 
         FROM users 
         WHERE user_id = ?`,
        [session.userId]
      );

      if (!users || users.length === 0) {
        return null;
      }

      const u = users[0];

      let studentProfile = null;
      let authorityProfile = null;

      if (u.role === 'STUDENT') {
        const [students] = await conn.query<any[]>(
          `SELECT student_id, roll_no, full_name, gender, branch, batch_year, 
                  merit_rank, is_delhi_candidate, study_habit, phone, email 
           FROM students 
           WHERE user_id = ?`,
          [session.userId]
        );
        studentProfile = students[0] || null;
      } else {
        const [authorities] = await conn.query<any[]>(
          `SELECT authority_id, hostel_id, designation, full_name 
           FROM authorities 
           WHERE user_id = ?`,
          [session.userId]
        );
        authorityProfile = authorities[0] || null;
      }

      return {
        ...u,
        must_change_password: Boolean(u.must_change_password),
        is_active: Boolean(u.is_active),
        student: studentProfile,
        authority: authorityProfile,
      };
    });

    if (!userProfile) {
      return res.status(404).json({ error: 'UserNotFound', message: 'User profile not found.' });
    }

    return res.status(200).json({ user: userProfile });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/change-password
 * Allows user to change their password and clears must_change_password flag.
 */
authRouter.post(
  '/change-password',
  requireAuth,
  verifyCsrf,
  validate(changePasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = req.user!;
      const { currentPassword, newPassword } = req.body;

      // Verify current password first
      const [userRows] = await pool.query<any[]>(
        'SELECT password_hash FROM users WHERE user_id = ?',
        [session.userId]
      );

      if (!userRows || userRows.length === 0) {
        return res.status(404).json({ error: 'UserNotFound', message: 'User not found.' });
      }

      const match = await bcrypt.compare(currentPassword, userRows[0].password_hash);
      if (!match) {
        return res.status(400).json({
          error: 'InvalidCurrentPassword',
          message: 'The current password you entered is incorrect.',
        });
      }

      // Hash new password
      const newHash = await bcrypt.hash(newPassword, 10);

      // Update password using caller's role connection pool
      await withRequestConn(session.role, session.userId, async (conn) => {
        await conn.query(
          `UPDATE users 
           SET password_hash = ?, must_change_password = 0, failed_attempts = 0, locked_until = NULL 
           WHERE user_id = ?`,
          [newHash, session.userId]
        );
      });

      // Issue refreshed JWT with mustChangePassword = false
      const csrfToken = session.csrfToken || crypto.randomBytes(32).toString('hex');
      const newToken = jwt.sign(
        {
          userId: session.userId,
          loginId: session.loginId,
          role: session.role,
          mustChangePassword: false,
          csrfToken,
        },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn as any }
      );

      const isProduction = config.nodeEnv === 'production';
      res.cookie('token', newToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: isProduction,
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
      });

      return res.status(200).json({
        message: 'Password changed successfully.',
        mustChangePassword: false,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/reset-password
 * Admin only: Resets a user's password and forces must_change_password = 1.
 */
authRouter.post(
  '/reset-password',
  requireAuth,
  requireRole('ADMIN'),
  verifyCsrf,
  validate(resetPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = req.user!;
      const { userId, newPassword } = req.body;

      const newHash = await bcrypt.hash(newPassword, 10);

      // Perform update via ADMIN role pool with audit actor
      const affectedRows = await withRequestConn('ADMIN', session.userId, async (conn) => {
        const [result] = await conn.query<any>(
          `UPDATE users 
           SET password_hash = ?, must_change_password = 1, failed_attempts = 0, locked_until = NULL 
           WHERE user_id = ?`,
          [newHash, userId]
        );
        return result.affectedRows;
      });

      if (affectedRows === 0) {
        return res.status(404).json({
          error: 'UserNotFound',
          message: `User with ID ${userId} does not exist.`,
        });
      }

      return res.status(200).json({
        message: `Password reset successfully for user ID ${userId}. User must change password upon next login.`,
        userId,
      });
    } catch (err) {
      next(err);
    }
  }
);
