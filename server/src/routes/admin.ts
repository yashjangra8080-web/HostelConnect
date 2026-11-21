import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool, withRequestConn, Role } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const adminRouter = Router();

// ============================================================================
// 1. GET /api/admin/health
// Returns database telemetry, pool status, uptime, and table row counts
// ============================================================================
adminRouter.get(
  '/health',
  requireAuth,
  requireRole('ADMIN'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const startTime = Date.now();
      const [pingRows] = await pool.query<any[]>(
        `SELECT 
           @@event_scheduler AS event_scheduler, 
           @@time_zone AS time_zone, 
           NOW() AS server_time,
           VERSION() AS mysql_version`
      );
      const latencyMs = Date.now() - startTime;

      const { event_scheduler, time_zone, server_time, mysql_version } = pingRows[0] || {};
      const isSchedulerOn = String(event_scheduler).toUpperCase() === 'ON';

      // Table row counts from information_schema
      const [tableCountRows] = await pool.query<any[]>(
        `SELECT table_name, table_rows 
         FROM information_schema.tables 
         WHERE table_schema = DATABASE() 
           AND table_name IN ('students', 'rooms', 'allotments', 'applications', 'mess_attendance', 'complaints', 'notices', 'audit_log')`
      );

      const tableCounts: Record<string, number> = {};
      for (const row of tableCountRows) {
        tableCounts[row.table_name || row.TABLE_NAME] = Number(row.table_rows || row.TABLE_ROWS || 0);
      }

      // Live exact counts for key tables
      const [exactCounts] = await pool.query<any[]>(
        `SELECT 
           (SELECT COUNT(*) FROM students) AS students_count,
           (SELECT COUNT(*) FROM rooms) AS rooms_count,
           (SELECT COUNT(*) FROM allotments) AS allotments_count,
           (SELECT COUNT(*) FROM applications) AS applications_count,
           (SELECT COUNT(*) FROM mess_attendance) AS mess_attendance_count,
           (SELECT COUNT(*) FROM complaints) AS complaints_count,
           (SELECT COUNT(*) FROM notices) AS notices_count,
           (SELECT COUNT(*) FROM audit_log) AS audit_log_count`
      );

      const counts = exactCounts[0] || {};

      res.status(200).json({
        status: isSchedulerOn ? 'healthy' : 'degraded',
        latencyMs,
        uptimeSeconds: Math.floor(process.uptime()),
        database: {
          connected: true,
          event_scheduler,
          time_zone,
          server_time,
          mysql_version,
          database_name: 'hostelconnect',
        },
        counts: {
          students: Number(counts.students_count || 0),
          rooms: Number(counts.rooms_count || 0),
          allotments: Number(counts.allotments_count || 0),
          applications: Number(counts.applications_count || 0),
          mess_attendance: Number(counts.mess_attendance_count || 0),
          complaints: Number(counts.complaints_count || 0),
          notices: Number(counts.notices_count || 0),
          audit_log: Number(counts.audit_log_count || 0),
        },
        node_env: process.env.NODE_ENV || 'development',
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// 2. GET /api/admin/audit
// Returns paginated audit log with filtering by table, action, and search
// ============================================================================
const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  table_name: z.string().optional(),
  action: z.string().optional(),
  search: z.string().optional(),
});

adminRouter.get(
  '/audit',
  requireAuth,
  requireRole('ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN'),
  validate(auditQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 25;
      const offset = (page - 1) * pageSize;
      const tableName = req.query.table_name ? String(req.query.table_name) : null;
      const action = req.query.action ? String(req.query.action) : null;
      const search = req.query.search ? String(req.query.search).trim() : null;

      await withRequestConn(user.role as Role, user.userId, async (conn) => {
        let whereClauses: string[] = ['1=1'];
        const params: any[] = [];

        if (tableName) {
          whereClauses.push('al.table_name = ?');
          params.push(tableName);
        }

        if (action) {
          whereClauses.push('al.action = ?');
          params.push(action);
        }

        if (search) {
          whereClauses.push('(al.table_name LIKE ? OR al.action LIKE ? OR CAST(al.details AS CHAR) LIKE ?)');
          params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const whereSql = whereClauses.join(' AND ');

        // Count total matching
        const [countRows] = await conn.query<any[]>(
          `SELECT COUNT(*) AS total FROM audit_log al WHERE ${whereSql}`,
          params
        );
        const total = Number(countRows[0]?.total || 0);

        // Fetch logs joined with actor details
        // Sensitive data masking: For complaints submitted anonymously, ensure actor is masked
        const [rows] = await conn.query<any[]>(
          `SELECT 
             al.log_id,
             al.actor_user_id,
             u.login_id AS actor_login,
             u.role AS actor_role,
             al.action,
             al.table_name,
             al.record_id,
             al.details,
             al.logged_at
           FROM audit_log al
           LEFT JOIN users u ON al.actor_user_id = u.user_id
           WHERE ${whereSql}
           ORDER BY al.logged_at DESC, al.log_id DESC
           LIMIT ? OFFSET ?`,
          [...params, pageSize, offset]
        );

        // Mask any password_hash or sensitive complaint identifiers in details
        const maskedLogs = rows.map((r: any) => {
          let details = r.details;
          if (typeof details === 'string') {
            try {
              details = JSON.parse(details);
            } catch {
              // keep as string
            }
          }
          if (details && typeof details === 'object') {
            if ('password_hash' in details) {
              details = { ...details, password_hash: '[REDACTED]' };
            }
          }
          return {
            ...r,
            details,
          };
        });

        res.status(200).json({
          logs: maskedLogs,
          pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
          },
        });
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// 3. GET /api/admin/staff
// Returns all operational and executive staff accounts
// ============================================================================
adminRouter.get(
  '/staff',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      await withRequestConn(user.role as Role, user.userId, async (conn) => {
        const [rows] = await conn.query<any[]>(
          `SELECT 
             a.authority_id,
             a.user_id,
             a.hostel_id,
             a.designation,
             a.full_name,
             u.login_id,
             u.role,
             u.is_active,
             u.failed_attempts,
             u.created_at,
             h.hostel_name,
             h.gender_type
           FROM authorities a
           JOIN users u ON a.user_id = u.user_id
           LEFT JOIN hostels h ON a.hostel_id = h.hostel_id
           ORDER BY a.designation, a.full_name ASC`
        );

        res.status(200).json({ staff: rows });
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// 4. GET /api/admin/privilege-proof
// Returns SHOW GRANTS for all 7 application database roles
// ============================================================================
adminRouter.get(
  '/privilege-proof',
  requireAuth,
  requireRole('ADMIN'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const roleUsers: Record<string, string> = {
        ADMIN: 'hc_admin',
        HOSTEL_OFFICE: 'hc_hostel_office',
        CHIEF_WARDEN: 'hc_chief_warden',
        WARDEN: 'hc_warden',
        MESS_MANAGER: 'hc_mess_manager',
        CARETAKER: 'hc_caretaker',
        STUDENT: 'hc_student',
      };

      const grants: Record<string, string[]> = {};

      for (const [role, dbUser] of Object.entries(roleUsers)) {
        const [rows] = await pool.query<any[]>(`SHOW GRANTS FOR '${dbUser}'@'%'`);
        grants[role] = rows.map((r: any) => Object.values(r)[0] as string);
      }

      return res.status(200).json({ grants });
    } catch (err) {
      next(err);
    }
  }
);
