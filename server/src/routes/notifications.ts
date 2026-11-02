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
 */
notificationsRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = req.user!;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 10));
    const offset = (page - 1) * pageSize;

    const data = await withRequestConn(session.role, session.userId, async (conn) => {
      // 1. Total count
      const [countRows] = await conn.query<any[]>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread
         FROM notifications 
         WHERE user_id = ?`,
        [session.userId]
      );
      const total = Number(countRows[0]?.total || 0);
      const unreadCount = Number(countRows[0]?.unread || 0);

      // 2. Paginated rows
      const [rows] = await conn.query<any[]>(
        `SELECT notif_id, notif_type, title, body, link, is_read, created_at
         FROM notifications 
         WHERE user_id = ? 
         ORDER BY notif_id DESC 
         LIMIT ? OFFSET ?`,
        [session.userId, pageSize, offset]
      );

      const notifications = rows.map((r) => ({
        ...r,
        is_read: Boolean(r.is_read),
      }));

      return { notifications, total, unreadCount, page, pageSize };
    });

    return res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Marks a notification as read.
 */
notificationsRouter.patch('/:id/read', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = req.user!;
    const notifId = parseInt(req.params.id, 10);
    if (isNaN(notifId)) {
      return res.status(400).json({ error: 'InvalidId', message: 'Invalid notification ID' });
    }

    await withRequestConn(session.role, session.userId, async (conn) => {
      await conn.query(
        `UPDATE notifications 
         SET is_read = 1 
         WHERE notif_id = ? AND user_id = ?`,
        [notifId, session.userId]
      );
    });

    return res.status(200).json({ success: true });
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
