import { Router, Request, Response, NextFunction } from 'express';
import { withRequestConn } from '../db.js';

export const publicRouter = Router();

/**
 * GET /api/public/stats
 * Returns live database metrics:
 * - Applications (total, verified, pending)
 * - Beds (total capacity, occupied, available)
 * - Active allotment cycle status
 */
publicRouter.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Read stats using STUDENT (public-accessible) pool
    const stats = await withRequestConn('STUDENT', null, async (conn) => {
      // 1. Application counts
      const [appRows] = await conn.query<any[]>(`
        SELECT 
          COUNT(*) AS total,
          SUM(CASE WHEN verification_status = 'VERIFIED' THEN 1 ELSE 0 END) AS verified,
          SUM(CASE WHEN verification_status = 'PENDING' THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN verification_status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected
        FROM applications
      `);

      // 2. Bed & room counts
      const [bedRows] = await conn.query<any[]>(`
        SELECT 
          COALESCE(SUM(capacity), 0) AS total_beds,
          COALESCE(SUM(occupied_count), 0) AS occupied_beds,
          COALESCE(SUM(capacity - occupied_count), 0) AS available_beds,
          COUNT(*) AS total_rooms
        FROM rooms
      `);

      // 3. Current active cycle
      const [cycleRows] = await conn.query<any[]>(`
        SELECT 
          cycle_id, academic_year, status, opened_on, closed_on, published_on, response_deadline
        FROM allotment_cycles
        ORDER BY cycle_id DESC
        LIMIT 1
      `);

      return {
        applications: {
          total: Number(appRows[0]?.total || 0),
          verified: Number(appRows[0]?.verified || 0),
          pending: Number(appRows[0]?.pending || 0),
          rejected: Number(appRows[0]?.rejected || 0),
        },
        beds: {
          total: Number(bedRows[0]?.total_beds || 0),
          occupied: Number(bedRows[0]?.occupied_beds || 0),
          available: Number(bedRows[0]?.available_beds || 0),
          totalRooms: Number(bedRows[0]?.total_rooms || 0),
        },
        currentCycle: cycleRows[0] || null,
        timestamp: new Date().toISOString(),
      };
    });

    return res.status(200).json(stats);
  } catch (err) {
    next(err);
  }
});
