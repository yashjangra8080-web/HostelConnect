import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'yash',
  database: process.env.DB_NAME || 'hostelconnect',
};

const ROLES = [
  'ADMIN',
  'HOSTEL_OFFICE',
  'CHIEF_WARDEN',
  'WARDEN',
  'MESS_MANAGER',
  'CARETAKER',
  'STUDENT'
];

async function showGrants() {
  console.log('================================================================================');
  console.log('HostelConnect — MySQL Role Privilege Audit (Least Privilege)');
  console.log('================================================================================\n');

  const conn = await mysql.createConnection(dbConfig);

  try {
    for (const role of ROLES) {
      console.log(`>>> Grants for Role: \`${role}\``);
      try {
        const [rows] = await conn.query<any[]>(`SHOW GRANTS FOR '${role}'`);
        for (const row of rows) {
          const grantStr = Object.values(row)[0];
          console.log(`    ${grantStr}`);
        }
      } catch (err: any) {
        console.error(`    Error fetching grants for ${role}: ${err.message}`);
      }
      console.log('');
    }
  } finally {
    await conn.end();
  }
}

showGrants().catch((err) => {
  console.error('Error running show-grants:', err);
  process.exit(1);
});
