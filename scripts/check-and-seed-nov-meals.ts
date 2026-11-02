import { pool, closeAllPools } from '../server/src/db.js';

async function check() {
  const [rows]: any = await pool.query(
    'SELECT COUNT(*) as count FROM meals WHERE MONTH(meal_date) = 11 AND YEAR(meal_date) = 2026'
  );
  console.log('November 2026 meals count:', rows[0].count);

  if (rows[0].count === 0) {
    console.log('Generating meals for November 2026 for hostels 1, 2, 3...');
    await pool.query('CALL sp_generate_meals(1, 11, 2026)');
    await pool.query('CALL sp_generate_meals(2, 11, 2026)');
    await pool.query('CALL sp_generate_meals(3, 11, 2026)');
    console.log('Generated meals for hostels 1, 2, 3!');
  }

  // Also check October 2026 refunds preview
  const [refCount]: any = await pool.query(
    'SELECT COUNT(*) as count, status FROM mess_refunds WHERE month = 10 AND year = 2026 GROUP BY status'
  );
  console.log('October 2026 refunds in DB:', refCount);

  // If no refunds in October 2026 yet, run preview
  if (refCount.length === 0) {
    console.log('Calculating preview for October 2026...');
    await pool.query("CALL sp_calculate_refunds(1, 10, 2026, 'PREVIEW')");
    await pool.query("CALL sp_calculate_refunds(2, 10, 2026, 'PREVIEW')");
    await pool.query("CALL sp_calculate_refunds(3, 10, 2026, 'PREVIEW')");
  }

  await closeAllPools();
}

check().catch(console.error);
