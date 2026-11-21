import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/sanitize.js';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // Redact any sensitive information before logging
  logger.error(`[Error] ${req.method} ${req.path}:`, {
    message: err.message,
    errno: err.errno,
    sqlState: err.sqlState,
    code: err.code,
  });

  // 1. Database Custom Application Signal / Raise Exception: SQLSTATE '45000' or PostgreSQL 'P0001'
  if (err.sqlState === '45000' || err.code === '45000' || err.code === 'P0001' || err.errno === 1644) {
    return res.status(422).json({
      error: 'Business Rule Violation',
      message: err.sqlMessage || err.message || 'Operation rejected by database rule.',
      sqlState: '45000',
    });
  }

  // 2. Duplicate Key / Unique Constraint Violation -> 409 Conflict (PostgreSQL: 23505, MySQL: 1062 / ER_DUP_ENTRY)
  if (err.code === '23505' || err.errno === 1062 || err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'A record with this identifier or unique property already exists.',
      code: 'UNIQUE_VIOLATION',
    });
  }

  // 3. Foreign Key Reference Violation -> 409 Conflict / 422 Unprocessable Entity (PostgreSQL: 23503, MySQL: 1451/1452)
  if (err.code === '23503' || err.errno === 1451 || err.errno === 1452 || err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'Referenced foreign record either does not exist or has active dependencies.',
      code: 'FOREIGN_KEY_VIOLATION',
    });
  }

  // 4. Check Constraint Violated -> 422 Unprocessable Entity (PostgreSQL: 23514, MySQL: 3819)
  if (err.code === '23514' || err.errno === 3819 || err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    return res.status(422).json({
      error: 'Unprocessable Entity',
      message: 'Submitted values violate database check constraints.',
      code: 'CHECK_CONSTRAINT_VIOLATED',
    });
  }

  // 5. Database Privilege Denied -> 403 Forbidden (PostgreSQL: 42501, MySQL: 1142/1143)
  if (
    err.code === '42501' ||
    err.errno === 1142 ||
    err.errno === 1143 ||
    err.code === 'ER_TABLEACCESS_DENIED_ERROR' ||
    err.code === 'ER_COLUMNACCESS_DENIED_ERROR'
  ) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Database permission denied for this operation.',
      code: 'ACCESS_DENIED',
    });
  }

  // Standard HTTP or unexpected errors
  const status = typeof err.status === 'number' ? err.status : 500;
  return res.status(status).json({
    error: err.name || 'InternalServerError',
    message: status === 500 ? 'An unexpected error occurred.' : err.message,
  });
}
