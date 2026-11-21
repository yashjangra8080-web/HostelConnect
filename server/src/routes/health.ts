import { Router, Request, Response } from 'express';
import { query } from '../db.js';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'HostelConnect API',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const [rows] = await query<any[]>(
      'SELECT @@event_scheduler AS event_scheduler, @@time_zone AS time_zone, NOW() AS server_time'
    );

    if (!rows || rows.length === 0) {
      res.status(503).json({
        status: 'error',
        message: 'No response from database health query',
      });
      return;
    }

    const { event_scheduler, time_zone, server_time } = rows[0];
    const isSchedulerOn = String(event_scheduler).toUpperCase() === 'ON';

    if (!isSchedulerOn) {
      res.status(503).json({
        status: 'degraded',
        message: 'Event scheduler is OFF',
        database: {
          connected: true,
          event_scheduler,
          time_zone,
          server_time,
        },
      });
      return;
    }

    res.status(200).json({
      status: 'ok',
      database: {
        connected: true,
        event_scheduler,
        time_zone,
        server_time,
      },
      uptimeSeconds: process.uptime(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      message: 'Failed to connect to database',
      error: error?.message || String(error),
    });
  }
});
