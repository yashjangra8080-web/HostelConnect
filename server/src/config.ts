import dotenv from 'dotenv';
import path from 'path';

// Load .env from root or server
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'hostelconnect-dev-secret-key-2026-nsut',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'yash',
    database: process.env.DB_NAME || 'hostelconnect',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+05:30',
    charset: 'utf8mb4',
  },
  roles: {
    ADMIN: {
      user: process.env.DB_USER_ADMIN || 'hc_admin',
      password: process.env.DB_PASSWORD_ADMIN || 'hc_admin_pass',
    },
    HOSTEL_OFFICE: {
      user: process.env.DB_USER_HOSTEL_OFFICE || 'hc_hostel_office',
      password: process.env.DB_PASSWORD_HOSTEL_OFFICE || 'hc_hostel_office_pass',
    },
    CHIEF_WARDEN: {
      user: process.env.DB_USER_CHIEF_WARDEN || 'hc_chief_warden',
      password: process.env.DB_PASSWORD_CHIEF_WARDEN || 'hc_chief_warden_pass',
    },
    WARDEN: {
      user: process.env.DB_USER_WARDEN || 'hc_warden',
      password: process.env.DB_PASSWORD_WARDEN || 'hc_warden_pass',
    },
    MESS_MANAGER: {
      user: process.env.DB_USER_MESS_MANAGER || 'hc_mess_manager',
      password: process.env.DB_PASSWORD_MESS_MANAGER || 'hc_mess_manager_pass',
    },
    CARETAKER: {
      user: process.env.DB_USER_CARETAKER || 'hc_caretaker',
      password: process.env.DB_PASSWORD_CARETAKER || 'hc_caretaker_pass',
    },
    STUDENT: {
      user: process.env.DB_USER_STUDENT || 'hc_student',
      password: process.env.DB_PASSWORD_STUDENT || 'hc_student_pass',
    },
  },
};
