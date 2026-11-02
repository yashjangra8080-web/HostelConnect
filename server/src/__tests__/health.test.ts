import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { pool } from '../db.js';

describe('GET /api/health', () => {
  afterAll(async () => {
    await pool.end();
  });

  it('should return 200 OK with connected DB and event scheduler ON', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body.database).toHaveProperty('connected', true);
    expect(res.body.database.event_scheduler.toUpperCase()).toBe('ON');
    expect(res.body.database).toHaveProperty('time_zone');
    expect(res.body.database).toHaveProperty('server_time');
  });
});
