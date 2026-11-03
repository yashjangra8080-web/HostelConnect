import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { pool, closeAllPools } from '../db.js';

describe('Task 2: Notifications API & Permissions', () => {
  let user1Cookie: string;
  let user2Cookie: string;
  let user1Id: number;
  let user2Id: number;
  let user1NotifId: number;
  let user2NotifId: number;

  beforeAll(async () => {
    // Login as Krishna Gupta (2026UITX0192)
    const res1 = await request(app)
      .post('/api/auth/login')
      .send({ login_id: '2026UITX0192', password: 'Password@123' });
    expect(res1.status).toBe(200);
    user1Cookie = res1.headers['set-cookie'].map((c: string) => c.split(';')[0]).join('; ');
    user1Id = res1.body.user.userId;

    // Login as Dev Sethi (2026UCSDS0001)
    const res2 = await request(app)
      .post('/api/auth/login')
      .send({ login_id: '2026UCSDS0001', password: 'Password@123' });
    expect(res2.status).toBe(200);
    user2Cookie = res2.headers['set-cookie'].map((c: string) => c.split(';')[0]).join('; ');
    user2Id = res2.body.user.userId;

    // Ensure user1 has an unread notification
    const [u1Notifs]: any = await pool.query(
      'SELECT notif_id FROM notifications WHERE user_id = ? ORDER BY notif_id ASC LIMIT 1',
      [user1Id]
    );
    if (u1Notifs.length > 0) {
      user1NotifId = u1Notifs[0].notif_id;
      await pool.query('UPDATE notifications SET is_read = 0 WHERE notif_id = ?', [user1NotifId]);
    } else {
      const [insertRes]: any = await pool.query(
        'INSERT INTO notifications (user_id, notif_type, title, body, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [user1Id, 'NOTICE', 'Test Notice User 1', 'Body 1', '/notices?open=1', 0]
      );
      user1NotifId = insertRes.insertId;
    }

    // Ensure user2 has an unread notification
    const [u2Notifs]: any = await pool.query(
      'SELECT notif_id FROM notifications WHERE user_id = ? ORDER BY notif_id ASC LIMIT 1',
      [user2Id]
    );
    if (u2Notifs.length > 0) {
      user2NotifId = u2Notifs[0].notif_id;
      await pool.query('UPDATE notifications SET is_read = 0 WHERE notif_id = ?', [user2NotifId]);
    } else {
      const [insertRes]: any = await pool.query(
        'INSERT INTO notifications (user_id, notif_type, title, body, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [user2Id, 'ALLOTMENT', 'Test Allotment User 2', 'Body 2', '/student/allotment', 0]
      );
      user2NotifId = insertRes.insertId;
    }
  });

  afterAll(async () => {
    await closeAllPools();
  });

  describe('GET /api/notifications', () => {
    it('requires authentication', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
    });

    it('returns notifications sorted unread first', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.notifications)).toBe(true);
      expect(res.body.notifications.length).toBeGreaterThan(0);

      // Verify unread-first sorting
      let seenRead = false;
      for (const n of res.body.notifications) {
        if (n.is_read) {
          seenRead = true;
        } else if (seenRead) {
          // If we see an unread notification after a read one, order is wrong
          expect(n.is_read).toBe(false);
        }
      }
    });

    it('filters by unreadOnly=true', async () => {
      const res = await request(app)
        .get('/api/notifications?unreadOnly=true')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      for (const n of res.body.notifications) {
        expect(Boolean(n.is_read)).toBe(false);
      }
    });

    it('filters by type', async () => {
      const res = await request(app)
        .get('/api/notifications?type=NOTICE')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      for (const n of res.body.notifications) {
        expect(n.notif_type).toBe('NOTICE');
      }
    });
  });

  describe('PATCH /api/notifications/:id/read - Ownership Security', () => {
    it('forbids marking another user notification as read (HTTP 403)', async () => {
      // User 1 tries to mark User 2's notification as read
      const res = await request(app)
        .patch(`/api/notifications/${user2NotifId}/read`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/forbidden|not authorized/i);

      // Verify user 2's notification is still unread
      const [rows]: any = await pool.query(
        'SELECT is_read FROM notifications WHERE notif_id = ?',
        [user2NotifId]
      );
      expect(rows[0].is_read).toBe(0);
    });

    it('forbids marking another user notification as unread (HTTP 403)', async () => {
      // User 2 tries to unread User 1's notification
      const res = await request(app)
        .patch(`/api/notifications/${user1NotifId}/unread`)
        .set('Cookie', user2Cookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/forbidden|not authorized/i);
    });

    it('allows owner to mark their notification as read', async () => {
      const res = await request(app)
        .patch(`/api/notifications/${user1NotifId}/read`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Check DB
      const [rows]: any = await pool.query(
        'SELECT is_read FROM notifications WHERE notif_id = ?',
        [user1NotifId]
      );
      expect(rows[0].is_read).toBe(1);
    });

    it('allows owner to mark their notification as unread', async () => {
      const res = await request(app)
        .patch(`/api/notifications/${user1NotifId}/unread`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Check DB
      const [rows]: any = await pool.query(
        'SELECT is_read FROM notifications WHERE notif_id = ?',
        [user1NotifId]
      );
      expect(rows[0].is_read).toBe(0);
    });
  });

  describe('POST /api/notifications/read-all', () => {
    it('marks all notifications as read for current user only', async () => {
      // Ensure user1 has at least 1 unread
      await pool.query('UPDATE notifications SET is_read = 0 WHERE notif_id = ?', [user1NotifId]);
      // Ensure user2 has at least 1 unread
      await pool.query('UPDATE notifications SET is_read = 0 WHERE notif_id = ?', [user2NotifId]);

      const res = await request(app)
        .post('/api/notifications/read-all')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Check user1 count is 0
      const countRes = await request(app)
        .get('/api/notifications/count')
        .set('Cookie', user1Cookie);
      expect(countRes.status).toBe(200);
      expect(countRes.body.unreadCount).toBe(0);

      // User 2's unread notifications MUST remain intact!
      const user2Count = await request(app)
        .get('/api/notifications/count')
        .set('Cookie', user2Cookie);
      expect(user2Count.status).toBe(200);
      expect(user2Count.body.unreadCount).toBeGreaterThan(0);
    });
  });
});
