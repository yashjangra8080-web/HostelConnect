import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { validate } from '../middleware/validate.js';

export const lookupsRouter = Router();

const citiesQuerySchema = z.object({
  state_id: z.coerce.number().int().positive().optional(),
});

/**
 * GET /api/lookups/states
 * Returns all Indian states/UTs.
 */
lookupsRouter.get('/states', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [rows] = await pool.query<any[]>(
      'SELECT state_id, state_name, state_code FROM states ORDER BY state_name ASC'
    );
    res.json({ states: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/lookups/cities
 * Returns cities, optionally filtered by state_id.
 */
lookupsRouter.get('/cities', validate(citiesQuerySchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stateId = req.query.state_id ? Number(req.query.state_id) : undefined;
    
    let sql = 'SELECT city_id, state_id, city_name, latitude, longitude FROM cities';
    const params: any[] = [];

    if (stateId) {
      sql += ' WHERE state_id = ?';
      params.push(stateId);
    }

    sql += ' ORDER BY city_name ASC';

    const [rows] = await pool.query<any[]>(sql, params);
    res.json({ cities: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/lookups/authorities
 * Returns authorities with hostel details.
 */
lookupsRouter.get('/authorities', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT a.authority_id, a.designation, a.full_name, h.hostel_name
       FROM authorities a
       LEFT JOIN hostels h ON a.hostel_id = h.hostel_id
       ORDER BY a.designation, a.full_name ASC`
    );
    res.json({ authorities: rows });
  } catch (err) {
    next(err);
  }
});
