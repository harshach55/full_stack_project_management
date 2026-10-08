import { loginBodySchema, registerBodySchema } from '@pm/shared';
import { Router } from 'express';
import { z } from 'zod';
import type { AppDeps } from '../../app.js';
import { authenticate } from '../../middleware/authenticate.js';
import { resolveClientType } from '../../middleware/client-type.js';
import { createRateLimiters } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { clearSessionCookieForCookieRequests } from './auth.cookies.js';
import { createAuthController } from './auth.controller.js';

/** Logout takes no body; an empty JSON object is accepted. */
const emptyBodySchema = z.strictObject({});

export function createAuthRouter({ config, prisma }: AppDeps): Router {
  const router = Router();
  const controller = createAuthController(prisma, config);
  const limiters = createRateLimiters(config.rateLimit);
  const requireAuth = authenticate(prisma, config.jwtSecret);

  router.post(
    '/register',
    limiters.registerIp,
    resolveClientType(),
    validate({ body: registerBodySchema }),
    controller.register,
  );
  router.post(
    '/login',
    limiters.loginIp,
    limiters.loginAccount,
    resolveClientType(),
    validate({ body: loginBodySchema }),
    controller.login,
  );
  router.post(
    '/logout',
    clearSessionCookieForCookieRequests(config.cookieSecure),
    requireAuth,
    validate({ body: emptyBodySchema }),
    controller.logout,
  );
  router.get('/me', requireAuth, controller.me);

  return router;
}
