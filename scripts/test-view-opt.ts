import mysql from 'mysql2/promise';

async function main() {
  const c = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'yash',
    database: 'hostelconnect',
  });

  const t0 = performance.now();
  for (let i = 0; i < 20; i++) {
    await c.query(`
      SELECT COUNT(*) as total 
      FROM applications a 
      JOIN students s ON a.student_id = s.student_id 
      WHERE a.cycle_id = 1 AND a.verification_status = 'VERIFIED'
    `);
  }
  const d0 = (performance.now() - t0) / 20;
  console.log(`Base table COUNT avg duration: ${d0.toFixed(2)} ms`);

  await c.end();
}

main().catch(console.error);
