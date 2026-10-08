import { idParamSchema, projectCreateBodySchema, projectListQuerySchema, projectUpdateBodySchema } from '@pm/shared';
import { Router } from 'express';
import type { AppDeps } from '../../app.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createProjectsController } from './projects.controller.js';

export function createProjectsRouter({ config, prisma }: AppDeps): Router {
  const router = Router();
  const controller = createProjectsController(prisma);

  router.use(authenticate(prisma, config.jwtSecret));

  router.get('/', validate({ query: projectListQuerySchema }), controller.list);
  router.get('/:id', validate({ params: idParamSchema }), controller.get);
  router.post('/', validate({ body: projectCreateBodySchema }), controller.create);
  router.put('/:id', validate({ params: idParamSchema, body: projectUpdateBodySchema }), controller.update);
  router.delete('/:id', validate({ params: idParamSchema }), controller.remove);

  return router;
}
