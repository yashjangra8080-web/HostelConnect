import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../server/src/index.js';
import { closeAllPools } from '../server/src/db.js';

describe('Defect 2: Navigation & Sidebar Routes Audit', () => {
  afterAll(async () => {
    await closeAllPools();
  });

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

  // Parse all cases from App.tsx
  function getAppRoutes(): Set<string> {
    const appPath = path.resolve(process.cwd(), 'web/src/App.tsx');
    const content = fs.readFileSync(appPath, 'utf8');
    const caseRegex = /case\s+['"]([^'"]+)['"]\s*:/g;
    const routes = new Set<string>();
    let match;
    while ((match = caseRegex.exec(content)) !== null) {
      routes.add(match[1]);
    }
    return routes;
  }

  const roleCredentials: Record<string, string> = {
    ADMIN: 'admin',
    HOSTEL_OFFICE: 'office',
    CHIEF_WARDEN: 'chiefwarden',
    WARDEN: 'warden_bh1',
    MESS_MANAGER: 'mess_mgr',
    CARETAKER: 'caretaker_bh1',
    STUDENT: '2026UCSDS0001',
  };

  it('every sidebar nav path across all 7 roles maps to a defined non-404 route in App.tsx', async () => {
    const appRoutes = getAppRoutes();
    expect(appRoutes.size).toBeGreaterThan(15);

    for (const [role, loginId] of Object.entries(roleCredentials)) {
      const { cookieHeader } = await loginAs(loginId);
      const res = await request(app)
        .get('/api/nav')
        .set('Cookie', cookieHeader);

      expect(res.status).toBe(200);
      expect(res.body.role).toBe(role);
      expect(Array.isArray(res.body.groups)).toBe(true);

      const items = res.body.groups.flatMap((g: any) => g.items);
      expect(items.length).toBeGreaterThan(0);

      for (const item of items) {
        expect(item.path, `Role ${role} item "${item.label}" has invalid path`).toBeDefined();
        expect(item.path.startsWith('/'), `Path ${item.path} must start with /`).toBe(true);

        const isRouted = appRoutes.has(item.path);
        expect(
          isRouted,
          `Sidebar nav path "${item.path}" (Role: ${role}, Label: "${item.label}") is missing in App.tsx and returns 404!`
        ).toBe(true);
      }
    }
  });

  it('previously failing and defect-specific sidebar paths are all properly routed', () => {
    const appRoutes = getAppRoutes();
    const criticalPaths = [
      '/admin',
      '/admin/health',
      '/admin/audit',
      '/admin/allotments',
      '/admin/staff',
      '/office',
      '/chief-warden',
      '/chief-warden/allotments',
      '/chief-warden/occupancy',
      '/warden',
      '/mess',
      '/mess/menus',
      '/mess/maintenance',
      '/caretaker',
      '/student',
    ];

    for (const p of criticalPaths) {
      expect(appRoutes.has(p), `Critical path ${p} must be defined in App.tsx`).toBe(true);
    }
  });

  it('GET /api/admin/health returns live database health and telemetry for ADMIN', async () => {
    const { cookieHeader } = await loginAs('admin');
    const res = await request(app)
      .get('/api/admin/health')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.status).toMatch(/healthy|degraded/);
    expect(typeof res.body.latencyMs).toBe('number');
    expect(res.body.database.connected).toBe(true);
    expect(res.body.counts.students).toBeGreaterThan(0);
    expect(res.body.counts.rooms).toBeGreaterThan(0);
  });

  it('GET /api/admin/audit returns paginated mutation records for ADMIN', async () => {
    const { cookieHeader } = await loginAs('admin');
    const res = await request(app)
      .get('/api/admin/audit?page=1&pageSize=10')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.logs)).toBe(true);
    expect(res.body.pagination.total).toBeGreaterThan(0);
    expect(res.body.logs.length).toBeLessThanOrEqual(10);
  });

  it('GET /api/admin/staff returns official authorities for ADMIN', async () => {
    const { cookieHeader } = await loginAs('admin');
    const res = await request(app)
      .get('/api/admin/staff')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.staff)).toBe(true);
    expect(res.body.staff.length).toBeGreaterThanOrEqual(9);
  });

  it('GET /api/allotment/list returns room allocations for authorized roles', async () => {
    const { cookieHeader } = await loginAs('admin');
    const res = await request(app)
      .get('/api/allotment/list?cycle_id=1')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.allotments)).toBe(true);
    expect(res.body.counts.total).toBeGreaterThan(0);
  });

  it('GET /api/mess/timetable returns weekly schedule and meal provisions', async () => {
    const { cookieHeader } = await loginAs('mess_mgr');
    const res = await request(app)
      .get('/api/mess/timetable?hostel_id=1')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.meals)).toBe(true);
    expect(Array.isArray(res.body.meal_types)).toBe(true);
    expect(res.body.meal_types.length).toBe(4);
  });
});
