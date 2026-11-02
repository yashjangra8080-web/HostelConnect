import mysql from 'mysql2/promise';

async function main() {
  const c = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'yash',
    database: 'hostelconnect',
  });

  const tables = ['students', 'applications', 'notifications', 'mess_refunds', 'complaints', 'rooms', 'washing_machines'];
  for (const t of tables) {
    const [indexes] = await c.query<any[]>(`SHOW INDEXES FROM ${t}`);
    console.log(`\n=== Table: ${t} ===`);
    for (const idx of indexes) {
      console.log(`  ${idx.Key_name} (${idx.Column_name}) - Seq: ${idx.Seq_in_index}, Non_unique: ${idx.Non_unique}`);
    }
  }

  await c.end();
}

main().catch(console.error);
