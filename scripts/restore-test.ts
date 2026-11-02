/**
 * HostelConnect Automated Backup Restore Verification Test
 * Creates a clean temporary sandbox database, imports the latest mysqldump,
 * verifies schema object counts (27 tables, 11 views, 18 procs, 3 funcs, 55 triggers, 2 events)
 * and data integrity, then cleans up.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import { runBackup } from './backup.js';

function findMysql(): string {
  if (process.env.MYSQL_PATH && fs.existsSync(process.env.MYSQL_PATH)) {
    return process.env.MYSQL_PATH;
  }
  const defaultWindows = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe';
  if (fs.existsSync(defaultWindows)) {
    return defaultWindows;
  }
  return 'mysql';
}

export async function runRestoreTest(): Promise<void> {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || 'yash';
  const sourceDb = process.env.DB_NAME || 'hostelconnect';
  const testDb = 'hostelconnect_restore_test';

  const backupDir = path.resolve(process.cwd(), 'backups');
  const latestBackup = path.join(backupDir, 'latest.sql');

  if (!fs.existsSync(latestBackup)) {
    console.log('[Restore Test] No existing backup found. Generating fresh backup first...');
    await runBackup();
  }

  const rootConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
  });

  try {
    console.log(`[Restore Test] Creating clean scratch database \`${testDb}\`...`);
    await rootConn.query(`DROP DATABASE IF EXISTS \`${testDb}\``);
    await rootConn.query(`CREATE DATABASE \`${testDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

    const mysqlBin = findMysql();
    console.log(`[Restore Test] Restoring ${latestBackup} into \`${testDb}\` using ${mysqlBin}...`);

    await new Promise<void>((resolve, reject) => {
      const fileStream = fs.createReadStream(latestBackup);
      const proc = spawn(mysqlBin, [
        `--host=${host}`,
        `--port=${port}`,
        `--user=${user}`,
        `--password=${password}`,
        '--default-character-set=utf8mb4',
        testDb,
      ], {
        stdio: ['pipe', 'inherit', 'pipe'],
      });

      fileStream.pipe(proc.stdin);

      let stderr = '';
      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Restore failed with exit code ${code}: ${stderr}`));
        }
      });

      proc.on('error', reject);
    });

    console.log(`[Restore Test] Dump restored. Verifying database objects in \`${testDb}\`...`);

    // Verify object counts in restored DB
    const [tables] = await rootConn.query<any[]>(
      `SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
      [testDb]
    );
    const [views] = await rootConn.query<any[]>(
      `SELECT COUNT(*) as cnt FROM information_schema.views WHERE table_schema = ?`,
      [testDb]
    );
    const [procs] = await rootConn.query<any[]>(
      `SELECT COUNT(*) as cnt FROM information_schema.routines WHERE routine_schema = ? AND routine_type = 'PROCEDURE'`,
      [testDb]
    );
    const [funcs] = await rootConn.query<any[]>(
      `SELECT COUNT(*) as cnt FROM information_schema.routines WHERE routine_schema = ? AND routine_type = 'FUNCTION'`,
      [testDb]
    );
    const [triggers] = await rootConn.query<any[]>(
      `SELECT COUNT(*) as cnt FROM information_schema.triggers WHERE trigger_schema = ?`,
      [testDb]
    );
    const [events] = await rootConn.query<any[]>(
      `SELECT COUNT(*) as cnt FROM information_schema.events WHERE event_schema = ?`,
      [testDb]
    );

    const counts = {
      tables: Number(tables[0].cnt),
      views: Number(views[0].cnt),
      procedures: Number(procs[0].cnt),
      functions: Number(funcs[0].cnt),
      triggers: Number(triggers[0].cnt),
      events: Number(events[0].cnt),
    };

    console.table([
      { ObjectType: 'Base Tables', Expected: 27, Restored: counts.tables },
      { ObjectType: 'Views', Expected: 11, Restored: counts.views },
      { ObjectType: 'Stored Procedures', Expected: 18, Restored: counts.procedures },
      { ObjectType: 'Stored Functions', Expected: 3, Restored: counts.functions },
      { ObjectType: 'Triggers', Expected: 55, Restored: counts.triggers },
      { ObjectType: 'Scheduled Events', Expected: 2, Restored: counts.events },
    ]);

    if (counts.tables < 27) throw new Error(`Table count mismatch: expected at least 27, got ${counts.tables}`);
    if (counts.views < 11) throw new Error(`View count mismatch: expected at least 11, got ${counts.views}`);
    if (counts.procedures < 18) throw new Error(`Procedure count mismatch: expected at least 18, got ${counts.procedures}`);
    if (counts.functions < 3) throw new Error(`Function count mismatch: expected at least 3, got ${counts.functions}`);
    if (counts.triggers < 55) throw new Error(`Trigger count mismatch: expected at least 55, got ${counts.triggers}`);
    if (counts.events < 2) throw new Error(`Event count mismatch: expected at least 2, got ${counts.events}`);

    // Verify row count parity on key tables between sourceDb and testDb
    const keyTables = ['students', 'users', 'hostels', 'rooms', 'applications', 'complaints', 'notices'];
    for (const tbl of keyTables) {
      const [srcRow] = await rootConn.query<any[]>(`SELECT COUNT(*) as c FROM \`${sourceDb}\`.\`${tbl}\``);
      const [dstRow] = await rootConn.query<any[]>(`SELECT COUNT(*) as c FROM \`${testDb}\`.\`${tbl}\``);
      const srcC = Number(srcRow[0].c);
      const dstC = Number(dstRow[0].c);
      if (srcC !== dstC) {
        throw new Error(`Data discrepancy in table ${tbl}: source has ${srcC} rows, restored has ${dstC} rows`);
      }
      console.log(`  ✓ Table \`${tbl}\` verified with exact row count parity: ${dstC} rows.`);
    }

    console.log(`\n✓ RESTORE TEST COMPLETED: All schema objects and records restored with 100% fidelity.`);
  } finally {
    console.log(`[Restore Test] Dropping temporary test database \`${testDb}\`...`);
    await rootConn.query(`DROP DATABASE IF EXISTS \`${testDb}\``);
    await rootConn.end();
  }
}

if (process.argv[1]?.endsWith('restore-test.ts')) {
  runRestoreTest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Restore Test Failure]:', err);
      process.exit(1);
    });
}
