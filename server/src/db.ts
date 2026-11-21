import pg from 'pg';
import { config } from './config.js';

export type Role =
  | 'ADMIN'
  | 'HOSTEL_OFFICE'
  | 'CHIEF_WARDEN'
  | 'WARDEN'
  | 'MESS_MANAGER'
  | 'CARETAKER'
  | 'STUDENT';

// Configure SSL based on Supabase or production environment
const isSsl = Boolean(
  config.databaseUrl.includes('supabase') ||
  config.databaseUrl.includes('pooler.supabase.com') ||
  config.databaseUrl.includes('sslmode=require') ||
  config.nodeEnv === 'production'
);

// Primary PostgreSQL connection pool (max 10 connections for free-tier compatibility)
export const pgPool = new pg.Pool({
  connectionString: config.databaseUrl || `postgresql://postgres:postgres@127.0.0.1:5432/postgres`,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: isSsl ? { rejectUnauthorized: false } : false,
});

/**
 * Transforms MySQL-style '?' placeholders into PostgreSQL '$1, $2, ...' placeholders,
 * ignoring '?' that appears inside single-quoted string literals.
 */
export function convertPlaceholders(sql: string): string {
  let index = 1;
  return sql.replace(/'(?:[^'\\]|\\.)*'|\?/g, (match) => {
    if (match === '?') {
      return `$${index++}`;
    }
    return match;
  });
}

/**
 * Wraps a pg QueryResult to match the [rows, fields] tuple format expected
 * by existing route handlers designed for mysql2.
 */
function formatPgResult<T = any>(res: pg.QueryResult<any>): [T, any[]] {
  return [res.rows as unknown as T, res.fields || []];
}

/**
 * PostgreSQL connection wrapper providing [rows, fields] return format.
 */
export interface CompatConnection {
  query: <T = any>(sql: string, params?: any[]) => Promise<[T, any[]]>;
  release: () => void;
}

/**
 * Compatibility pool exposing a mysql2-compatible .query() method.
 */
export const pool = {
  query: async <T = any>(sql: string, params?: any[]): Promise<[T, any[]]> => {
    const pgSql = convertPlaceholders(sql);
    const res = await pgPool.query(pgSql, params);
    return formatPgResult<T>(res);
  },
  end: async (): Promise<void> => {
    await pgPool.end();
  },
};

/**
 * Executes a callback with a dedicated connection from the PostgreSQL pool.
 * Injects session context `set_config('app.user_id', ?, true)` and guarantees
 * it is reset before the connection is returned to the pool.
 */
export async function withRequestConn<T>(
  role: Role,
  userId: number | null | undefined,
  fn: (conn: CompatConnection) => Promise<T>
): Promise<T> {
  const client = await pgPool.connect();

  const compatConn: CompatConnection = {
    query: async <R = any>(sql: string, params?: any[]): Promise<[R, any[]]> => {
      const pgSql = convertPlaceholders(sql);
      const res = await client.query(pgSql, params);
      return formatPgResult<R>(res);
    },
    release: () => {
      client.release();
    },
  };

  try {
    if (userId !== undefined && userId !== null) {
      await client.query("SELECT set_config('app.user_id', $1, true)", [String(userId)]);
    } else {
      await client.query("SELECT set_config('app.user_id', '', true)");
    }
    return await fn(compatConn);
  } finally {
    try {
      await client.query("SELECT set_config('app.user_id', '', true)");
    } catch (cleanErr) {
      console.error('[DB] Warning: Failed to reset app.user_id on connection release:', cleanErr);
    }
    client.release();
  }
}

/**
 * Standard parameterized query runner returning [rows, fields].
 */
export async function query<T = any>(sql: string, params?: any[]): Promise<[T, any[]]> {
  const pgSql = convertPlaceholders(sql);
  const res = await pgPool.query(pgSql, params);
  return formatPgResult<T>(res);
}

export async function closeAllPools(): Promise<void> {
  await pgPool.end();
}
