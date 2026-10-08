import { Router } from 'express';
import { z } from 'zod';
import type { AppDeps } from '../../app.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { getDashboard } from './dashboard.service.js';

/** The dashboard takes no query parameters; unknown ones are rejected. */
const noQuerySchema = z.strictObject({});

export function createDashboardRouter({ config, prisma }: AppDeps): Router {
  const router = Router();

  router.get('/', authenticate(prisma, config.jwtSecret), validate({ query: noQuerySchema }), async (req, res) => {
    res.json(await getDashboard(prisma, req.auth!.userId));
  });

  return router;
}
