import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { Role } from '../db.js';

export interface UserSession {
  userId: number;
  loginId: string;
  role: Role;
  mustChangePassword: boolean;
  csrfToken?: string;
  studentId?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserSession;
    }
  }
}

/**
 * Validates JWT session from httpOnly cookie or Authorization header.
 * Enforces strict restriction for users with must_change_password=1:
 * they may only invoke change-password, me, or logout until password is changed.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication session token is missing or expired.',
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as UserSession;
    req.user = decoded;

    // Enforce password change requirement
    if (decoded.mustChangePassword) {
      const allowedPaths = [
        '/api/auth/change-password',
        '/api/auth/logout',
        '/api/auth/me',
      ];
      const isAllowed = allowedPaths.some((p) => req.originalUrl.startsWith(p));

      if (!isAllowed) {
        return res.status(403).json({
          error: 'PasswordChangeRequired',
          message: 'Password change is required before accessing other resources.',
          mustChangePassword: true,
        });
      }
    }

    next();
  } catch (err: any) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired session token.',
    });
  }
}

/**
 * Role-Based Access Control Middleware.
 * Supports both requireRole('A', 'B') and requireRole(['A', 'B']).
 */
export function requireRole(...allowedRoles: (Role | Role[])[]) {
  const flattened = allowedRoles.flat();
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
    }

    if (!flattened.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Role ${req.user.role} is not permitted to access this resource.`,
      });
    }

    next();
  };
}

/**
 * Checks CSRF token on mutating requests (POST, PUT, PATCH, DELETE).
 * Skips login endpoint where user doesn't have a session yet.
 */
export function verifyCsrf(req: Request, res: Response, next: NextFunction) {
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!mutatingMethods.includes(req.method)) {
    return next();
  }

  // Exempt unauthenticated login endpoint
  if (req.originalUrl === '/api/auth/login') {
    return next();
  }

  const clientCsrfToken =
    (req.headers['x-csrf-token'] as string) ||
    (req.headers['x-xsrf-token'] as string) ||
    req.body?._csrf;

  const cookieCsrfToken = req.cookies?.csrf_token;
  const sessionCsrfToken = req.user?.csrfToken;

  const expectedCsrfToken = cookieCsrfToken || sessionCsrfToken;

  if (!clientCsrfToken || !expectedCsrfToken || clientCsrfToken !== expectedCsrfToken) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or missing CSRF token on mutating request.',
    });
  }

  next();
}
