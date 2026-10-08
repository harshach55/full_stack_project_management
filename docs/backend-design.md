# Backend Design

Implementation blueprint for `apps/api`. It describes how the Express application realizes [api-contract.md](api-contract.md) within the structure set by [architecture.md](architecture.md) and ADR-0002. Phase 5 implements it; this document contains no code.

## 1. Module structure

```
apps/api/
  prisma/
    schema.prisma               from database-design.md (Phase 5)
    migrations/
    seed.ts                     test/demo data only
  src/
    config/
      env.ts                    environment schema and parsed config object
    lib/
      prisma.ts                 single Prisma client (pg adapter)
      logger.ts                 pino instance with redaction
      jwt.ts                    signToken, verifyToken
      password.ts               hashPassword, verifyPassword, dummy hash
      errors.ts                 AppError and helpers (notFound, unauthenticated, ...)
      dates.ts                  YYYY-MM-DD <-> DATE conversion
      search.ts                 escaping of search terms for ILIKE
    middleware/
      request-id.ts
      origin-check.ts
      authenticate.ts
      validate.ts
      rate-limit.ts
      not-found.ts
      error-handler.ts
    modules/
      auth/        auth.routes.ts, auth.controller.ts, auth.service.ts, auth.cookies.ts, user.mapper.ts
      projects/    projects.routes.ts, projects.controller.ts, projects.service.ts, project.mapper.ts
      tasks/       tasks.routes.ts, tasks.controller.ts, tasks.service.ts, task.mapper.ts
      dashboard/   dashboard.routes.ts, dashboard.controller.ts, dashboard.service.ts
      health/      health.routes.ts, health.controller.ts
      tokens/      revoked-tokens.service.ts (revocation lookup, insert, cleanup)
    docs/
      openapi.ts                OpenAPI document built from shared schemas (Phase 5)
    routes.ts                   mounts module routers under /api
    app.ts                      createApp(deps): Express app, no listening
    server.ts                   process entry: config, createApp, listen, shutdown
  tests/
```

Request/response schemas, enums, error codes and field limits come from `packages/shared` (ADR-0008); the API does not redefine them.

## 2. Responsibilities

| Layer | Does | Does not |
|---|---|---|
| Routes | Declare method, path and middleware chain (rate limit, authenticate, validate) and the controller | Contain logic |
| Controller | Read `req.auth.userId` and validated input; call one service function; choose status code; set/clear cookies (auth only); send mapped response | Access Prisma; make authorization decisions |
| Service | Business rules, ownership-scoped Prisma queries, mapping database errors that are expected (unique email, zero rows affected) to `AppError` | Read `req`/`res`; know about cookies or headers |
| Mapper | Convert a Prisma record to the API representation (dates to `YYYY-MM-DD`, timestamps to ISO strings, drop internal fields) | Query the database |
| Middleware | Cross-cutting concerns listed in section 4 | Business rules |
| `lib/` | Stateless helpers and singletons (Prisma, logger) | Express specifics |
| `config/` | Parse and validate environment once at startup | Read `process.env` anywhere else |

There is no repository layer: services call Prisma directly so that the ownership condition sits next to the business rule (ADR-0002).

Service function signatures take the caller's id first, for example `getProject(userId, projectId)`, `updateTask(userId, taskId, input)`. Registration and login are the only service functions without a `userId`.

## 3. Startup and shutdown

**Startup (`server.ts`)**
1. Parse environment with the config schema (`config/env.ts`). Any missing or invalid variable: log which one (never its value) and exit with code 1.
2. Create the logger and the Prisma client.
3. `createApp({ config, prisma, logger })` builds the Express app. Dependencies are passed in so tests can supply a test database and test configuration.
4. Listen on `PORT`.
5. Run revoked-token cleanup once (non-blocking; a failure is logged and does not stop startup), then every hour. Disabled when `NODE_ENV=test`.

The server does not run migrations (ADR-0011) and does not test the database connection before listening; `/api/health` reports database state.

**Graceful shutdown** on `SIGTERM` and `SIGINT` (Render sends `SIGTERM` on deploy and on sleep):
1. Stop accepting new connections (`server.close`).
2. Stop the cleanup interval.
3. Wait for in-flight requests to finish, at most 10 seconds.
4. Disconnect Prisma, flush logs, exit 0. If the timeout is reached, log it and exit 1.

## 4. Middleware order

Registered in `createApp` in this order:

| # | Middleware | Scope | Behavior |
|---|---|---|---|
| 1 | `trust proxy` setting | app | `TRUST_PROXY_HOPS` (1 on Render, 0 locally) |
| 2 | request id | global | Reuse a valid incoming `X-Request-Id` or generate a UUID; set response header |
| 3 | pino-http | global | One log line per request (section 9) |
| 4 | helmet | global | Default security headers; Content Security Policy relaxed only for `/api/docs` |
| 5 | CORS | global | Allowlist from `CORS_ALLOWED_ORIGINS`; contract section 9 |
| 6 | origin check | global | `POST`, `PUT`, `DELETE` only; contract section 9. Detects the session cookie from the raw `Cookie` header, since it runs before the cookie parser |
| 7 | JSON body parser | global | `application/json` only, 100 kb limit; malformed JSON -> `INVALID_JSON`, too large -> `PAYLOAD_TOO_LARGE`; body with other content type -> `UNSUPPORTED_MEDIA_TYPE` |
| 8 | cookie parser | global | Reads `pm_session` |
| 9 | routers (`/api/...`) | per route | Each route adds: rate limiter (auth routes), `authenticate` (protected routes), `validate` (all routes with input), controller |
| 10 | not-found | global | `ROUTE_NOT_FOUND` |
| 11 | error handler | global | Converts every error to the contract's error body |

The origin check runs before body parsing so that a rejected cross-origin request is not parsed. Rate limiters run after body parsing because the per-account login key needs the email.

Route table:

| Route | Rate limit | Authenticate | Validate |
|---|---|---|---|
| `POST /api/auth/register` | register per IP | no | body, `X-Client-Type` |
| `POST /api/auth/login` | login per account + per IP | no | body, `X-Client-Type` |
| `POST /api/auth/logout` | no | yes | empty body |
| `GET /api/auth/me` | no | yes | no input |
| `GET /api/projects` | no | yes | query |
| `GET /api/projects/:id` | no | yes | params |
| `POST /api/projects` | no | yes | body |
| `PUT /api/projects/:id` | no | yes | params, body |
| `DELETE /api/projects/:id` | no | yes | params |
| `GET /api/tasks` | no | yes | query |
| `GET /api/tasks/:id` | no | yes | params |
| `POST /api/tasks` | no | yes | body |
| `PUT /api/tasks/:id` | no | yes | params, body |
| `DELETE /api/tasks/:id` | no | yes | params |
| `GET /api/dashboard` | no | yes | query (empty) |
| `GET /api/health` | no | no | no input |
| `GET /api/docs`, `/api/docs.json` | no | no | no input |

## 5. Validation

- `validate({ body?, query?, params?, headers? })` takes shared Zod schemas, parses each part, and replaces it with the parsed (trimmed, normalized, typed) value. Controllers only read parsed values.
- All issues from all parts are collected into one `VALIDATION_ERROR` with `details` (`location`, `path`, `message`).
- Body schemas are strict objects; `PUT` schemas have every editable key required (nullable where optional); the task `PUT` schema has no `projectId` key, so sending it fails as an unknown key with the message "Project cannot be changed."
- Query schemas are strict; repeated parameters (arrays) fail.
- The rule `endDate >= startDate` is a refinement on the project body schemas.
- Rules needing the database (unique email, ownership) are not part of validation; services handle them.

Shared schema names (in `packages/shared`): `registerBody`, `loginBody`, `clientTypeHeader`, `projectCreateBody`, `projectUpdateBody`, `projectListQuery`, `taskCreateBody`, `taskUpdateBody`, `taskListQuery`, `idParam`, plus response types `UserResponse`, `AuthResponse`, `MobileAuthResponse`, `ProjectResponse`, `TaskResponse`, `DashboardResponse`, `ErrorResponse`.

## 6. Authentication

`authenticate` middleware, as specified in contract sections 2.3 and 2.4:

1. Pick the credential: `Authorization` header if present (must be `Bearer <token>`), else the `pm_session` cookie, else 401 `UNAUTHENTICATED`.
2. Verify with `jsonwebtoken`, `algorithms: ['HS256']`. `TokenExpiredError` -> `TOKEN_EXPIRED`; any other error -> `UNAUTHENTICATED`.
3. Check claims: `sub` and `jti` are UUIDs, `exp` present.
4. Revocation lookup by `jti` (primary key). Found -> `TOKEN_REVOKED`.
5. Set `req.auth = { userId: sub, jti, exp, method: 'bearer' | 'cookie' }`.

The middleware does not load the user row; only `GET /api/auth/me` does.

Auth service:
- `register(input)`: hash, insert, catch unique-violation on email -> `EMAIL_ALREADY_EXISTS`, issue token.
- `login(input)`: find by email, bcrypt compare (dummy hash when not found), issue token or `INVALID_CREDENTIALS`.
- `logout(auth)`: insert `jti` and `exp` into `revoked_tokens`, ignoring a conflict.
- `issueToken(userId)`: new UUID `jti`, sign with 7-day expiry, return `{ token, expiresAt }`.

Auth controller decides the response mode: `X-Client-Type: mobile` without `Origin` -> body with `token` and `expiresAt`; otherwise set the cookie and return `{ user }`. `X-Client-Type: mobile` with `Origin` is rejected with `ORIGIN_NOT_ALLOWED` before the service is called.

## 7. Authorization (ownership)

Rule:
- Project accessible if `project.ownerId = req.auth.userId`.
- Task accessible if `task.project.ownerId = req.auth.userId`.

No roles. Cross-user and missing resources are both 404.

Each service operation puts the rule into the Prisma query itself:

| Operation | Prisma approach |
|---|---|
| Get project | `findFirst({ where: { id, ownerId: userId } })`; `null` -> `NOT_FOUND` |
| List projects | `findMany({ where: { ownerId: userId, ...filters }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })` |
| Create project | `create({ data: { ...input, ownerId: userId } })` |
| Update project | `updateMany({ where: { id, ownerId: userId }, data })`; `count = 0` -> `NOT_FOUND`; then read the updated row by the same scoped condition. Both run in one transaction. |
| Delete project | `deleteMany({ where: { id, ownerId: userId } })`; `count = 0` -> `NOT_FOUND`. Tasks removed by the database cascade. |
| Get task | `findFirst({ where: { id, project: { ownerId: userId } } })` |
| List tasks | `findMany({ where: { project: { ownerId: userId }, ...filters } })`; with `projectId`, first `findFirst({ where: { id: projectId, ownerId: userId } })` -> `NOT_FOUND` if `null` |
| Create task | in one transaction: scoped project lookup (`NOT_FOUND` if `null`), then `create` with that `projectId` |
| Update task | `updateMany({ where: { id, project: { ownerId: userId } }, data })` (data never contains `projectId`); `count = 0` -> `NOT_FOUND`; then scoped read, in one transaction |
| Delete task | `deleteMany({ where: { id, project: { ownerId: userId } } })`; `count = 0` -> `NOT_FOUND` |
| Dashboard | `count` on projects with `ownerId`, `groupBy` on tasks by `status` with `project: { ownerId }` |

Never: fetching a row by id alone and comparing the owner in JavaScript before a separate write.

The exact Prisma calls are confirmed against the pinned Prisma 6 version in Phase 5 (for example, whether `updateMany` accepts the relation filter directly or needs the equivalent `projectId: { in: <caller's project ids> }` subquery form). The rule that ownership is part of the write's condition does not change.

## 8. Error handling

- `AppError(status, code, message, details?)` is the only error type that application code throws deliberately; helper functions create the common ones.
- Express 5 passes errors from async handlers to the error handler.
- Error handler mapping:

| Error | Result |
|---|---|
| `AppError` | its status, code, message, details |
| Zod error (from `validate`) | 400 `VALIDATION_ERROR` with details |
| body parser syntax error | 400 `INVALID_JSON` |
| body parser size error | 413 `PAYLOAD_TOO_LARGE` |
| unsupported content type | 415 `UNSUPPORTED_MEDIA_TYPE` |
| rate limiter | 429 `RATE_LIMITED` |
| Prisma unique violation not already handled | 500 (it should have been handled; logged as a bug) |
| anything else | 500 `INTERNAL_ERROR`, generic message |

- Every error response includes `requestId`.
- 5xx: logged at `error` with stack trace and request id. 4xx: logged at `info` (401, 403, 404, 409, 429) or `debug` (400) without stack traces.
- Messages from caught exceptions are never copied into responses.

## 9. Logging

- pino with JSON output in production; pretty output only when `NODE_ENV=development`; `silent` in tests unless `LOG_LEVEL` is set.
- pino-http request log: request id, method, path (without query string), status, response time, `userId` when authenticated.
- Redacted paths: `req.headers.authorization`, `req.headers.cookie`, `res.headers["set-cookie"]`, and any `password`, `passwordHash`, `token` keys. Request and response bodies are not logged.
- Health check requests are logged at `debug` only.
- Email addresses are not logged.

## 10. Rate limiting

`express-rate-limit` with the in-memory store (single instance), configured per contract section 10:
- `loginAccountLimiter`: key `ip + ':' + normalizedEmail`, counts failed requests only.
- `loginIpLimiter`: key `ip`.
- `registerIpLimiter`: key `ip`.
- Exceeding a limit produces 429 `RATE_LIMITED` through the error handler with `Retry-After`.
- Limits come from config; tests use low limits to check the behavior quickly.

## 11. CORS and origin check

- CORS: the `cors` middleware with a function that allows only exact matches from the allowlist, `credentials: true`, methods and headers per contract section 9.
- Origin check: custom middleware implementing the contract's table; it runs on every route for `POST`, `PUT`, `DELETE`.
- Both read the same parsed allowlist from config.

## 12. Configuration

Parsed once in `config/env.ts`:

| Variable | Required | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development`, `test`, `production` |
| `PORT` | no | `4000` | Render sets it |
| `DATABASE_URL` | yes | | runtime (pooler) |
| `JWT_SECRET` | yes | | at least 32 bytes |
| `JWT_EXPIRES_IN` | no | `7d` | |
| `CORS_ALLOWED_ORIGINS` | yes | | comma-separated exact origins |
| `COOKIE_SECURE` | no | `true` | `false` only for local HTTP |
| `TRUST_PROXY_HOPS` | no | `0` | `1` on Render |
| `RATE_LIMIT_WINDOW_MS` | no | `900000` | login window (15 minutes) |
| `RATE_LIMIT_LOGIN_ACCOUNT_MAX` | no | `5` | |
| `RATE_LIMIT_LOGIN_IP_MAX` | no | `50` | |
| `RATE_LIMIT_REGISTER_IP_MAX` | no | `10` | per hour |
| `LOG_LEVEL` | no | by environment | |

`DIRECT_URL` is used only by Prisma migration commands on the machine that runs them; the running API never reads it (ADR-0011). In production the config also rejects `COOKIE_SECURE=false`.

In production Render also sets `NODE_EXTRA_CA_CERTS=certs/prod-ca-2021.crt`. Node reads it at startup to trust the Supabase root CA; the app's config does not parse it. `DATABASE_URL` uses `sslmode=verify-full` (ADR-0007, [deployment.md](deployment.md)).

## 13. Health endpoint

Controller runs `prisma.$queryRaw` with `SELECT 1` under a 2-second timeout and returns the contract's 200 or 503 body. Errors are logged at `warn` without connection details.

## 14. Testing boundaries and test contract

| Level | What | How |
|---|---|---|
| Unit | Shared schemas; `lib/` helpers (dates, search escaping, jwt, password); mappers | Vitest, no database |
| Integration | Every endpoint through `createApp()` | Vitest + Supertest against the local Docker PostgreSQL; migrations applied before the run; tables truncated between test files |

Test helpers: create users through `POST /api/auth/register` (mobile mode for a token, web mode for a cookie); sign special tokens directly with the test secret (expired, wrong secret, wrong algorithm, missing claims).

Phase 5 must cover at least the list below. The Phase 9 mapping of each item to tests is in [testing.md](testing.md), section 3.

**Auth**
- register success (web mode sets cookie and returns no token; mobile mode returns token and sets no cookie)
- register validation: missing fields, invalid email, short password, password over 72 bytes, blank full name, unknown fields
- duplicate email, including different letter case: 409
- login success in both modes; wrong password and unknown email: same 401 body
- `X-Client-Type: mobile` with an `Origin` header: 403; invalid `X-Client-Type` value: 400
- `GET /api/auth/me` with valid cookie, valid Bearer, no credential, malformed header, wrong signature, `alg` other than HS256, expired token (`TOKEN_EXPIRED`), revoked token (`TOKEN_REVOKED`)
- Bearer precedence: invalid Bearer with a valid cookie is rejected
- logout: 204; same token afterwards 401 `TOKEN_REVOKED`; a second session of the same user still works; cookie cleared

**Projects**
- create with defaults; create with all fields; list newest first
- get, update (full `PUT`), delete
- partial `PUT` (each missing key): 400; server-owned fields in body: 400
- `endDate` before `startDate`: 400; invalid calendar date: 400; invalid status: 400
- search case-insensitive and partial; search with `%`/`_` matched literally; status filter; combined
- Bob reading, updating, deleting Alice's project: 404; Alice's list never contains Bob's projects
- delete cascades: the project's tasks are gone afterwards

**Tasks**
- create with defaults (`MEDIUM`, `PENDING`); create in Bob's project: 404; create with unknown `projectId`: 404
- list all tasks; list by own `projectId`; `projectId` of Bob's project: 404; unknown `projectId`: 404; empty result `[]`
- search, status filter, priority filter, combined with `projectId`
- full `PUT`; partial `PUT`: 400; `projectId` in `PUT` body (same or different value): 400; task keeps its project
- quick-action style `PUT` (only status changed) succeeds
- Bob reading, updating, deleting Alice's task: 404

**Dashboard**
- counts match seeded data for each field; `pendingTasks` excludes `IN_PROGRESS`
- two users with data: each sees only their own counts; new user sees zeros

**Security**
- every protected route without credentials: 401
- SQL-like strings in search and in names (`' OR 1=1 --`) stored and matched as plain text
- origin check: cookie request with foreign `Origin`: 403; cookie request without `Origin`: 403; Bearer request without `Origin`: allowed
- CORS: allowed origin gets CORS headers; other origins get none
- rate limits: login per account returns 429 after the limit; register per IP returns 429
- malformed JSON: 400 `INVALID_JSON`; oversized body: 413; wrong content type: 415
- error responses never contain stack traces; responses never contain `passwordHash`; logs never contain tokens, cookies or passwords
- unknown route: 404 `ROUTE_NOT_FOUND`
- health: 200 with database up

**Documentation**
- every route mounted in the app appears in `/api/docs.json`

## 15. Implementation checks

Results of the Phase 5 checks (none changed the contract):

- Prisma 6.19.3 with the engine-free client and `@prisma/adapter-pg` works on Node 24.11.1, including behind a transaction-mode pooler (local PgBouncer). The live Supabase connection and its TLS settings were verified in Phase 8 (ADR-0007).
- Node 24 compatibility with the backend packages is confirmed (ADR-0001); Next.js and Expo follow in Phases 6 and 7.
- Ownership-scoped writes work with relation filters (section 16).
- Validated in Phase 7 on a physical Android device (Expo Go): the React Native HTTP client sends no `Origin` header, which the mobile response mode relies on. All 160 captured app requests carried `X-Client-Type: mobile` and no `Origin` or cookie; protected routes carried the Bearer token.

## 16. Implementation notes (Phase 5)

Details where the implementation refines this design without changing the API contract:

- **Parsed input location.** Express 5 exposes `req.query` as a read-only getter, so the `validate` middleware stores parsed values in `req.valid.body`, `req.valid.query` and `req.valid.params` instead of replacing the originals. Controllers read only `req.valid`.
- **Ownership-scoped writes.** Instead of `updateMany`/`deleteMany` plus a follow-up read, services call Prisma's `update`/`delete` with the ownership condition in the `where` (`{ id, ownerId }` for projects, `{ id, project: { ownerId } }` for tasks). Prisma reports "no matching row" as error P2025, which becomes 404. This keeps ownership in the write itself and returns the updated row in one call.
- **Search escaping.** Prisma's `contains` does not escape `%` and `_`, so the API escapes them (and `\`) before querying (`lib/search.ts`); search terms match literally.
- **Task creation race.** If a project is deleted between the ownership check and the task insert, the foreign key error is mapped to 404 `NOT_FOUND`.
- **Revoked-token cleanup.** Not implemented yet (deferred by the Phase 5 instructions). Expired rows are harmless; the cleanup statement is in database-design.md section 14.
- **OpenAPI components.** Built with Zod's own `.meta({ id })` on the shared schemas, so the shared package contains no documentation-specific code.
- **Rate-limit headers.** Standard `RateLimit` headers (IETF draft 7) plus `Retry-After` on 429.
- **Origin `null`.** Treated like any origin that is not in the allowlist (403).
- **Health logging.** Health check requests are logged at `debug`.
