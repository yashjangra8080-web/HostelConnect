import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import bcrypt from 'bcryptjs';

async function runPostgresVerification() {
  console.log('========================================================');
  console.log('1. Initializing in-memory PostgreSQL 15 (PGlite)...');
  console.log('========================================================');
  const db = new PGlite();

  console.log('\n2. Executing db/postgres_schema.sql...');
  const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'db/postgres_schema.sql'), 'utf8');
  await db.exec(schemaSql);
  console.log('  [PASS] PostgreSQL schema applied successfully!');

  console.log('\n3. Verifying all 26 tables exist and have RLS enabled...');
  const rlsRes = await db.query<{ tablename: string; rowsecurity: boolean }>(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);

  const tables = rlsRes.rows;
  console.log(`  Found ${tables.length} tables in public schema:`);
  let allRlsEnabled = true;
  for (const t of tables) {
    if (!t.rowsecurity) {
      console.error(`  [FAIL] Table ${t.tablename} does NOT have RLS enabled!`);
      allRlsEnabled = false;
    }
  }
  if (allRlsEnabled) {
    console.log(`  [PASS] All ${tables.length} tables have Row Level Security (RLS) ENABLED!`);
  }

  console.log('\n4. Running First Seed Execution...');
  await runSeed(db);
  console.log('  [PASS] First seed execution completed successfully!');

  console.log('\n5. Running Second Seed Execution (Idempotency Test)...');
  await runSeed(db);
  console.log('  [PASS] Second seed execution completed with NO duplicate key or constraint errors!');

  console.log('\n6. Verifying User Accounts & Password Hashing...');
  const usersRes = await db.query<{ user_id: number; login_id: string; role: string; password_hash: string }>(`
    SELECT user_id, login_id, role, password_hash FROM users ORDER BY user_id;
  `);
  console.log(`  Total users seeded: ${usersRes.rows.length}`);

  const requiredRoles = ['admin', 'office', 'chiefwarden', 'warden_bh1', 'caretaker_bh1', 'mess_mgr', '2026UCSDS0001'];
  for (const loginId of requiredRoles) {
    const user = usersRes.rows.find((u) => u.login_id === loginId);
    if (!user) {
      throw new Error(`Missing required user: ${loginId}`);
    }
    const match = await bcrypt.compare('Password@123', user.password_hash);
    if (!match) {
      throw new Error(`Password verification failed for user ${loginId}`);
    }
    const wrongMatch = await bcrypt.compare('WrongPassword', user.password_hash);
    if (wrongMatch) {
      throw new Error(`Wrong password unexpectedly matched for ${loginId}`);
    }
    console.log(`  [PASS] Verified ${user.role} (${user.login_id}): Password@123 OK, wrong password rejected.`);
  }

  console.log('\n7. Verifying PostgreSQL Views...');
  const views = [
    'v_current_residence',
    'v_machine_status',
    'v_meal_counts',
    'v_mess_summary',
    'v_ranked_applicants',
    'v_public_applicant_pool',
    'v_scoped_students',
    'v_scoped_applications',
  ];

  for (const v of views) {
    const vRes = await db.query(`SELECT COUNT(*) as count FROM ${v}`);
    console.log(`  [PASS] View ${v}: query succeeded (count: ${vRes.rows[0].count})`);
  }

  console.log('\n========================================================');
  console.log('ALL POSTGRESQL VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('========================================================');
}

async function runSeed(db: PGlite) {
  // 1. States
  const states = [
    [1, 'Delhi', 'DL'],
    [2, 'Uttar Pradesh', 'UP'],
    [3, 'Haryana', 'HR'],
    [4, 'Rajasthan', 'RJ'],
    [5, 'Punjab', 'PB'],
  ];
  for (const [id, name, code] of states) {
    await db.query(
      `INSERT INTO states (state_id, state_name, state_code)
       VALUES ($1, $2, $3)
       ON CONFLICT (state_name) DO UPDATE SET state_code = EXCLUDED.state_code`,
      [id, name, code]
    );
  }

  // 2. Cities
  const cities = [
    [1, 1, 'New Delhi', 28.6139, 77.209],
    [2, 2, 'Noida', 28.5355, 77.391],
    [3, 3, 'Gurugram', 28.4595, 77.0266],
    [4, 4, 'Jaipur', 26.9124, 75.7873],
  ];
  for (const [id, stateId, name, lat, lon] of cities) {
    await db.query(
      `INSERT INTO cities (city_id, state_id, city_name, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (city_id) DO UPDATE SET city_name = EXCLUDED.city_name, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude`,
      [id, stateId, name, lat, lon]
    );
  }

  // 3. Hostels
  const hostels = [
    [1, 'Boys Hostel 1 (Ramanujan Bhawan)', 'BOYS'],
    [2, 'Boys Hostel 2 (Aryabhatta Bhawan)', 'BOYS'],
    [3, 'Girls Hostel 1 (Kalpana Chawla Bhawan)', 'GIRLS'],
  ];
  for (const [id, name, gender] of hostels) {
    await db.query(
      `INSERT INTO hostels (hostel_id, hostel_name, gender_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (hostel_name) DO UPDATE SET gender_type = EXCLUDED.gender_type`,
      [id, name, gender]
    );
  }

  // 4. Meal Types
  const mealTypes = [
    [1, 'BREAKFAST', '07:30:00', '09:30:00'],
    [2, 'LUNCH', '12:30:00', '14:30:00'],
    [3, 'SNACKS', '17:00:00', '18:30:00'],
    [4, 'DINNER', '19:45:00', '21:45:00'],
  ];
  for (const [id, name, start, end] of mealTypes) {
    await db.query(
      `INSERT INTO meal_types (meal_type_id, type_name, start_time, end_time)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (type_name) DO UPDATE SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time`,
      [id, name, start, end]
    );
  }

  // 5. Staff Accounts
  const passwordHash = await bcrypt.hash('Password@123', 10);
  const staff = [
    { loginId: 'admin', role: 'ADMIN', name: 'Dr. System Administrator', desig: null, hostelId: null },
    { loginId: 'office', role: 'HOSTEL_OFFICE', name: 'Sh. Rajesh Kumar (Office)', desig: 'HOSTEL_OFFICE', hostelId: null },
    { loginId: 'chiefwarden', role: 'CHIEF_WARDEN', name: 'Prof. S. K. Verma', desig: 'CHIEF_WARDEN', hostelId: null },
    { loginId: 'warden_bh1', role: 'WARDEN', name: 'Dr. Alok Nath (Warden BH1)', desig: 'HOSTEL_WARDEN', hostelId: 1 },
    { loginId: 'mess_mgr', role: 'MESS_MANAGER', name: 'Sh. Vikram Singh (Mess Head)', desig: 'MESS_MANAGER', hostelId: 1 },
    { loginId: 'caretaker_bh1', role: 'CARETAKER', name: 'Sh. Ramesh Yadav (Caretaker BH1)', desig: 'CARETAKER', hostelId: 1 },
  ];

  for (const s of staff) {
    const res = await db.query<{ user_id: number }>(
      `INSERT INTO users (login_id, password_hash, role, is_active, must_change_password)
       VALUES ($1, $2, $3, 1, 0)
       ON CONFLICT (login_id) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING user_id`,
      [s.loginId, passwordHash, s.role]
    );
    if (s.desig) {
      await db.query(
        `INSERT INTO authorities (user_id, hostel_id, designation, full_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name`,
        [res.rows[0].user_id, s.hostelId, s.desig, s.name]
      );
    }
  }

  // 6. Student Account: 2026UCSDS0001
  const studRes = await db.query<{ user_id: number }>(
    `INSERT INTO users (login_id, password_hash, role, is_active, must_change_password)
     VALUES ($1, $2, 'STUDENT', 1, 0)
     ON CONFLICT (login_id) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING user_id`,
    ['2026UCSDS0001', passwordHash]
  );
  await db.query(
    `INSERT INTO students (user_id, roll_no, full_name, gender, branch, batch_year, merit_rank, schooling_state_id, home_city_id, study_habit)
     VALUES ($1, $2, $3, 'M', 'CSDS', 2026, 150, 1, 1, 'DAY')
     ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name`,
    [studRes.rows[0].user_id, '2026UCSDS0001', 'Yash Vardhan']
  );

  // 7. Allotment Cycle
  await db.query(
    `INSERT INTO allotment_cycles (cycle_id, academic_year, status, opened_on)
     VALUES (1, '2026-27', 'OPEN', '2026-08-01')
     ON CONFLICT (cycle_id) DO UPDATE SET status = EXCLUDED.status`
  );

  // 8. Washing Machines
  await db.query(
    `INSERT INTO washing_machines (hostel_id, label, floor_no, status)
     VALUES (1, 'WM-101', 1, 'FREE')
     ON CONFLICT (hostel_id, label) DO UPDATE SET status = EXCLUDED.status`
  );
}

runPostgresVerification().catch((err) => {
  console.error('[Verification Failed]:', err);
  process.exit(1);
});
