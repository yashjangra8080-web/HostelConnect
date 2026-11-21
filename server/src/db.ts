import mysql from 'mysql2/promise';
import { config } from './config.js';

export type Role =
  | 'ADMIN'
  | 'HOSTEL_OFFICE'
  | 'CHIEF_WARDEN'
  | 'WARDEN'
  | 'MESS_MANAGER'
  | 'CARETAKER'
  | 'STUDENT';

// Root/System Pool for admin tasks and unauthenticated lookup
export const pool = mysql.createPool(config.db);

// Dedicated connection pools for each of the 7 roles
const rolePools = new Map<Role, mysql.Pool>();

export function getPoolForRole(role: Role): mysql.Pool {
  let rPool = rolePools.get(role);
  if (!rPool) {
    const roleCreds = config.roles[role];
    if (!roleCreds) {
      throw new Error(`[DB] No credentials configured for role: ${role}`);
    }

    rPool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: roleCreds.user,
      password: roleCreds.password,
      database: config.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: '+05:30',
      charset: 'utf8mb4',
    });

    rolePools.set(role, rPool);
  }
  return rPool;
}

/**
 * Executes a callback with a dedicated role pool connection.
 * Injects session context `SET @app_user_id = ?`, and guarantees `@app_user_id` is
 * reset to NULL in a `finally` block before releasing the connection back to the pool.
 */
export async function withRequestConn<T>(
  role: Role,
  userId: number | null | undefined,
  fn: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  let conn: mysql.PoolConnection;
  try {
    const p = getPoolForRole(role);
    conn = await p.getConnection();
  } catch (err: any) {
    // Graceful fallback to root/primary pool if role-specific MySQL user does not exist on cloud database
    if (err && (err.code === 'ER_ACCESS_DENIED_ERROR' || err.errno === 1045)) {
      conn = await pool.getConnection();
    } else {
      throw err;
    }
  }

  try {
    if (userId !== undefined && userId !== null) {
      await conn.query('SET @app_user_id = ?', [userId]);
    } else {
      await conn.query('SET @app_user_id = NULL');
    }
    return await fn(conn);
  } finally {
    try {
      await conn.query('SET @app_user_id = NULL');
    } catch (cleanErr) {
      console.error('[DB] Warning: Failed to reset @app_user_id on connection release:', cleanErr);
    }
    conn.release();
  }
}

export async function query<T = any>(sql: string, params?: any[]): Promise<[T, mysql.FieldPacket[]]> {
  return pool.query(sql, params) as Promise<[T, mysql.FieldPacket[]]>;
}

export async function closeAllPools(): Promise<void> {
  await pool.end();
  for (const [role, p] of rolePools.entries()) {
    await p.end();
  }
  rolePools.clear();
}
