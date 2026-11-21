import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

const isSsl = Boolean(
  databaseUrl.includes('supabase') ||
  databaseUrl.includes('pooler.supabase.com') ||
  databaseUrl.includes('sslmode=require') ||
  process.env.NODE_ENV === 'production'
);

async function runPostgresMigrations() {
  console.log('[Migration Runner] Connecting to PostgreSQL database...');
  console.log(`[Migration Runner] URL target: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: isSsl ? { rejectUnauthorized: false } : false,
    max: 5,
  });

  const client = await pool.connect();

  try {
    const schemaPath = path.resolve(process.cwd(), 'db/postgres_schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }

    console.log(`[Migration Runner] Reading schema from ${schemaPath}...`);
    const sqlContent = fs.readFileSync(schemaPath, 'utf8');

    console.log('[Migration Runner] Applying PostgreSQL schema & RLS policies...');
    await client.query(sqlContent);

    console.log('[Migration Runner] Successfully applied PostgreSQL schema!');
  } catch (err) {
    console.error('[Migration Runner] Error applying schema:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runPostgresMigrations().catch((err) => {
  console.error('[Migration Runner] Fatal error:', err);
  process.exit(1);
});
