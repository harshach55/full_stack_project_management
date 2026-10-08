import type { HealthResponse } from '@pm/shared';
import { Router } from 'express';
import type { AppDeps } from '../../app.js';

const DATABASE_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('database check timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Unauthenticated health check with a lightweight database round trip (SELECT 1).
 * The body never contains versions, hosts, configuration or error details.
 */
export function createHealthRouter({ prisma }: AppDeps): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      await withTimeout(prisma.$queryRaw`SELECT 1`, DATABASE_TIMEOUT_MS);
      const body: HealthResponse = { status: 'ok', database: 'ok' };
      res.status(200).json(body);
    } catch (error) {
      req.log.warn({ reason: error instanceof Error ? error.message : 'unknown' }, 'health check: database unavailable');
      const body: HealthResponse = { status: 'error', database: 'unavailable' };
      res.status(503).json(body);
    }
  });

  return router;
}
