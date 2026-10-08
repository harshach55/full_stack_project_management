import type { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import type { Config } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requireJsonContentType } from './middleware/json-content-type.js';
import { originCheck } from './middleware/origin-check.js';
import { requestId } from './middleware/request-id.js';
import { createApiRouter } from './routes.js';

export interface AppDeps {
  config: Config;
  prisma: PrismaClient;
  logger: Logger;
}

/**
 * Builds the Express app without listening, so tests can use it directly.
 * Middleware order follows backend-design.md, section 4.
 */
export function createApp(deps: AppDeps): Express {
  const { config, logger } = deps;
  const app = express();

  // 1. Number of proxies in front of the API (1 on Render), so req.ip is the real client address.
  app.set('trust proxy', config.trustProxyHops);

  // 2. Request id on every request and response.
  app.use(requestId());

  // 3. One log line per request; headers and bodies are not logged.
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      customLogLevel: (req, res, error) => {
        if (error || res.statusCode >= 500) return 'error';
        // originalUrl: inside mounted routers Express rewrites req.url.
        if ((req as express.Request).originalUrl?.startsWith('/api/health')) return 'debug';
        return 'info';
      },
      customProps: (req) => (req.auth ? { userId: req.auth.userId } : {}),
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          path: req.url.split('?')[0],
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  // 4. Security headers.
  app.use(helmet());

  // 5. CORS for browsers calling the API origin directly: exact allowlist, never "*".
  const allowedOrigins = new Set(config.corsAllowedOrigins);
  app.use(
    cors({
      origin: (origin, callback) => callback(null, origin !== undefined && allowedOrigins.has(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Type', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'Retry-After'],
      maxAge: 600,
      optionsSuccessStatus: 204,
    }),
  );

  // 6. Origin check for state-changing requests (CSRF protection for cookie sessions).
  app.use(originCheck(config.corsAllowedOrigins));

  // 7. JSON bodies only, at most 100 kb.
  app.use(requireJsonContentType());
  app.use(express.json({ limit: '100kb' }));

  // 8. Cookies (session cookie for web clients).
  app.use(cookieParser());

  // 9. Routes.
  app.use('/api', createApiRouter(deps));

  // 10-11. Unknown routes and the central error handler.
  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}
