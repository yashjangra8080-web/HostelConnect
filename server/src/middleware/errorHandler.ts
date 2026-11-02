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

  // 1. MySQL Custom Application Signal: SIGNAL SQLSTATE '45000'
  if (err.sqlState === '45000' || err.errno === 1644) {
    return res.status(422).json({
      error: 'Business Rule Violation',
      message: err.sqlMessage || err.message || 'Operation rejected by database rule.',
      sqlState: '45000',
    });
  }

  // 2. MySQL Duplicate Key (ER_DUP_ENTRY) -> 409 Conflict
  if (err.errno === 1062 || err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'A record with this identifier or unique property already exists.',
      code: 'ER_DUP_ENTRY',
    });
  }

  // 3. MySQL Foreign Key Restrict on Delete/Update -> 409 Conflict
  if (err.errno === 1451 || err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'Cannot delete or update this record because other records depend on it.',
      code: 'ER_ROW_IS_REFERENCED',
    });
  }

  // 4. MySQL Foreign Key Missing Reference -> 422 Unprocessable Entity
  if (err.errno === 1452 || err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(422).json({
      error: 'Unprocessable Entity',
      message: 'Referenced parent record does not exist in the database.',
      code: 'ER_NO_REFERENCED_ROW',
    });
  }

  // 5. MySQL Check Constraint Violated -> 422 Unprocessable Entity
  if (err.errno === 3819 || err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    return res.status(422).json({
      error: 'Unprocessable Entity',
      message: 'Submitted values violate database check constraints.',
      code: 'ER_CHECK_CONSTRAINT_VIOLATED',
    });
  }

  // 6. MySQL Privilege Denied -> 403 Forbidden
  if (
    err.errno === 1142 ||
    err.errno === 1143 ||
    err.code === 'ER_TABLEACCESS_DENIED_ERROR' ||
    err.code === 'ER_COLUMNACCESS_DENIED_ERROR'
  ) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Database permission denied for this role.',
      code: 'ER_TABLEACCESS_DENIED',
    });
  }

  // Standard HTTP or unexpected errors
  const status = typeof err.status === 'number' ? err.status : 500;
  return res.status(status).json({
    error: err.name || 'InternalServerError',
    message: status === 500 ? 'An unexpected error occurred.' : err.message,
  });
}
