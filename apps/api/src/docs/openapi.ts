import { OpenApiGeneratorV3, OpenAPIRegistry, type RouteConfig } from '@asteasolutions/zod-to-openapi';
import {
  authResponseSchema,
  dashboardResponseSchema,
  errorResponseSchema,
  healthResponseSchema,
  idParamSchema,
  loginBodySchema,
  meResponseSchema,
  mobileAuthResponseSchema,
  projectCreateBodySchema,
  projectListQuerySchema,
  projectSchema,
  projectUpdateBodySchema,
  registerBodySchema,
  SESSION_COOKIE_NAME,
  taskCreateBodySchema,
  taskListQuerySchema,
  taskSchema,
  taskUpdateBodySchema,
  userSchema,
} from '@pm/shared';
import { z } from 'zod';

/*
 * The OpenAPI document is built from the same shared Zod schemas the API uses for
 * validation, so the documentation cannot drift from the real rules (ADR-0006).
 * Named components use Zod's own metadata (.meta({ id })), so the shared package
 * needs no documentation-specific code.
 */

const UserSchema = userSchema.meta({ id: 'User' });
const ProjectSchema = projectSchema.meta({ id: 'Project' });
const TaskSchema = taskSchema.meta({ id: 'Task' });
const DashboardSchema = dashboardResponseSchema.meta({ id: 'Dashboard' });
const ErrorSchema = errorResponseSchema.meta({ id: 'Error' });
const AuthResponseSchema = authResponseSchema.extend({ user: UserSchema }).meta({ id: 'AuthResponse' });
const MobileAuthResponseSchema = mobileAuthResponseSchema.extend({ user: UserSchema }).meta({ id: 'MobileAuthResponse' });
const MeResponseSchema = meResponseSchema.extend({ user: UserSchema }).meta({ id: 'MeResponse' });

type Responses = RouteConfig['responses'];

const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });

const errorResponse = (description: string) => ({ description, ...json(ErrorSchema) });

const authenticated: Record<string, string[]>[] = [{ cookieAuth: [] }, { bearerAuth: [] }];

const commonAuthErrors: Responses = {
  401: errorResponse('Not authenticated: UNAUTHENTICATED, TOKEN_EXPIRED or TOKEN_REVOKED.'),
};

const stateChangingErrors: Responses = {
  403: errorResponse('ORIGIN_NOT_ALLOWED: the request origin is not allowed.'),
  415: errorResponse('UNSUPPORTED_MEDIA_TYPE: the body is not JSON.'),
};

const clientTypeHeaders = z.object({
  'x-client-type': z
    .enum(['mobile'])
    .optional()
    .describe('Send "mobile" (without an Origin header) to receive the token in the response body instead of a cookie.'),
});

export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry();

  registry.registerComponent('securitySchemes', 'cookieAuth', {
    type: 'apiKey',
    in: 'cookie',
    name: SESSION_COOKIE_NAME,
    description: 'Web session cookie (httpOnly), set by login/register.',
  });
  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Mobile access token from login/register with X-Client-Type: mobile.',
  });

  // Auth
  for (const [path, schema, status, summary] of [
    ['/api/auth/register', registerBodySchema, 201, 'Register a new account and log in'],
    ['/api/auth/login', loginBodySchema, 200, 'Log in'],
  ] as const) {
    registry.registerPath({
      method: 'post',
      path,
      tags: ['Auth'],
      summary,
      description:
        'Web clients receive the session in an httpOnly cookie and only the user in the body. ' +
        'Mobile clients send X-Client-Type: mobile (and no Origin header) and receive the token in the body.',
      request: { headers: clientTypeHeaders, body: { required: true, ...json(schema) } },
      responses: {
        [status]: {
          description: 'Logged in. Body is AuthResponse (web) or MobileAuthResponse (mobile).',
          content: { 'application/json': { schema: z.union([AuthResponseSchema, MobileAuthResponseSchema]) } },
        },
        400: errorResponse('VALIDATION_ERROR or INVALID_JSON.'),
        ...(path === '/api/auth/login' ? { 401: errorResponse('INVALID_CREDENTIALS.') } : {}),
        ...(path === '/api/auth/register' ? { 409: errorResponse('EMAIL_ALREADY_EXISTS.') } : {}),
        ...stateChangingErrors,
        429: errorResponse('RATE_LIMITED.'),
      },
    });
  }

  registry.registerPath({
    method: 'post',
    path: '/api/auth/logout',
    tags: ['Auth'],
    summary: 'Log out the current session only',
    security: authenticated,
    responses: { 204: { description: 'Token revoked; the web cookie is cleared.' }, ...commonAuthErrors, ...stateChangingErrors },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/auth/me',
    tags: ['Auth'],
    summary: 'Get the current user',
    security: authenticated,
    responses: { 200: { description: 'Current user.', ...json(MeResponseSchema) }, ...commonAuthErrors },
  });

  // Projects
  registry.registerPath({
    method: 'get',
    path: '/api/projects',
    tags: ['Projects'],
    summary: "List the caller's projects (newest first)",
    security: authenticated,
    request: { query: projectListQuerySchema },
    responses: {
      200: { description: 'Projects; empty array when none match.', ...json(z.array(ProjectSchema)) },
      400: errorResponse('VALIDATION_ERROR.'),
      ...commonAuthErrors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/projects',
    tags: ['Projects'],
    summary: 'Create a project',
    security: authenticated,
    request: { body: { required: true, ...json(projectCreateBodySchema) } },
    responses: {
      201: { description: 'Created project.', ...json(ProjectSchema) },
      400: errorResponse('VALIDATION_ERROR or INVALID_JSON.'),
      ...commonAuthErrors,
      ...stateChangingErrors,
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/projects/{id}',
    tags: ['Projects'],
    summary: 'Get a project',
    security: authenticated,
    request: { params: idParamSchema },
    responses: {
      200: { description: 'Project.', ...json(ProjectSchema) },
      400: errorResponse('VALIDATION_ERROR (invalid id).'),
      ...commonAuthErrors,
      404: errorResponse('NOT_FOUND: missing or owned by another user.'),
    },
  });
  registry.registerPath({
    method: 'put',
    path: '/api/projects/{id}',
    tags: ['Projects'],
    summary: 'Replace a project (all editable fields required)',
    security: authenticated,
    request: { params: idParamSchema, body: { required: true, ...json(projectUpdateBodySchema) } },
    responses: {
      200: { description: 'Updated project.', ...json(ProjectSchema) },
      400: errorResponse('VALIDATION_ERROR (including partial bodies) or INVALID_JSON.'),
      ...commonAuthErrors,
      ...stateChangingErrors,
      404: errorResponse('NOT_FOUND: missing or owned by another user.'),
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/projects/{id}',
    tags: ['Projects'],
    summary: 'Delete a project and its tasks',
    security: authenticated,
    request: { params: idParamSchema },
    responses: {
      204: { description: 'Deleted.' },
      400: errorResponse('VALIDATION_ERROR (invalid id).'),
      ...commonAuthErrors,
      ...stateChangingErrors,
      404: errorResponse('NOT_FOUND: missing or owned by another user.'),
    },
  });

  // Tasks
  registry.registerPath({
    method: 'get',
    path: '/api/tasks',
    tags: ['Tasks'],
    summary: "List the caller's tasks (newest first)",
    description: 'Without projectId: all tasks in all of the caller\'s projects. With projectId: 404 if the project is missing or another user\'s.',
    security: authenticated,
    request: { query: taskListQuerySchema },
    responses: {
      200: { description: 'Tasks; empty array when none match.', ...json(z.array(TaskSchema)) },
      400: errorResponse('VALIDATION_ERROR.'),
      ...commonAuthErrors,
      404: errorResponse('NOT_FOUND: projectId is missing or owned by another user.'),
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/tasks',
    tags: ['Tasks'],
    summary: "Create a task in one of the caller's projects",
    security: authenticated,
    request: { body: { required: true, ...json(taskCreateBodySchema) } },
    responses: {
      201: { description: 'Created task.', ...json(TaskSchema) },
      400: errorResponse('VALIDATION_ERROR or INVALID_JSON.'),
      ...commonAuthErrors,
      ...stateChangingErrors,
      404: errorResponse('NOT_FOUND: the project is missing or owned by another user.'),
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/tasks/{id}',
    tags: ['Tasks'],
    summary: 'Get a task',
    security: authenticated,
    request: { params: idParamSchema },
    responses: {
      200: { description: 'Task.', ...json(TaskSchema) },
      400: errorResponse('VALIDATION_ERROR (invalid id).'),
      ...commonAuthErrors,
      404: errorResponse('NOT_FOUND: missing or in another user\'s project.'),
    },
  });
  registry.registerPath({
    method: 'put',
    path: '/api/tasks/{id}',
    tags: ['Tasks'],
    summary: 'Replace a task (all five editable fields required, projectId not allowed)',
    security: authenticated,
    request: { params: idParamSchema, body: { required: true, ...json(taskUpdateBodySchema) } },
    responses: {
      200: { description: 'Updated task.', ...json(TaskSchema) },
      400: errorResponse('VALIDATION_ERROR (partial body or projectId present) or INVALID_JSON.'),
      ...commonAuthErrors,
      ...stateChangingErrors,
      404: errorResponse('NOT_FOUND: missing or in another user\'s project.'),
    },
  });
  registry.registerPath({
    method: 'delete',
    path: '/api/tasks/{id}',
    tags: ['Tasks'],
    summary: 'Delete a task',
    security: authenticated,
    request: { params: idParamSchema },
    responses: {
      204: { description: 'Deleted.' },
      400: errorResponse('VALIDATION_ERROR (invalid id).'),
      ...commonAuthErrors,
      ...stateChangingErrors,
      404: errorResponse('NOT_FOUND: missing or in another user\'s project.'),
    },
  });

  // Dashboard and health
  registry.registerPath({
    method: 'get',
    path: '/api/dashboard',
    tags: ['Dashboard'],
    summary: "Statistics for the caller's projects and tasks",
    security: authenticated,
    responses: { 200: { description: 'Counts.', ...json(DashboardSchema) }, ...commonAuthErrors },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/health',
    tags: ['Health'],
    summary: 'Service and database availability',
    responses: {
      200: { description: 'Service and database available.', ...json(healthResponseSchema) },
      503: { description: 'Database unavailable.', ...json(healthResponseSchema) },
    },
  });

  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Project Management API',
      version: '1.0.0',
      description: 'REST API shared by the web and Android clients. Error bodies use the Error schema with a stable code.',
    },
  });
}
