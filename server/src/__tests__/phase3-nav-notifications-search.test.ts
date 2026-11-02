import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { closeAllPools } from '../db.js';

describe('Phase 3: Backend Additions (Nav, Notifications, Search)', () => {
  afterAll(async () => {
    await closeAllPools();
  });

  // Helper to log in and get cookie header
  async function loginAs(login_id: string) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ login_id, password: 'Password@123' });
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'];
    return {
      cookieHeader: cookies.map((c: string) => c.split(';')[0]).join('; '),
      user: res.body.user,
    };
  }

  describe('GET /api/nav', () => {
    it('should reject unauthenticated request', async () => {
      const res = await request(app).get('/api/nav');
      expect(res.status).toBe(401);
    });

    it('should return role-aware navigation for ADMIN', async () => {
      const { cookieHeader } = await loginAs('admin');
      const res = await request(app)
        .get('/api/nav')
        .set('Cookie', cookieHeader);

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('ADMIN');
      expect(Array.isArray(res.body.groups)).toBe(true);
      expect(res.body.groups.length).toBeGreaterThan(0);
      const allItems = res.body.groups.flatMap((g: any) => g.items);
      expect(allItems.some((item: any) => item.key === 'audit')).toBe(true);
      expect(allItems.some((item: any) => item.key === 'design')).toBe(false);
    });

    it('should return role-aware navigation for STUDENT', async () => {
      const { cookieHeader } = await loginAs('2026UCSDS0001');
      const res = await request(app)
        .get('/api/nav')
        .set('Cookie', cookieHeader);

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('STUDENT');
      const allItems = res.body.groups.flatMap((g: any) => g.items);
      expect(allItems.some((item: any) => item.key === 'allotment')).toBe(true);
      expect(allItems.some((item: any) => item.key === 'mess')).toBe(true);
      expect(allItems.some((item: any) => item.key === 'laundry')).toBe(true);
    });
  });

  describe('GET /api/notifications/count', () => {
    it('should return unread notification count for authenticated user', async () => {
      const { cookieHeader } = await loginAs('admin');
      const res = await request(app)
        .get('/api/notifications/count')
        .set('Cookie', cookieHeader);

      expect(res.status).toBe(200);
      expect(typeof res.body.unreadCount).toBe('number');
      expect(res.body.unreadCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/search', () => {
    it('should return max 8 results for staff searching students', async () => {
      const { cookieHeader } = await loginAs('admin');
      const res = await request(app)
        .get('/api/search?q=2026')
        .set('Cookie', cookieHeader);

      expect(res.status).toBe(200);
      expect(res.body.query).toBe('2026');
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results.length).toBeLessThanOrEqual(8);
      if (res.body.results.length > 0) {
        expect(res.body.results[0].type).toBe('student');
        expect(res.body.results[0].title).toBeDefined();
        expect(res.body.results[0].subtitle).toBeDefined();
      }
    });

    it('should return max 8 results for student searching pages and records', async () => {
      const { cookieHeader } = await loginAs('2026UCSDS0001');
      const res = await request(app)
        .get('/api/search?q=mess')
        .set('Cookie', cookieHeader);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results.length).toBeLessThanOrEqual(8);
      expect(res.body.results.some((r: any) => r.type === 'page')).toBe(true);
    });
  });
});
