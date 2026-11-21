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
    // Trivial database query verifying PostgreSQL connectivity
    const [rows] = await query<any[]>('SELECT 1 AS ok, NOW() AS server_time');

    if (!rows || rows.length === 0) {
      return res.status(503).json({
        status: 'error',
        message: 'No response from database health query',
      });
    }

    return res.status(200).json({
      status: 'ok',
      service: 'HostelConnect API',
      database: {
        connected: true,
        server_time: rows[0].server_time,
      },
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(503).json({
      status: 'error',
      message: 'Failed to connect to database',
      error: error?.message || String(error),
    });
  }
});
