import { pool } from '../server/src/db.js';

async function main() {
  await pool.query("DROP TRIGGER IF EXISTS trg_mess_refunds_before_delete");
  await pool.query("GRANT SELECT ON hostelconnect.v_mess_summary TO 'ADMIN', 'HOSTEL_OFFICE', 'CHIEF_WARDEN', 'WARDEN', 'MESS_MANAGER', 'CARETAKER', 'STUDENT'");
  await pool.query("GRANT INSERT, UPDATE ON hostelconnect.app_settings TO 'MESS_MANAGER'");
  await pool.query("FLUSH PRIVILEGES");
  console.log('Phase 9 grants applied and before_delete trigger removed.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
