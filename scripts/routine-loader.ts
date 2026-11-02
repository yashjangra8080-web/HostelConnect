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
};

async function loadRoutines() {
  console.log('[Routine Loader] Connecting to MySQL...');
  const connection = await mysql.createConnection(dbConfig);
  console.log(`[Routine Loader] Connected to database: ${dbConfig.database}`);

  try {
    const routinesDir = path.resolve(process.cwd(), 'db/routines');
    if (!fs.existsSync(routinesDir)) {
      console.log(`[Routine Loader] Routines directory not found at ${routinesDir}`);
      return;
    }

    const files = fs.readdirSync(routinesDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log(`[Routine Loader] Found ${files.length} routine file(s).`);

    for (const file of files) {
      console.log(`[Routine Loader] Loading routine: ${file}...`);
      const filePath = path.join(routinesDir, file);
      const rawContent = fs.readFileSync(filePath, 'utf8');

      // Split statements on '-- STATEMENT_BREAK' or execute individual statements
      const statements = rawContent
        .split(/--\s*STATEMENT_BREAK/i)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const stmt of statements) {
        // Strip trailing semicolon if it is solitary, or execute as is without DELIMITER
        try {
          await connection.query(stmt);
        } catch (err: any) {
          console.error(`[Routine Loader] Error in ${file} executing statement:\n${stmt.substring(0, 150)}...\n`, err.message);
          throw err;
        }
      }

      console.log(`[Routine Loader] Successfully loaded: ${file}`);
    }

    console.log('[Routine Loader] All routines loaded successfully.');
  } finally {
    await connection.end();
  }
}

loadRoutines().catch((err) => {
  console.error('[Routine Loader] Failed loading routines:', err);
  process.exit(1);
});
