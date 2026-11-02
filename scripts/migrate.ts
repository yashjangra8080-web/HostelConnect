import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'yash',
  database: process.env.DB_NAME || 'hostelconnect',
  multipleStatements: true,
};

async function runMigrations() {
  const isFresh = process.argv.includes('--fresh') || process.argv.includes('--reset');
  console.log(`[Migration Runner] Connecting to MySQL server... (fresh: ${isFresh})`);
  
  // First connect without specifying database to ensure it exists
  const serverConn = await mysql.createConnection({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
  });

  if (isFresh) {
    console.log(`[Migration Runner] Dropping database \`${dbConfig.database}\` for clean setup...`);
    await serverConn.query(`DROP DATABASE IF EXISTS \`${dbConfig.database}\`;`);
  }

  await serverConn.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  );
  await serverConn.end();

  // Connect to the specific database
  const connection = await mysql.createConnection(dbConfig);
  console.log(`[Migration Runner] Connected to database: ${dbConfig.database}`);

  try {
    // 1. Ensure schema_migrations table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 2. Fetch applied migrations
    const [appliedRows] = await connection.query<any[]>(
      'SELECT migration_name FROM schema_migrations'
    );
    const appliedSet = new Set(appliedRows.map((r) => r.migration_name));

    // 3. Read migration files
    const migrationsDir = path.resolve(process.cwd(), 'db/migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log(`[Migration Runner] No migrations directory found at ${migrationsDir}`);
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log(`[Migration Runner] Found ${files.length} migration file(s).`);

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[Migration Runner] Skipping already applied: ${file}`);
        continue;
      }

      console.log(`[Migration Runner] Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');

      // Execute entire migration file using multipleStatements
      await connection.beginTransaction();
      try {
        await connection.query(sqlContent);
        await connection.query(
          'INSERT INTO schema_migrations (migration_name) VALUES (?)',
          [file]
        );
        await connection.commit();
        console.log(`[Migration Runner] Successfully applied: ${file}`);
      } catch (err) {
        await connection.rollback();
        console.error(`[Migration Runner] ERROR applying ${file}:`, err);
        throw err;
      }
    }

    console.log('[Migration Runner] All migrations up to date.');
  } finally {
    await connection.end();
  }
}

runMigrations().catch((err) => {
  console.error('[Migration Runner] Migration failed:', err);
  process.exit(1);
});
