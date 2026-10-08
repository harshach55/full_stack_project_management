import { Router } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import type { AppDeps } from './app.js';
import { buildOpenApiDocument } from './docs/openapi.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createDashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createProjectsRouter } from './modules/projects/projects.routes.js';
import { createTasksRouter } from './modules/tasks/tasks.routes.js';

/** Content Security Policy that lets Swagger UI load its own scripts and styles; used only under /api/docs. */
const docsSecurityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:'],
      'upgrade-insecure-requests': null,
    },
  },
});

/** Mounts every API router under /api. */
export function createApiRouter(deps: AppDeps): Router {
  const router = Router();
  const openApiDocument = buildOpenApiDocument();

  router.use('/auth', createAuthRouter(deps));
  router.use('/projects', createProjectsRouter(deps));
  router.use('/tasks', createTasksRouter(deps));
  router.use('/dashboard', createDashboardRouter(deps));
  router.use('/health', createHealthRouter(deps));

  router.get('/docs.json', (_req, res) => {
    res.json(openApiDocument);
  });
  router.use('/docs', docsSecurityHeaders, swaggerUi.serve, swaggerUi.setup(openApiDocument));

  return router;
}
