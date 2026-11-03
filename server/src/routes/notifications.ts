import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { withRequestConn } from '../db.js';

export const notificationsRouter = Router();

/**
 * GET /api/notifications/count
 * Returns unread notifications count for the authenticated user.
 */
notificationsRouter.get('/count', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = req.user!;
    const unreadCount = await withRequestConn(session.role, session.userId, async (conn) => {
      const [rows] = await conn.query<any[]>(
        `SELECT COUNT(*) AS count 
         FROM notifications 
         WHERE user_id = ? AND is_read = 0`,
        [session.userId]
      );
      return Number(rows[0]?.count || 0);
    });

    return res.status(200).json({ unreadCount });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/notifications
 * Returns paginated notifications and unread count for the authenticated user.
 * Supports filtering by unreadOnly and notif_type, sorted unread-first.
 */
notificationsRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = req.user!;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 10));
    const offset = (page - 1) * pageSize;
    const unreadOnly = req.query.unreadOnly === 'true' || req.query.status === 'unread';
    const typeFilter = typeof req.query.type === 'string' && req.query.type.trim() ? req.query.type.trim() : null;

    const data = await withRequestConn(session.role, session.userId, async (conn) => {
      // 1. Total counts for this user
      const [countRows] = await conn.query<any[]>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread
         FROM notifications 
         WHERE user_id = ?`,
        [session.userId]
      );
      const total = Number(countRows[0]?.total || 0);
      const unreadCount = Number(countRows[0]?.unread || 0);

      // 2. Build filtered WHERE clause
      const whereClauses = ['user_id = ?'];
      const params: any[] = [session.userId];

      if (unreadOnly) {
        whereClauses.push('is_read = 0');
      }

      if (typeFilter) {
        whereClauses.push('notif_type = ?');
        params.push(typeFilter);
      }

      const whereSql = whereClauses.join(' AND ');

      // Filtered count
      const [filteredCountRows] = await conn.query<any[]>(
        `SELECT COUNT(*) AS filtered_total FROM notifications WHERE ${whereSql}`,
        params
      );
      const filteredTotal = Number(filteredCountRows[0]?.filtered_total || 0);

      // 3. Paginated rows ordered unread-first, then newest first
      const queryParams = [...params, pageSize, offset];
      const [rows] = await conn.query<any[]>(
        `SELECT notif_id, notif_type, title, body, link, is_read, created_at
         FROM notifications 
         WHERE ${whereSql}
         ORDER BY is_read ASC, created_at DESC, notif_id DESC 
         LIMIT ? OFFSET ?`,
        queryParams
      );

      const notifications = rows.map((r) => ({
        ...r,
        is_read: Boolean(r.is_read),
      }));

      return {
        notifications,
        total: filteredTotal,
        overallTotal: total,
        unreadCount,
        page,
        pageSize,
        totalPages: Math.ceil(filteredTotal / pageSize) || 1,
      };
    });

    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Marks a notification as read (with authorization check).
 */
notificationsRouter.patch('/:id/read', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = req.user!;
    const notifId = parseInt(req.params.id, 10);
    if (isNaN(notifId)) {
      return res.status(400).json({ error: 'InvalidId', message: 'Invalid notification ID' });
    }

    const result = await withRequestConn(session.role, session.userId, async (conn) => {
      // Check notification existence and ownership
      const [rows] = await conn.query<any[]>(
        'SELECT user_id, is_read FROM notifications WHERE notif_id = ? LIMIT 1',
        [notifId]
      );

      if (rows.length === 0) {
        return { status: 404, body: { error: 'NotFound', message: 'Notification not found' } };
      }

      if (rows[0].user_id !== session.userId) {
        return {
          status: 403,
          body: { error: 'Forbidden', message: "Cannot mark another user's notification as read" },
        };
      }

      await conn.query(
        `UPDATE notifications 
         SET is_read = 1 
         WHERE notif_id = ? AND user_id = ?`,
        [notifId, session.userId]
      );

      return { status: 200, body: { success: true, notif_id: notifId, is_read: true } };
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/notifications/:id/unread
 * Marks a notification as unread (with authorization check).
 */
notificationsRouter.patch('/:id/unread', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = req.user!;
    const notifId = parseInt(req.params.id, 10);
    if (isNaN(notifId)) {
      return res.status(400).json({ error: 'InvalidId', message: 'Invalid notification ID' });
    }

    const result = await withRequestConn(session.role, session.userId, async (conn) => {
      // Check notification existence and ownership
      const [rows] = await conn.query<any[]>(
        'SELECT user_id, is_read FROM notifications WHERE notif_id = ? LIMIT 1',
        [notifId]
      );

      if (rows.length === 0) {
        return { status: 404, body: { error: 'NotFound', message: 'Notification not found' } };
      }

      if (rows[0].user_id !== session.userId) {
        return {
          status: 403,
          body: { error: 'Forbidden', message: "Cannot mark another user's notification as unread" },
        };
      }

      await conn.query(
        `UPDATE notifications 
         SET is_read = 0 
         WHERE notif_id = ? AND user_id = ?`,
        [notifId, session.userId]
      );

      return { status: 200, body: { success: true, notif_id: notifId, is_read: false } };
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notifications/read-all
 * Marks all notifications for the session user as read.
 */
notificationsRouter.post('/read-all', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = req.user!;
    await withRequestConn(session.role, session.userId, async (conn) => {
      await conn.query(
        `UPDATE notifications 
         SET is_read = 1 
         WHERE user_id = ? AND is_read = 0`,
        [session.userId]
      );
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
});
