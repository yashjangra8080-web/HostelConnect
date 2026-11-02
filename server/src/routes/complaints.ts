import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { withRequestConn, pool } from '../db.js';
import { requireAuth, requireRole, verifyCsrf } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const complaintsRouter = Router();
export const adminRouter = Router();

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const fileComplaintSchema = z.object({
  authority_id:   z.number().int().positive(),
  category:       z.enum(['ELECTRICAL','PLUMBING','MESS','CLEANLINESS','CONDUCT','OTHER']),
  severity:       z.enum(['LOW','MEDIUM','HIGH','URGENT']),
  subject:        z.string().min(3).max(160),
  description:    z.string().min(10).max(4000),
  is_anonymous:   z.boolean().optional().default(false),
  attachment_url: z.string().url().optional().nullable(),
});

const respondComplaintSchema = z.object({
  message:    z.string().min(1).max(4000),
  new_status: z
    .enum(['OPEN','SEEN','IN_PROGRESS','RESOLVED','REJECTED'])
    .optional()
    .nullable(),
});

const inboxQuerySchema = z.object({
  status:   z.enum(['OPEN','SEEN','IN_PROGRESS','RESOLVED','REJECTED']).optional(),
  severity: z.enum(['LOW','MEDIUM','HIGH','URGENT']).optional(),
  category: z.enum(['ELECTRICAL','PLUMBING','MESS','CLEANLINESS','CONDUCT','OTHER']).optional(),
});

// ─── Authority role set ───────────────────────────────────────────────────────
const AUTHORITY_ROLES = [
  'ADMIN','HOSTEL_OFFICE','CHIEF_WARDEN','WARDEN','MESS_MANAGER','CARETAKER',
] as const;

// ─── POST /api/complaints — file a new complaint (STUDENT only) ───────────────
complaintsRouter.post(
  '/',
  requireAuth,
  requireRole('STUDENT'),
  verifyCsrf,
  validate(fileComplaintSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { authority_id, category, severity, subject, description, is_anonymous, attachment_url } =
        req.body;

      const trackingCode = await withRequestConn(user.role, user.userId, async (conn) => {
        // Call procedure — note: no student_id param; procedure derives from @app_user_id
        await conn.query('SET @p_tracking_code = NULL');
        await conn.query(
          `CALL sp_file_complaint(?, ?, ?, ?, ?, ?, ?, @p_tracking_code)`,
          [
            authority_id,
            category,
            severity,
            subject,
            description,
            is_anonymous ? 1 : 0,
            attachment_url ?? null,
          ]
        );
        const [[row]] = await conn.query<any[]>('SELECT @p_tracking_code AS tracking_code');
        return row?.tracking_code as string;
      });

      return res.status(201).json({
        message:       'Complaint filed successfully.',
        tracking_code: trackingCode,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/complaints/mine — student views own complaints ──────────────────
complaintsRouter.get(
  '/mine',
  requireAuth,
  requireRole('STUDENT'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;

      const result = await withRequestConn(user.role, user.userId, async (conn) => {
        // sp_get_my_complaints returns 2 result sets
        const [resultSets] = await conn.query<any>('CALL sp_get_my_complaints()');
        const complaints  = Array.isArray(resultSets[0]) ? resultSets[0] : [];
        const responses   = Array.isArray(resultSets[1]) ? resultSets[1] : [];

        // Attach responses to their complaint
        const responseMap = new Map<number, any[]>();
        for (const r of responses) {
          if (!responseMap.has(r.complaint_id)) responseMap.set(r.complaint_id, []);
          responseMap.get(r.complaint_id)!.push(r);
        }

        return complaints.map((c: any) => ({
          ...c,
          responses: responseMap.get(c.complaint_id) ?? [],
        }));
      });

      return res.status(200).json({ complaints: result });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/complaints/inbox — authority inbox ──────────────────────────────
complaintsRouter.get(
  '/inbox',
  requireAuth,
  requireRole(...AUTHORITY_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const parsed = inboxQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation', issues: parsed.error.issues });
      }
      const { status, severity, category } = parsed.data;

      const result = await withRequestConn(user.role, user.userId, async (conn) => {
        const [resultSets] = await conn.query<any>(
          'CALL sp_get_complaints_for_authority(?, ?, ?)',
          [status ?? null, severity ?? null, category ?? null]
        );
        const complaints = Array.isArray(resultSets[0]) ? resultSets[0] : [];
        const responses  = Array.isArray(resultSets[1]) ? resultSets[1] : [];

        const responseMap = new Map<number, any[]>();
        for (const r of responses) {
          if (!responseMap.has(r.complaint_id)) responseMap.set(r.complaint_id, []);
          responseMap.get(r.complaint_id)!.push(r);
        }

        return complaints.map((c: any) => ({
          ...c,
          responses: responseMap.get(c.complaint_id) ?? [],
        }));
      });

      return res.status(200).json({ complaints: result });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/complaints/:id/respond ─────────────────────────────────────────
complaintsRouter.post(
  '/:id/respond',
  requireAuth,
  requireRole('STUDENT', ...AUTHORITY_ROLES),
  verifyCsrf,
  validate(respondComplaintSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user        = req.user!;
      const complaintId = parseInt(req.params.id, 10);
      if (!Number.isFinite(complaintId) || complaintId <= 0) {
        return res.status(400).json({ error: 'Invalid complaint id.' });
      }
      const { message, new_status } = req.body;

      await withRequestConn(user.role, user.userId, async (conn) => {
        await conn.query('CALL sp_respond_complaint(?, ?, ?)', [
          complaintId,
          message,
          new_status ?? null,
        ]);
      });

      return res.status(200).json({ message: 'Response submitted successfully.' });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/admin/privilege-proof — SHOW GRANTS per role ───────────────────
const privilegeProofHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleUsers: Record<string, string> = {
      ADMIN:         'hc_admin',
      HOSTEL_OFFICE: 'hc_hostel_office',
      CHIEF_WARDEN:  'hc_chief_warden',
      WARDEN:        'hc_warden',
      MESS_MANAGER:  'hc_mess_manager',
      CARETAKER:     'hc_caretaker',
      STUDENT:       'hc_student',
    };

    const grants: Record<string, string[]> = {};

    // Use the root pool (admin connection) to run SHOW GRANTS
    for (const [role, dbUser] of Object.entries(roleUsers)) {
      const [rows] = await pool.query<any[]>(`SHOW GRANTS FOR '${dbUser}'@'%'`);
      grants[role] = rows.map((r: any) => Object.values(r)[0] as string);
    }

    return res.status(200).json({ grants });
  } catch (err) {
    next(err);
  }
};

adminRouter.get('/privilege-proof', requireAuth, requireRole('ADMIN'), privilegeProofHandler);
complaintsRouter.get('/admin/privilege-proof', requireAuth, requireRole('ADMIN'), privilegeProofHandler);
