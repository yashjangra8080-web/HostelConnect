/**
 * HostelConnect Automated Database Backup Utility (mysqldump)
 * Dumps live schema, tables, routines (procedures & functions), triggers, and scheduled events.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

function findMysqldump(): string {
  if (process.env.MYSQLDUMP_PATH && fs.existsSync(process.env.MYSQLDUMP_PATH)) {
    return process.env.MYSQLDUMP_PATH;
  }
  const defaultWindows = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe';
  if (fs.existsSync(defaultWindows)) {
    return defaultWindows;
  }
  return 'mysqldump';
}

export async function runBackup(targetFilePath?: string): Promise<string> {
  const mysqldumpBin = findMysqldump();
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT || '3306';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || 'yash';
  const dbName = process.env.DB_NAME || 'hostelconnect';

  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputFile = targetFilePath || path.join(backupDir, `hostelconnect_${timestamp}.sql`);
  const latestFile = path.join(backupDir, 'latest.sql');

  const args = [
    `--host=${host}`,
    `--port=${port}`,
    `--user=${user}`,
    `--password=${password}`,
    '--single-transaction',
    '--routines',
    '--triggers',
    '--events',
    '--quick',
    '--hex-blob',
    '--default-character-set=utf8mb4',
    dbName,
  ];

  console.log(`[Backup] Initiating mysqldump using binary: ${mysqldumpBin}`);
  console.log(`[Backup] Target: ${outputFile}`);

  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(outputFile, { encoding: 'utf8' });
    const proc = spawn(mysqldumpBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.stdout.pipe(fileStream);

    proc.on('close', (code) => {
      if (code === 0) {
        // Copy to latest.sql
        fs.copyFileSync(outputFile, latestFile);
        const stats = fs.statSync(outputFile);
        console.log(`[Backup] Completed successfully. Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`[Backup] Latest pointer: ${latestFile}`);
        resolve(outputFile);
      } else {
        console.error(`[Backup Error] Process exited with code ${code}`);
        console.error(stderr);
        reject(new Error(`mysqldump failed with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// Allow direct CLI execution
if (process.argv[1]?.endsWith('backup.ts')) {
  runBackup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
