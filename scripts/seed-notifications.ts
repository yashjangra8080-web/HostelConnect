import { pool, closeAllPools } from '../server/src/db.js';

interface NotificationSeedDef {
  loginId?: string;
  userId?: number;
  type: 'ALLOTMENT' | 'NOTICE' | 'COMPLAINT' | 'REFUND' | 'MAINTENANCE' | 'WATER' | 'LAUNDRY';
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  createdAt: string;
}

export async function seedNotifications(externalConn?: any): Promise<void> {
  const db = externalConn || pool;
  console.log('[Seed Notifications] Seeding realistic notifications for demo users & staff...');

  // 1. Resolve user IDs for students and staff
  const [users]: any = await db.query(
    'SELECT user_id, login_id, role FROM users'
  );
  const userMap = new Map<string, number>();
  const roleMap = new Map<string, number>();
  users.forEach((u: any) => {
    userMap.set(u.login_id, u.user_id);
    if (!roleMap.has(u.role)) {
      roleMap.set(u.role, u.user_id);
    }
  });

  // Also map student roll numbers
  const [students]: any = await db.query(
    'SELECT s.student_id, s.roll_no, s.user_id, s.full_name FROM students s'
  );
  const studentRollMap = new Map<string, number>();
  students.forEach((s: any) => studentRollMap.set(s.roll_no, s.user_id));

  // 2. Clear old notifications table for fresh idempotent seeding
  await db.query('DELETE FROM notifications');

  const notificationsToInsert: NotificationSeedDef[] = [];

  // =========================================================================
  // DEMO STUDENT 1: Krishna Gupta (2026UITX0192) — Resident, High Attendance
  // =========================================================================
  const krishnaUid = studentRollMap.get('2026UITX0192');
  if (krishnaUid) {
    notificationsToInsert.push(
      {
        userId: krishnaUid,
        type: 'NOTICE',
        title: 'Overhead Water Tank Cleaning Notice',
        body: 'Disinfection and cleaning scheduled for BH1 water tanks on 05 Nov 2026.',
        link: '/notices?open=1',
        isRead: false,
        createdAt: '2026-11-02 08:30:00',
      },
      {
        userId: krishnaUid,
        type: 'REFUND',
        title: 'Mess Refund Finalized: September 2026',
        body: 'Your September dining rebate of ₹184.00 has been credited to your mess ledger.',
        link: '/student/refunds?month=9',
        isRead: false,
        createdAt: '2026-11-01 10:15:00',
      },
      {
        userId: krishnaUid,
        type: 'LAUNDRY',
        title: 'Wash Cycle Completed — Machine BH1-01',
        body: 'Your 45-minute laundry cycle has completed. Please retrieve your wash load.',
        link: '/student/laundry',
        isRead: false,
        createdAt: '2026-11-01 16:45:00',
      },
      {
        userId: krishnaUid,
        type: 'WATER',
        title: 'Weekly Water Quality Report (Week 44)',
        body: 'Drinking water tests verified SAFE: TDS 240 ppm, pH 7.3, Chlorine 0.3 mg/L.',
        link: '/water-quality',
        isRead: true,
        createdAt: '2026-10-31 11:00:00',
      },
      {
        userId: krishnaUid,
        type: 'MAINTENANCE',
        title: 'Room Electrician Visit Scheduled',
        body: 'Electrician visit scheduled for BH1 Floor 1 on 06 Nov 2026 between 10:00-12:00.',
        link: '/maintenance',
        isRead: true,
        createdAt: '2026-10-29 14:00:00',
      },
      {
        userId: krishnaUid,
        type: 'ALLOTMENT',
        title: 'Hostel Room Allotted — BH1 Room 101',
        body: 'Official allotment confirmed: Room 101 (Day study habit). Welcome to BH1!',
        link: '/student/allotment',
        isRead: true,
        createdAt: '2026-08-01 10:00:00',
      }
    );
  }

  // =========================================================================
  // DEMO STUDENT 2: Mayank Jain (2026UEEX0214) — Resident, Mixed Attendance
  // =========================================================================
  const mayankUid = studentRollMap.get('2026UEEX0214');
  if (mayankUid) {
    notificationsToInsert.push(
      {
        userId: mayankUid,
        type: 'REFUND',
        title: 'Mess Refund Finalized: September 2026',
        body: 'Your September mess refund of ₹448.00 has been calculated and finalized.',
        link: '/student/refunds?month=9',
        isRead: false,
        createdAt: '2026-11-01 10:15:00',
      },
      {
        userId: mayankUid,
        type: 'COMPLAINT',
        title: 'Grievance Acknowledged: IN_PROGRESS',
        body: 'Your complaint regarding ceiling fan speed regulator has been marked IN_PROGRESS.',
        link: '/student/complaints',
        isRead: false,
        createdAt: '2026-10-30 15:30:00',
      },
      {
        userId: mayankUid,
        type: 'NOTICE',
        title: 'Gate Timings & Night Outpass Notice',
        body: 'Hostel gate closes strictly at 22:00 IST for first-year undergraduate residents.',
        link: '/notices?open=6',
        isRead: true,
        createdAt: '2026-10-25 18:00:00',
      },
      {
        userId: mayankUid,
        type: 'ALLOTMENT',
        title: 'Hostel Room Allotted — BH1 Room 102',
        body: 'Official allotment confirmed: Room 102 (Day study habit). Welcome to BH1!',
        link: '/student/allotment',
        isRead: true,
        createdAt: '2026-08-01 10:00:00',
      }
    );
  }

  // =========================================================================
  // DEMO STUDENT 3: Dev Sethi (2026UCSDS0001) — Non-Resident (Waitlisted)
  // =========================================================================
  const devUid = studentRollMap.get('2026UCSDS0001') || userMap.get('2026UCSDS0001');
  if (devUid) {
    notificationsToInsert.push(
      {
        userId: devUid,
        type: 'NOTICE',
        title: 'Campus Wi-Fi Maintenance Schedule',
        body: 'Scheduled core router upgrade in Sector 3 academic complex on 04 Nov 2026.',
        link: '/notices?open=8',
        isRead: false,
        createdAt: '2026-11-01 12:00:00',
      },
      {
        userId: devUid,
        type: 'ALLOTMENT',
        title: 'Hostel Allotment Status: Waitlisted',
        body: 'Your Delhi priority application is currently waitlisted due to 100% capacity in BH1/BH2.',
        link: '/student/allotment',
        isRead: true,
        createdAt: '2026-08-01 10:05:00',
      }
    );
  }

  // =========================================================================
  // STAFF USERS: ADMIN, HOSTEL_OFFICE, CHIEF_WARDEN, WARDEN, CARETAKER, MESS_MGR
  // =========================================================================
  const adminUid = userMap.get('admin');
  if (adminUid) {
    notificationsToInsert.push(
      {
        userId: adminUid,
        type: 'ALLOTMENT',
        title: 'Allotment Cycle 2026-27 Results Published',
        body: 'Allotment published successfully with 300 beds occupied across 4 hostels.',
        link: '/transparency',
        isRead: false,
        createdAt: '2026-08-01 10:10:00',
      },
      {
        userId: adminUid,
        type: 'WATER',
        title: 'Borderline TDS Alert: GH1 Surveillance Log',
        body: 'Weekly TDS reading for Girls Hostel 1 reached 475 ppm (approaching 500 ppm limit).',
        link: '/water-quality',
        isRead: false,
        createdAt: '2026-10-30 16:00:00',
      },
      {
        userId: adminUid,
        type: 'COMPLAINT',
        title: 'Urgent Grievance Escalation: Mess Hygiene',
        body: 'An anonymous high-priority mess complaint has been logged and assigned to Mess Manager.',
        link: '/complaints',
        isRead: true,
        createdAt: '2026-10-28 14:20:00',
      }
    );
  }

  const officeUid = userMap.get('office') || userMap.get('hostel_office') || roleMap.get('HOSTEL_OFFICE');
  if (officeUid) {
    notificationsToInsert.push(
      {
        userId: officeUid,
        type: 'ALLOTMENT',
        title: 'Merit Ranking Verification Complete',
        body: 'All 2,000 applicants distance and schooling criteria verified.',
        link: '/office/ranking',
        isRead: false,
        createdAt: '2026-08-01 09:30:00',
      },
      {
        userId: officeUid,
        type: 'NOTICE',
        title: 'Hostel Fee Circular Published',
        body: 'Fee circular for 2nd semester hostel dues has been issued to student body.',
        link: '/notices?open=7',
        isRead: true,
        createdAt: '2026-10-20 11:00:00',
      }
    );
  }

  const chiefWardenUid = userMap.get('chiefwarden') || userMap.get('chief_warden') || roleMap.get('CHIEF_WARDEN');
  if (chiefWardenUid) {
    notificationsToInsert.push(
      {
        userId: chiefWardenUid,
        type: 'COMPLAINT',
        title: 'New Confidential Complaint Addressed to Chief Warden',
        body: 'A student has submitted a confidential grievance regarding hostel security.',
        link: '/chief-warden/complaints',
        isRead: false,
        createdAt: '2026-11-01 14:10:00',
      },
      {
        userId: chiefWardenUid,
        type: 'WATER',
        title: 'Weekly Water Quality Report: 4 Hostels Safe',
        body: 'All residential blocks tested within statutory limits for TDS and Chlorine.',
        link: '/chief-warden/water-quality',
        isRead: false,
        createdAt: '2026-10-31 10:30:00',
      },
      {
        userId: chiefWardenUid,
        type: 'ALLOTMENT',
        title: 'Allotment Summary Snapshot Recorded',
        body: 'Final seat matrix recorded: 200 non-Delhi, 100 Delhi candidates accommodated.',
        link: '/transparency',
        isRead: true,
        createdAt: '2026-08-01 10:15:00',
      }
    );
  }

  const wardenBh1Uid = userMap.get('warden_bh1');
  if (wardenBh1Uid) {
    notificationsToInsert.push(
      {
        userId: wardenBh1Uid,
        type: 'COMPLAINT',
        title: 'New Plumbing Complaint in BH1 Block A',
        body: 'Resident reported persistent water pipe leak in second floor washroom.',
        link: '/warden/complaints',
        isRead: false,
        createdAt: '2026-11-02 07:45:00',
      },
      {
        userId: wardenBh1Uid,
        type: 'MAINTENANCE',
        title: 'Fumigation & Mosquito Fogging Scheduled',
        body: 'Campus health squad scheduled for outdoor fogging in BH1 courtyard.',
        link: '/warden/maintenance',
        isRead: false,
        createdAt: '2026-11-01 11:20:00',
      },
      {
        userId: wardenBh1Uid,
        type: 'NOTICE',
        title: 'Circular Issued: Discipline & Quiet Hours',
        body: 'Night quiet hours notice posted for all BH1 wings starting 22:30 IST.',
        link: '/notices?open=5',
        isRead: true,
        createdAt: '2026-10-26 15:00:00',
      }
    );
  }

  const caretakerBh1Uid = userMap.get('caretaker_bh1');
  if (caretakerBh1Uid) {
    notificationsToInsert.push(
      {
        userId: caretakerBh1Uid,
        type: 'LAUNDRY',
        title: 'Machine Reported Out of Order — BH1-04',
        body: 'Washing machine BH1-04 reported for belt slippage; status set to OUT_OF_ORDER.',
        link: '/caretaker/laundry',
        isRead: false,
        createdAt: '2026-11-02 08:15:00',
      },
      {
        userId: caretakerBh1Uid,
        type: 'MAINTENANCE',
        title: 'Pest Control Schedule Confirmation',
        body: 'Vendor confirmed pest control visit for BH1 dining and corridors.',
        link: '/caretaker/maintenance',
        isRead: false,
        createdAt: '2026-11-01 13:00:00',
      },
      {
        userId: caretakerBh1Uid,
        type: 'COMPLAINT',
        title: 'Assigned Work Order: Room 102 Electrical Fix',
        body: 'Work order generated to replace ceiling fan regulator in BH1 Room 102.',
        link: '/complaints',
        isRead: true,
        createdAt: '2026-10-31 09:30:00',
      }
    );
  }

  const messMgrUid = userMap.get('mess_mgr');
  if (messMgrUid) {
    notificationsToInsert.push(
      {
        userId: messMgrUid,
        type: 'REFUND',
        title: 'September 2026 Mess Refunds Finalized',
        body: 'Automatic calculation executed via sp_calculate_refunds for 300 residents.',
        link: '/mess/refunds',
        isRead: false,
        createdAt: '2026-11-01 10:00:00',
      },
      {
        userId: messMgrUid,
        type: 'NOTICE',
        title: 'Mess Menu Revision for Winter Season',
        body: 'Updated 14-day North Indian dietary menu submitted for student council review.',
        link: '/notices?open=4',
        isRead: true,
        createdAt: '2026-10-27 16:30:00',
      }
    );
  }

  // Insert all notifications
  const rows = notificationsToInsert.map((n) => [
    n.userId,
    n.type,
    n.title,
    n.body,
    n.link,
    n.isRead ? 1 : 0,
    n.createdAt,
  ]);

  await db.query(
    'INSERT INTO notifications (user_id, notif_type, title, body, link, is_read, created_at) VALUES ?',
    [rows]
  );

  console.log(`[Seed Notifications] Successfully inserted ${rows.length} realistic notifications.`);
}

import path from 'path';

// Allow standalone execution
const isMain = process.argv[1] && import.meta.url.includes(path.basename(process.argv[1]));
if (isMain) {
  seedNotifications()
    .then(async () => {
      await closeAllPools();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed Notifications Error]:', err);
      await closeAllPools();
      process.exit(1);
    });
}
