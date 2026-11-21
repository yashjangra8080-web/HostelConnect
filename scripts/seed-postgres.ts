import pg from 'pg';
import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

const isSsl = Boolean(
  databaseUrl.includes('supabase') ||
  databaseUrl.includes('pooler.supabase.com') ||
  databaseUrl.includes('sslmode=require') ||
  process.env.NODE_ENV === 'production'
);

async function seedPostgres() {
  console.log('[Seed Runner] Connecting to PostgreSQL database...');
  console.log(`[Seed Runner] URL target: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: isSsl ? { rejectUnauthorized: false } : false,
    max: 5,
  });

  const client = await pool.connect();

  try {
    console.log('[Seed Runner] Beginning idempotent database seed...');
    await client.query('BEGIN');

    // 1. Reference States
    console.log('[Seed Runner] 1. Seeding states...');
    const states = [
      [1, 'Delhi', 'DL'],
      [2, 'Uttar Pradesh', 'UP'],
      [3, 'Haryana', 'HR'],
      [4, 'Rajasthan', 'RJ'],
      [5, 'Punjab', 'PB'],
      [6, 'Bihar', 'BR'],
      [7, 'Madhya Pradesh', 'MP'],
      [8, 'West Bengal', 'WB'],
    ];

    for (const [id, name, code] of states) {
      await client.query(
        `INSERT INTO states (state_id, state_name, state_code)
         VALUES ($1, $2, $3)
         ON CONFLICT (state_name) DO UPDATE SET state_code = EXCLUDED.state_code`,
        [id, name, code]
      );
    }

    // 2. Reference Cities
    console.log('[Seed Runner] 2. Seeding cities...');
    const cities = [
      [1, 1, 'New Delhi', 28.6139, 77.209],
      [2, 2, 'Noida', 28.5355, 77.391],
      [3, 3, 'Gurugram', 28.4595, 77.0266],
      [4, 2, 'Ghaziabad', 28.6692, 77.4538],
      [5, 3, 'Faridabad', 28.4089, 77.3178],
      [6, 4, 'Jaipur', 26.9124, 75.7873],
      [7, 2, 'Lucknow', 26.8467, 80.9462],
      [8, 5, 'Chandigarh', 30.7333, 76.7794],
      [9, 6, 'Patna', 25.5941, 85.1376],
      [10, 7, 'Bhopal', 23.2599, 77.4126],
    ];

    for (const [id, stateId, name, lat, lon] of cities) {
      await client.query(
        `INSERT INTO cities (city_id, state_id, city_name, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (city_id) DO UPDATE SET city_name = EXCLUDED.city_name, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude`,
        [id, stateId, name, lat, lon]
      );
    }

    // 3. Hostels
    console.log('[Seed Runner] 3. Seeding hostels...');
    const hostels = [
      [1, 'Boys Hostel 1 (Ramanujan Bhawan)', 'BOYS'],
      [2, 'Boys Hostel 2 (Aryabhatta Bhawan)', 'BOYS'],
      [3, 'Girls Hostel 1 (Kalpana Chawla Bhawan)', 'GIRLS'],
      [4, 'Girls Hostel 2 (Karpagam Bhawan)', 'GIRLS'],
    ];

    for (const [id, name, gender] of hostels) {
      await client.query(
        `INSERT INTO hostels (hostel_id, hostel_name, gender_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (hostel_name) DO UPDATE SET gender_type = EXCLUDED.gender_type`,
        [id, name, gender]
      );
    }

    // 4. Meal Types
    console.log('[Seed Runner] 4. Seeding meal types...');
    const mealTypes = [
      [1, 'BREAKFAST', '07:30:00', '09:30:00'],
      [2, 'LUNCH', '12:30:00', '14:30:00'],
      [3, 'SNACKS', '17:00:00', '18:30:00'],
      [4, 'DINNER', '19:45:00', '21:45:00'],
    ];

    for (const [id, name, start, end] of mealTypes) {
      await client.query(
        `INSERT INTO meal_types (meal_type_id, type_name, start_time, end_time)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (type_name) DO UPDATE SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time`,
        [id, name, start, end]
      );
    }

    // 5. Rooms for each hostel
    console.log('[Seed Runner] 5. Seeding rooms...');
    for (let h = 1; h <= 4; h++) {
      for (let floor = 1; floor <= 3; floor++) {
        for (let r = 1; r <= 8; r++) {
          const roomNo = `${floor}0${r}`;
          const capacity = r % 2 === 0 ? 3 : 2;
          const studyHabit = r % 2 === 0 ? 'NIGHT' : 'DAY';
          await client.query(
            `INSERT INTO rooms (hostel_id, room_no, floor_no, capacity, occupied_count, study_habit_tag)
             VALUES ($1, $2, $3, $4, 0, $5)
             ON CONFLICT (hostel_id, room_no) DO UPDATE SET capacity = EXCLUDED.capacity, study_habit_tag = EXCLUDED.study_habit_tag`,
            [h, roomNo, floor, capacity, studyHabit]
          );
        }
      }
    }

    // 6. Users: Staff and Authorities
    console.log('[Seed Runner] 6. Seeding staff user accounts...');
    const passwordHash = await bcrypt.hash('Password@123', 10);

    const staffAccounts = [
      { userId: 1, loginId: 'admin', role: 'ADMIN', name: 'Dr. System Administrator', desig: null, hostelId: null },
      { userId: 2, loginId: 'office', role: 'HOSTEL_OFFICE', name: 'Sh. Rajesh Kumar (Office)', desig: 'HOSTEL_OFFICE', hostelId: null },
      { userId: 3, loginId: 'chiefwarden', role: 'CHIEF_WARDEN', name: 'Prof. S. K. Verma', desig: 'CHIEF_WARDEN', hostelId: null },
      { userId: 4, loginId: 'warden_bh1', role: 'WARDEN', name: 'Dr. Alok Nath (Warden BH1)', desig: 'HOSTEL_WARDEN', hostelId: 1 },
      { userId: 5, loginId: 'warden_bh2', role: 'WARDEN', name: 'Dr. M. P. Sharma (Warden BH2)', desig: 'HOSTEL_WARDEN', hostelId: 2 },
      { userId: 6, loginId: 'warden_gh1', role: 'WARDEN', name: 'Dr. Sunita Rao (Warden GH1)', desig: 'HOSTEL_WARDEN', hostelId: 3 },
      { userId: 7, loginId: 'warden_gh2', role: 'WARDEN', name: 'Dr. Meenakshi Devi (Warden GH2)', desig: 'HOSTEL_WARDEN', hostelId: 4 },
      { userId: 8, loginId: 'mess_mgr', role: 'MESS_MANAGER', name: 'Sh. Vikram Singh (Mess Head)', desig: 'MESS_MANAGER', hostelId: 1 },
      { userId: 9, loginId: 'caretaker_bh1', role: 'CARETAKER', name: 'Sh. Ramesh Yadav (Caretaker BH1)', desig: 'CARETAKER', hostelId: 1 },
      { userId: 10, loginId: 'caretaker_gh1', role: 'CARETAKER', name: 'Smt. Geeta Devi (Caretaker GH1)', desig: 'CARETAKER', hostelId: 3 },
    ];

    for (const staff of staffAccounts) {
      const userRes = await client.query(
        `INSERT INTO users (login_id, password_hash, role, is_active, must_change_password, failed_attempts, locked_until)
         VALUES ($1, $2, $3, 1, 0, 0, NULL)
         ON CONFLICT (login_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, is_active = 1, failed_attempts = 0, locked_until = NULL
         RETURNING user_id`,
        [staff.loginId, passwordHash, staff.role]
      );
      const actualUserId = userRes.rows[0].user_id;

      if (staff.desig) {
        await client.query(
          `INSERT INTO authorities (user_id, hostel_id, designation, full_name)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) DO UPDATE SET hostel_id = EXCLUDED.hostel_id, designation = EXCLUDED.designation, full_name = EXCLUDED.full_name`,
          [actualUserId, staff.hostelId, staff.desig, staff.name]
        );
      }
    }

    // 7. Student Accounts (including 2026UCSDS0001)
    console.log('[Seed Runner] 7. Seeding student accounts...');
    const studentsData = [
      { rollNo: '2026UCSDS0001', name: 'Yash Vardhan', gender: 'M', branch: 'CSDS', rank: 142, state: 1, city: 1, habit: 'DAY', phone: '9876543210', email: 'yash.2026ucsds0001@nsut.ac.in' },
      { rollNo: '2026UCSDS0002', name: 'Aarav Sharma', gender: 'M', branch: 'CSDS', rank: 310, state: 2, city: 2, habit: 'NIGHT', phone: '9876543211', email: 'aarav.2026ucsds0002@nsut.ac.in' },
      { rollNo: '2026UCS0001', name: 'Ananya Gupta', gender: 'F', branch: 'CSE', rank: 98, state: 4, city: 6, habit: 'DAY', phone: '9876543212', email: 'ananya.2026ucs0001@nsut.ac.in' },
      { rollNo: '2026UCS0002', name: 'Rohan Mehra', gender: 'M', branch: 'CSE', rank: 450, state: 3, city: 3, habit: 'NIGHT', phone: '9876543213', email: 'rohan.2026ucs0002@nsut.ac.in' },
      { rollNo: '2026UIT0001', name: 'Pooja Verma', gender: 'F', branch: 'IT', rank: 520, state: 1, city: 1, habit: 'DAY', phone: '9876543214', email: 'pooja.2026uit0001@nsut.ac.in' },
      { rollNo: '2026UEC0001', name: 'Kabir Malhotra', gender: 'M', branch: 'ECE', rank: 680, state: 2, city: 7, habit: 'NIGHT', phone: '9876543215', email: 'kabir.2026uec0001@nsut.ac.in' },
    ];

    for (const stud of studentsData) {
      const userRes = await client.query(
        `INSERT INTO users (login_id, password_hash, role, is_active, must_change_password, failed_attempts, locked_until)
         VALUES ($1, $2, 'STUDENT', 1, 0, 0, NULL)
         ON CONFLICT (login_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = 1, failed_attempts = 0, locked_until = NULL
         RETURNING user_id`,
        [stud.rollNo, passwordHash]
      );
      const actualUserId = userRes.rows[0].user_id;

      await client.query(
        `INSERT INTO students (user_id, roll_no, full_name, gender, branch, batch_year, merit_rank, schooling_state_id, home_city_id, study_habit, phone, email)
         VALUES ($1, $2, $3, $4, $5, 2026, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, branch = EXCLUDED.branch, merit_rank = EXCLUDED.merit_rank`,
        [actualUserId, stud.rollNo, stud.name, stud.gender, stud.branch, stud.rank, stud.state, stud.city, stud.habit, stud.phone, stud.email]
      );
    }

    // 8. Allotment Cycle 2026-27
    console.log('[Seed Runner] 8. Seeding allotment cycle & sample residence...');
    await client.query(
      `INSERT INTO allotment_cycles (cycle_id, academic_year, status, opened_on, closed_on)
       VALUES (1, '2026-27', 'OPEN', '2026-08-01', '2026-08-25')
       ON CONFLICT (cycle_id) DO UPDATE SET status = EXCLUDED.status`
    );

    // 9. Washing Machines for BH1 and GH1
    console.log('[Seed Runner] 9. Seeding washing machines...');
    const machines = [
      [1, 'WM-101', 1, 'FREE'],
      [1, 'WM-102', 1, 'FREE'],
      [1, 'WM-201', 2, 'FREE'],
      [3, 'WM-G101', 1, 'FREE'],
      [3, 'WM-G201', 2, 'FREE'],
    ];

    for (const [hostelId, label, floor, status] of machines) {
      await client.query(
        `INSERT INTO washing_machines (hostel_id, label, floor_no, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (hostel_id, label) DO UPDATE SET status = EXCLUDED.status`,
        [hostelId, label, floor, status]
      );
    }

    // 10. Baseline App Settings
    console.log('[Seed Runner] 10. Seeding app settings...');
    const settings = [
      ['complaint_escalation_days', '3', 'Days before an OPEN complaint escalates to Chief Warden'],
      ['laundry_cycle_minutes', '45', 'Standard washing machine cycle duration in minutes'],
      ['laundry_grace_minutes', '5', 'Grace period before machine is auto-released'],
      ['mess_free_skips', '15', 'Default monthly skipped meals allowed without forfeiture'],
      ['mess_cap_pct', '60.00', 'Maximum refundable percentage of monthly food component'],
      ['mess_flat_refund', '1200.00', 'Historical benchmark flat refund sum per student (INR)'],
    ];

    for (const [key, val, desc] of settings) {
      await client.query(
        `INSERT INTO app_settings (setting_key, setting_value, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, description = EXCLUDED.description`,
        [key, val, desc]
      );
    }

    // 11. Schema Migrations Marker
    await client.query(
      `INSERT INTO schema_migrations (migration_name)
       VALUES ('001_postgres_schema.sql')
       ON CONFLICT (migration_name) DO NOTHING`
    );

    await client.query('COMMIT');
    console.log('[Seed Runner] Database seed completed successfully!');
    console.log('[Seed Runner] Test accounts seeded (Password: Password@123):');
    console.log('  - Administrator: admin');
    console.log('  - Hostel Office: office');
    console.log('  - Chief Warden:  chiefwarden');
    console.log('  - Warden BH1:    warden_bh1');
    console.log('  - Mess Manager:  mess_mgr');
    console.log('  - Caretaker BH1: caretaker_bh1');
    console.log('  - Student:       2026UCSDS0001');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seed Runner] Error during seed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedPostgres().catch((err) => {
  console.error('[Seed Runner] Fatal error:', err);
  process.exit(1);
});
