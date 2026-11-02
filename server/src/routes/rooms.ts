import { Router, Request, Response, NextFunction } from 'express';
import { withRequestConn, Role } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const roomsRouter = Router();

/**
 * GET /api/rooms/board
 * Returns room occupancy board grouped by hostel and floor.
 * Restricted to administrative authorities.
 */
roomsRouter.get(
  '/board',
  requireAuth,
  requireRole(['HOSTEL_OFFICE', 'ADMIN', 'CHIEF_WARDEN', 'WARDEN']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userRole = (req.user?.role || 'HOSTEL_OFFICE') as Role;
      const userId = req.user?.userId;
      const hostelIdFilter = req.query.hostel_id ? Number(req.query.hostel_id) : null;

      await withRequestConn(userRole, userId, async (conn) => {
        // Query hostels
        const [hostelRows] = await conn.query<any[]>(
          'SELECT hostel_id, hostel_name, gender_type FROM hostels ORDER BY hostel_id ASC'
        );

        // Query rooms with joined occupants
        let roomQuery = `
          SELECT 
            r.room_id,
            r.hostel_id,
            r.room_no,
            r.floor_no,
            r.capacity,
            r.occupied_count,
            r.study_habit_tag,
            (r.capacity - r.occupied_count) AS available_beds
          FROM rooms r
        `;
        const roomParams: any[] = [];
        if (hostelIdFilter) {
          roomQuery += ' WHERE r.hostel_id = ?';
          roomParams.push(hostelIdFilter);
        }
        roomQuery += ' ORDER BY r.hostel_id ASC, r.floor_no ASC, r.room_no ASC';

        const [roomRows] = await conn.query<any[]>(roomQuery, roomParams);

        // Query active allotments with student details
        const [occupantRows] = await conn.query<any[]>(`
          SELECT 
            alt.allotment_id,
            alt.room_id,
            alt.response_status,
            alt.allotted_on,
            s.student_id,
            s.roll_no,
            s.full_name,
            s.merit_rank,
            s.study_habit,
            s.branch
          FROM allotments alt
          JOIN students s ON alt.student_id = s.student_id
          ORDER BY alt.allotted_on ASC
        `);

        // Group occupants by room_id
        const occupantsByRoom = new Map<number, any[]>();
        for (const occ of occupantRows) {
          if (!occupantsByRoom.has(occ.room_id)) {
            occupantsByRoom.set(occ.room_id, []);
          }
          occupantsByRoom.get(occ.room_id)!.push({
            allotment_id: occ.allotment_id,
            student_id: occ.student_id,
            roll_no: occ.roll_no,
            full_name: occ.full_name,
            merit_rank: occ.merit_rank,
            study_habit: occ.study_habit,
            branch: occ.branch,
            response_status: occ.response_status,
            allotted_on: occ.allotted_on,
          });
        }

        // Group rooms by hostel and floor
        const hostelsMap = new Map<number, any>();
        for (const h of hostelRows) {
          if (hostelIdFilter && h.hostel_id !== hostelIdFilter) continue;
          hostelsMap.set(h.hostel_id, {
            hostel_id: h.hostel_id,
            hostel_name: h.hostel_name,
            gender_type: h.gender_type,
            total_beds: 0,
            occupied_beds: 0,
            available_beds: 0,
            floors: new Map<number, any[]>(),
          });
        }

        for (const r of roomRows) {
          const h = hostelsMap.get(r.hostel_id);
          if (!h) continue;

          h.total_beds += r.capacity;
          h.occupied_beds += r.occupied_count;
          h.available_beds += r.available_beds;

          const floorNo = r.floor_no ?? 0;
          if (!h.floors.has(floorNo)) {
            h.floors.set(floorNo, []);
          }

          h.floors.get(floorNo)!.push({
            room_id: r.room_id,
            room_no: r.room_no,
            floor_no: r.floor_no,
            capacity: r.capacity,
            occupied_count: r.occupied_count,
            available_beds: r.available_beds,
            study_habit_tag: r.study_habit_tag,
            occupants: occupantsByRoom.get(r.room_id) || [],
          });
        }

        // Format for JSON response
        const result = Array.from(hostelsMap.values()).map((h) => ({
          hostel_id: h.hostel_id,
          hostel_name: h.hostel_name,
          gender_type: h.gender_type,
          total_beds: h.total_beds,
          occupied_beds: h.occupied_beds,
          available_beds: h.available_beds,
          floors: Array.from(h.floors.entries() as Iterable<[number, any[]]>)
            .sort((a, b) => a[0] - b[0])
            .map(([floor_no, rooms]) => ({
              floor_no,
              rooms,
            })),
        }));

        res.json({ hostels: result });
      });
    } catch (err) {
      next(err);
    }
  }
);
