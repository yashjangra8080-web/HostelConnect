import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { publicRouter } from './routes/public.js';
import { noticesRouter } from './routes/notices.js';
import { lookupsRouter } from './routes/lookups.js';
import { studentsRouter } from './routes/students.js';
import { applicationsRouter } from './routes/applications.js';
import { poolRouter } from './routes/pool.js';
import { roomsRouter } from './routes/rooms.js';
import { allotmentRouter } from './routes/allotment.js';
import { waterReportsRouter } from './routes/waterReports.js';
import { maintenanceRouter } from './routes/maintenance.js';
import { notificationsRouter } from './routes/notifications.js';
import { complaintsRouter } from './routes/complaints.js';
import { adminRouter } from './routes/admin.js';
import { laundryRouter } from './routes/laundry.js';
import { messRouter } from './routes/mess.js';
import { navRouter } from './routes/nav.js';
import { searchRouter } from './routes/search.js';

export const app = express();

// Trust reverse proxy (e.g. Nginx, Caddy) for accurate client IP in rate limiting & logs
app.set('trust proxy', 1);

// Security and Foundation Middlewares
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or vitest supertest)
      callback(null, true);
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(requestIdMiddleware);

// API Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);
app.use('/api/notices', noticesRouter);
app.use('/api/lookups', lookupsRouter);
app.use('/api/students', studentsRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/pool', poolRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/allotment', allotmentRouter);
app.use('/api/water-reports', waterReportsRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/complaints', complaintsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/laundry', laundryRouter);
app.use('/api/mess', messRouter);
app.use('/api/nav', navRouter);
app.use('/api/search', searchRouter);

// Centralized Error Handling & MySQL Signal/Exception Mapper
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    console.log(`[HostelConnect API] Listening on port ${config.port} (IST / UTC+05:30)`);
  });
}
