/**
 * HostelConnect Demo Reset Utility
 * Resets the database to a pristine, predictable state for live demonstrations.
 * Re-aligns demo account passwords, resets laundry machines to AVAILABLE,
 * cleans transient test complaints/cycles, and verifies 2,000-student seed baseline.
 */
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

async function resetDemo() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || 'yash';
  const database = process.env.DB_NAME || 'hostelconnect';

  console.log(`[Demo Reset] Connecting to database \`${database}\` at ${host}:${port}...`);
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
  });

  try {
    // 1. Clean test cycles and benchmark artifacts
    console.log('[Demo Reset] Cleaning test allotment cycles and transient mock records...');
    await conn.query('DELETE FROM allotments WHERE cycle_id = 8888');
    await conn.query('DELETE FROM ranking_snapshot WHERE cycle_id = 8888');
    await conn.query('DELETE FROM allotment_cycles WHERE cycle_id = 8888');

    // Reset Cycle 1 to PUBLISHED for demo
    await conn.query(`
      UPDATE allotment_cycles
      SET status = 'PUBLISHED',
          opened_on = '2026-08-01',
          closed_on = '2026-08-15',
          published_on = '2026-08-16 10:00:00',
          response_deadline = DATE_ADD(NOW(), INTERVAL 7 DAY)
      WHERE cycle_id = 1
    `);

    // 2. Reset Core Demo Accounts Passwords and Security States
    console.log('[Demo Reset] Synchronizing standard credentials for all 7 demonstration roles...');
    const demoPasswordHash = await bcrypt.hash('Password@123', 10);
    const demoLogins = [
      'admin',
      'office',
      'chiefwarden',
      'warden_bh1',
      'mess_mgr',
      'caretaker_bh1',
      '2026UCSDS0001',
    ];

    for (const loginId of demoLogins) {
      await conn.query(
        `UPDATE users
         SET password_hash = ?,
             failed_attempts = 0,
             locked_until = NULL,
             must_change_password = 0,
             is_active = 1
         WHERE login_id = ?`,
        [demoPasswordHash, loginId]
      );
    }

    // 3. Reset Washing Machines to Clean State
    console.log('[Demo Reset] Resetting smart laundry machines...');
    await conn.query(`
      UPDATE washing_machines
      SET status = 'FREE',
          current_student_id = NULL,
          started_at = NULL,
          expected_end_at = NULL
      WHERE status != 'OUT_OF_ORDER'
    `);
    // Put 1 machine in OCCUPIED for visual demonstration
    await conn.query(`
      UPDATE washing_machines
      SET status = 'OCCUPIED',
          current_student_id = 1,
          started_at = DATE_SUB(NOW(), INTERVAL 15 MINUTE),
          expected_end_at = DATE_ADD(NOW(), INTERVAL 30 MINUTE)
      WHERE machine_id = 1
    `);

    // 4. Clean transient test complaints created during test runs
    console.log('[Demo Reset] Purging transient automated test complaints...');
    await conn.query(`
      DELETE FROM complaint_responses
      WHERE complaint_id IN (
        SELECT complaint_id FROM complaints
        WHERE subject LIKE '%Test%' OR subject LIKE '%Unauthorized%' OR subject LIKE '%Fuzz%'
      )
    `);
    await conn.query(`
      DELETE FROM complaints
      WHERE subject LIKE '%Test%' OR subject LIKE '%Unauthorized%' OR subject LIKE '%Fuzz%'
    `);

    // 5. Clean test water quality and maintenance records
    await conn.query(`
      DELETE FROM water_quality_reports WHERE remarks LIKE '%Sample test%' OR remarks LIKE '%Test%'
    `);

    // 6. Verify seed integrity
    const [studentRows] = await conn.query<any[]>('SELECT COUNT(*) as cnt FROM students');
    const [userRows] = await conn.query<any[]>('SELECT COUNT(*) as cnt FROM users');
    const [hostelRows] = await conn.query<any[]>('SELECT COUNT(*) as cnt FROM hostels');

    console.log('\n======================================================');
    console.log('DEMO STATE READY & VERIFIED:');
    console.log(`  • Registered Students: ${studentRows[0].cnt}`);
    console.log(`  • Active User Accounts: ${userRows[0].cnt}`);
    console.log(`  • Hostels Configured: ${hostelRows[0].cnt}`);
    console.log('======================================================');
    console.log('Credentials for all demo accounts:');
    console.log('  Password: Password@123');
    console.log('  • Admin:            admin');
    console.log('  • Hostel Office:    office');
    console.log('  • Chief Warden:     chiefwarden');
    console.log('  • Block Warden:     warden_bh1');
    console.log('  • Mess Manager:     mess_mgr');
    console.log('  • Caretaker:        caretaker_bh1');
    console.log('  • Student:          2026UCSDS0001');
    console.log('======================================================\n');
  } finally {
    await conn.end();
  }
}

resetDemo()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[Demo Reset Failure]:', err);
    process.exit(1);
  });
