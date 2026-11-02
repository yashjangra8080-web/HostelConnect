import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { withRequestConn } from '../db.js';
import { requireAuth, requireRole, verifyCsrf } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const waterReportsRouter = Router();

const createWaterReportSchema = z.object({
  hostel_id: z.number().int().positive(),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in YYYY-MM-DD format'),
  tds_ppm: z.number().int().min(0),
  ph: z.number().min(0).max(14),
  chlorine_mgl: z.number().min(0),
  remarks: z.string().max(255).optional().nullable(),
});

async function getWaterLimits(conn: any) {
  const [settings]: any = await conn.query(
    `SELECT setting_key, setting_value FROM app_settings 
     WHERE setting_key IN ('water_tds_max_safe', 'water_ph_min_safe', 'water_ph_max_safe', 'water_chlorine_min_safe', 'water_chlorine_max_safe')`
  );
  const map: Record<string, number> = {};
  for (const s of settings) {
    map[s.setting_key] = parseFloat(s.setting_value);
  }
  return {
    tdsMax: map['water_tds_max_safe'] ?? 500,
    phMin: map['water_ph_min_safe'] ?? 6.5,
    phMax: map['water_ph_max_safe'] ?? 8.5,
    chlorineMin: map['water_chlorine_min_safe'] ?? 0.20,
    chlorineMax: map['water_chlorine_max_safe'] ?? 0.50,
  };
}

/**
 * GET /api/water-reports/trend?hostel=
 * Returns 10 weeks of reports sorted chronologically with app_settings limits.
 */
waterReportsRouter.get('/trend', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    let targetHostelId = req.query.hostel ? parseInt(req.query.hostel as string, 10) : 1;

    const result = await withRequestConn(user.role, user.userId, async (conn) => {
      // Scoping for students: locked to their residence
      if (user.role === 'STUDENT') {
        const [resRows] = await conn.query<any[]>(
          'SELECT hostel_id FROM v_current_residence WHERE user_id = ? LIMIT 1',
          [user.userId]
        );
        targetHostelId = resRows[0]?.hostel_id || 1;
      }

      const limits = await getWaterLimits(conn);

      const [hostelRows] = await conn.query<any[]>(
        'SELECT hostel_id, hostel_name FROM hostels WHERE hostel_id = ?',
        [targetHostelId]
      );
      const hostelName = hostelRows[0]?.hostel_name || `Hostel ${targetHostelId}`;

      const [rows] = await conn.query<any[]>(
        `SELECT r.report_id, r.hostel_id, h.hostel_name, 
                DATE_FORMAT(r.week_start, '%Y-%m-%d') AS week_start,
                r.tds_ppm, r.ph, r.chlorine_mgl, r.verdict, r.remarks,
                auth.full_name AS posted_by_name
         FROM water_quality_reports r
         JOIN hostels h ON r.hostel_id = h.hostel_id
         LEFT JOIN authorities auth ON r.posted_by = auth.authority_id
         WHERE r.hostel_id = ?
         ORDER BY r.week_start ASC
         LIMIT 10`,
        [targetHostelId]
      );

      return {
        hostel_id: targetHostelId,
        hostel_name: hostelName,
        limits,
        reports: rows,
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/water-reports
 * Returns paginated water reports, student scoped.
 */
waterReportsRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const hostelParam = req.query.hostel_id ? parseInt(req.query.hostel_id as string, 10) : undefined;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(req.query.pageSize as string, 10) || 10));
    const offset = (page - 1) * pageSize;

    const result = await withRequestConn(user.role, user.userId, async (conn) => {
      let studentHostelId: number | null = null;
      if (user.role === 'STUDENT') {
        const [resRows] = await conn.query<any[]>(
          'SELECT hostel_id FROM v_current_residence WHERE user_id = ? LIMIT 1',
          [user.userId]
        );
        studentHostelId = resRows[0]?.hostel_id || null;
      }

      const whereClauses: string[] = ['1=1'];
      const params: any[] = [];

      if (user.role === 'STUDENT') {
        if (studentHostelId) {
          whereClauses.push('r.hostel_id = ?');
          params.push(studentHostelId);
        } else {
          whereClauses.push('1=0'); // Unallocated student sees no hostel-specific reports
        }
      } else if (hostelParam) {
        whereClauses.push('r.hostel_id = ?');
        params.push(hostelParam);
      }

      const whereSql = whereClauses.join(' AND ');

      const [countRows] = await conn.query<any[]>(
        `SELECT COUNT(*) as total FROM water_quality_reports r WHERE ${whereSql}`,
        params
      );
      const total = Number(countRows[0]?.total || 0);

      const [rows] = await conn.query<any[]>(
        `SELECT r.report_id, r.hostel_id, h.hostel_name,
                DATE_FORMAT(r.week_start, '%Y-%m-%d') AS week_start,
                r.tds_ppm, r.ph, r.chlorine_mgl, r.verdict, r.remarks,
                auth.full_name AS posted_by_name
         FROM water_quality_reports r
         JOIN hostels h ON r.hostel_id = h.hostel_id
         LEFT JOIN authorities auth ON r.posted_by = auth.authority_id
         WHERE ${whereSql}
         ORDER BY r.week_start DESC, r.report_id DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );

      const limits = await getWaterLimits(conn);

      return {
        reports: rows,
        limits,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/water-reports
 * Roles: ADMIN, HOSTEL_OFFICE, CHIEF_WARDEN, WARDEN
 * Caretaker and Student rejected with 403 Forbidden.
 */
waterReportsRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN'),
  verifyCsrf,
  validate(createWaterReportSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { hostel_id, week_start, tds_ppm, ph, chlorine_mgl, remarks } = req.body;

      const result = await withRequestConn(user.role, user.userId, async (conn) => {
        const [authRows] = await conn.query<any[]>(
          'SELECT authority_id FROM authorities WHERE user_id = ?',
          [user.userId]
        );
        const authorityId = authRows[0]?.authority_id || 1;

        const [insertResult] = await conn.query<any>(
          `INSERT INTO water_quality_reports (hostel_id, week_start, tds_ppm, ph, chlorine_mgl, remarks, posted_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [hostel_id, week_start, tds_ppm, ph, chlorine_mgl, remarks || null, authorityId]
        );

        // Fetch inserted row to get computed verdict
        const [insertedRows] = await conn.query<any[]>(
          'SELECT verdict FROM water_quality_reports WHERE report_id = ?',
          [insertResult.insertId]
        );

        return {
          reportId: insertResult.insertId,
          verdict: insertedRows[0]?.verdict || 'SAFE',
        };
      });

      return res.status(201).json({
        message: 'Water quality report logged successfully.',
        reportId: result.reportId,
        verdict: result.verdict,
      });
    } catch (err) {
      next(err);
    }
  }
);
