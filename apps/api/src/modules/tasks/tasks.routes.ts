import { idParamSchema, taskCreateBodySchema, taskListQuerySchema, taskUpdateBodySchema } from '@pm/shared';
import { Router } from 'express';
import type { AppDeps } from '../../app.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { createTasksController } from './tasks.controller.js';

export function createTasksRouter({ config, prisma }: AppDeps): Router {
  const router = Router();
  const controller = createTasksController(prisma);

  router.use(authenticate(prisma, config.jwtSecret));

  router.get('/', validate({ query: taskListQuerySchema }), controller.list);
  router.get('/:id', validate({ params: idParamSchema }), controller.get);
  router.post('/', validate({ body: taskCreateBodySchema }), controller.create);
  router.put(
    '/:id',
    validate(
      { params: idParamSchema, body: taskUpdateBodySchema },
      { forbiddenFieldMessages: { projectId: 'Project cannot be changed.' } },
    ),
    controller.update,
  );
  router.delete('/:id', validate({ params: idParamSchema }), controller.remove);

  return router;
}
