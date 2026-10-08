# Testing

How the system is tested, what the tests cover, and the evidence collected for the parts that automated tests cannot reach. The security review is in [security-audit.md](security-audit.md). Requirement-level status is in [traceability-matrix.md](traceability-matrix.md).

Results recorded in Phase 9 (2026-10-09), commit base `8685396` plus the Phase 9 test additions.

## 1. Test suites

| Package | Tool | Files | Tests | Result |
|---|---|---|---|---|
| `apps/api` | Vitest + Supertest, real PostgreSQL | 6 | 146 | 146 passed |
| `apps/web` | Vitest + Testing Library (jsdom) | 5 | 48 | 48 passed |
| `apps/mobile` | Vitest (Node, pure modules) | 3 | 33 | 33 passed |
| `packages/shared` | Vitest | 1 | 18 | 18 passed |
| **Total** | | **15** | **245** | **245 passed** |

API test files:

| File | Tests | Area |
|---|---|---|
| [`auth.test.ts`](../apps/api/tests/auth.test.ts) | 35 | Register, login, `me`, logout, response modes, token verification, revocation |
| [`projects.test.ts`](../apps/api/tests/projects.test.ts) | 33 | Project CRUD, validation, search and filter, full `PUT`, isolation, cascade, database constraints |
| [`tasks.test.ts`](../apps/api/tests/tasks.test.ts) | 28 | Task CRUD, list, search and filters, full `PUT`, `projectId` immutability, isolation, cascade |
| [`dashboard.test.ts`](../apps/api/tests/dashboard.test.ts) | 5 | Counts per user, isolation, zeros, pending versus in progress |
| [`security.test.ts`](../apps/api/tests/security.test.ts) | 35 | Protected routes, origin check, CORS, input handling, headers, rate limits, leaks, logs, health, docs |
| [`unit.test.ts`](../apps/api/tests/unit.test.ts) | 10 | Configuration, dates, LIKE escaping, tokens, logger redaction |

Web: [`api-client`](../apps/web/tests/api-client.test.ts) (7), [`auth`](../apps/web/tests/auth.test.tsx) (15), [`dashboard`](../apps/web/tests/dashboard.test.tsx) (2), [`projects`](../apps/web/tests/projects.test.tsx) (10), [`tasks`](../apps/web/tests/tasks.test.tsx) (14). Mobile: [`api-client`](../apps/mobile/tests/api-client.test.ts) (11), [`endpoints`](../apps/mobile/tests/endpoints.test.ts) (8), [`session`](../apps/mobile/tests/session.test.ts) (14). Shared: [`schemas`](../packages/shared/test/schemas.test.ts) (18).

## 2. Running the tests

From the repository root, with the local Docker PostgreSQL running (`pnpm db:up`) and `TEST_DATABASE_URL` set (see [apps/api/README.md](../apps/api/README.md), section "Tests"):

```bash
pnpm test                                # all packages
pnpm --filter @pm/api test               # API only
pnpm --filter @pm/api test:coverage      # API with coverage
pnpm typecheck
pnpm --filter @pm/api docs:openapi:check # docs/openapi.json matches the generated OpenAPI document
```

The API suite applies all migrations to the test database first, truncates tables between files and generates its own JWT signing key. Files run one at a time because they share the database.

### Test database safety

Tests can never reach a deployed database:

- The suite reads only `TEST_DATABASE_URL` (and optionally `TEST_DIRECT_DATABASE_URL`), never `DATABASE_URL`.
- Both must point to `localhost`, `127.0.0.1` or `::1` and to a database whose name ends in `_test`; otherwise the run stops before connecting ([`test-database.ts`](../apps/api/tests/support/test-database.ts)).
- The pre-test migration step overrides `DATABASE_URL` and `DIRECT_URL` with those validated values ([`global-setup.ts`](../apps/api/tests/support/global-setup.ts)).
- Production connection settings live only in `apps/api/.env.production`, which the test configuration never reads.

## 3. What the API tests cover

Every item of the test contract in [backend-design.md](backend-design.md), section 14, and of the security test set in [architecture.md](architecture.md), section 23, maps to at least one named test:

| Contract area | Covered by |
|---|---|
| Register: both response modes; missing fields; invalid email; short password; password over 72 bytes (also multi-byte); blank or long full name; unknown and server-owned fields; duplicate email in any case | `auth.test.ts` |
| Login in both modes; identical 401 for wrong password and unknown email; `X-Client-Type: mobile` with `Origin` (403); invalid `X-Client-Type` (400) | `auth.test.ts` |
| `GET /api/auth/me` with cookie and Bearer; missing, malformed, unsigned (`alg: none`), wrong-secret, wrong-algorithm, missing-claims and expired tokens; Bearer precedence over a valid cookie | `auth.test.ts` |
| Logout: revokes only the current token; the other session keeps working; cookie cleared; repeated logout returns `TOKEN_REVOKED` | `auth.test.ts` |
| Projects: defaults, all fields, newest first, empty list, validation table (dates, status, lengths, `ownerId`, `id`, `createdAt`), malformed and unknown ids, search (partial, case-insensitive, `%` and `_` literal), status filter, full and partial `PUT`, server-owned fields on `PUT`, isolation, cascade | `projects.test.ts` |
| Tasks: defaults, foreign or unknown project (404), list all, by own project, foreign or unknown `projectId` (404), empty `[]`, search (including SQL-like text, `%` and `_`), status and priority filters with `projectId`, full and partial `PUT`, `projectId` in `PUT` (same or different value), quick action, isolation, cascade | `tasks.test.ts` |
| Dashboard: every count, `pendingTasks` excludes `IN_PROGRESS`, two users with data, new user sees zeros | `dashboard.test.ts` |
| Security: all 13 protected routes return 401; SQL-like names and searches stored and matched as plain text; origin check (foreign, missing, allowed origin; Bearer without `Origin`); CORS allowlist; login per account and per IP and register per IP return 429; `INVALID_JSON`, 413, 415; security headers; no password hash in responses; generic 500 without internals; no tokens, cookies or passwords in logs; `ROUTE_NOT_FOUND`; health; every route in `/api/docs.json` | `security.test.ts`, `unit.test.ts` |
| Database rules enforced without the API (date order, blank names, lowercase email, owner delete restricted) | `projects.test.ts` |

### Tests added in Phase 9

The Phase 9 audit found three gaps in depth (not defects). Each is now covered:

1. **Logger redaction** ([`unit.test.ts`](../apps/api/tests/unit.test.ts), "logger redaction"): a logger with the production `REDACT_PATHS` removes the `Authorization` and `Cookie` request headers, `Set-Cookie`, `password`, `passwordHash`, `token`, `jwtSecret` and `databaseUrl`, and keeps non-secret fields; the path list is pinned; `createLogger` applies the configured level in production. A copy of the test with redaction turned off fails, so the test detects a leak.
2. **Task search with SQL-like text, `%` and `_`** ([`tasks.test.ts`](../apps/api/tests/tasks.test.ts)): `%` and `_` match only themselves; another user's matching task is never returned; `' OR 1=1 --` matches nothing; the stored name `Robert'); DROP TABLE tasks; --` is found by a literal search for part of it and for all of it; the task count is unchanged.
3. **Project `PUT` with server-owned fields** ([`projects.test.ts`](../apps/api/tests/projects.test.ts)): `ownerId`, `id` and `createdAt` each return 400 naming the field, and the stored project is unchanged.

## 4. Coverage

API coverage (`pnpm --filter @pm/api test:coverage`, V8, `src/` without `server.ts` and type files):

| Metric | Coverage |
|---|---|
| Statements | 95.95% (474/494) |
| Branches | 85.85% (176/205) |
| Functions | 97.77% (132/135) |
| Lines | 97.08% (433/446) |

No threshold is enforced. The uncovered parts are defensive or hard-to-trigger branches: the foreign-key race when a project is deleted during task creation, rethrows of unexpected database errors in the auth, project and task services, the 415 path for an unsupported charset, the "at least one origin" configuration error, the health-check timeout reason, edge branches in the rate-limit key helper, and the development-only pretty-print branch of the logger.

## 5. Web and mobile automated tests

- **Web:** the API client calls only the same-origin `/api` path with the cookie and never a Bearer token; forms apply the shared validation and show server field errors; login, register, logout, session-expired message, protected-area gate and retry; project and task lists send search and filters to the API, distinguish empty states, confirm before delete, and send full `PUT` bodies without `projectId`.
- **Mobile:** the API client sends `X-Client-Type: mobile` and the Bearer token, never cookies or the token in a URL; network errors and timeouts are reported without the token; session start, login, register and logout store or delete the SecureStore token as specified; `TOKEN_EXPIRED`, `TOKEN_REVOKED` and `UNAUTHENTICATED` delete the token and report expiry; task updates send exactly the five editable fields.

## 6. Manual and deployed verification

Automated tests run against a local database. These checks cover the real browser, the physical device and the production deployment.

| When | What was verified |
|---|---|
| Phase 6, local | `next start` with the `/api` rewrite: session cookie host-only on the web origin with `HttpOnly; SameSite=Lax`; `Origin`, methods and JSON bodies reach the API unchanged; a foreign `Origin` gets 403 (ADR-0004). |
| Phase 7, physical Android phone (Expo Go) against the local API | Login, dashboard, project and task flows, SecureStore session restore, offline message with retry, revoked token leading to the login screen with the session-expired message, and web/mobile sync. A logging proxy captured 160 app requests: all carried `X-Client-Type: mobile`, protected routes carried the Bearer token, and none carried `Origin` or a cookie ([backend-design.md](backend-design.md), section 15). |
| Phase 8, production API (51 checks) | Health, HTTPS redirect, HSTS, docs, safe errors, CORS allowlist, foreign `Origin` rejected, register, login, `me`, project and task CRUD, dashboard, two-user isolation (404), logout, revoked and tampered tokens ([deployment.md](deployment.md), section 9). |
| Phase 8, production web through the Vercel rewrite (31 checks) and real Chrome (14 checks) | Rewrite forwards `Origin` and `Set-Cookie` unchanged; cookie `pm_session` stored for the Vercel host only with `HttpOnly; Secure; SameSite=Lax; Path=/`; not readable by `document.cookie`; no token in web storage; the browser never contacts the API host; CRUD, dashboard, logout; client bundles contain no secrets. Rerun after the function region change: all passed. |
| Phase 9, production web at 360x800 (phone emulation), 768x1024 and 1280x800 in Chrome | WEB-02. Empty state: login, register, dashboard, projects list, new project form, tasks list with filters, new task form, project not-found state and the main navigation, 27 of 27 passed. Populated state, with one temporary project and task whose names are 118 and 117 characters long each including an unbroken hyphenated token of 87 or 88 characters: projects list, project detail with its task, project edit form, task list with quick actions, task detail, task edit form and dashboard, 21 of 21 passed. On every page the document width equals the viewport (no horizontal scrolling), no element extends past the viewport, no controls overlap, no button or field is smaller than 32 pixels, the smallest text is 12 pixels, and long names wrap without being cut. The only hidden text is three intentional screen-reader-only labels. The temporary records were deleted and the session logged out afterwards. |
| Phase 8, physical Android phone against the production API | App start, register, dashboard, project and task create, read and update, session restore after restart, logout and login, offline message in airplane mode, cleanup; changes appear on the web app and the other way round. |
| Phase 10, release APK on a physical Android phone against the production API | EAS build `8ea20e9b-2d0d-4973-a703-b42e124cc25c` installed from its link: app launch, login, dashboard, project creation, task creation, task status and priority changes, task search and filters, changes visible on the web app with the same account and the other way round, web logout leaving the phone signed in, phone logout, offline message in airplane mode; 11 of 11 passed. The APK bundle contains the HTTPS production API address and no LAN address ([deployment.md](deployment.md), section 7). |
| Phase 11, exported OpenAPI document | [`openapi.json`](openapi.json) written by `docs:openapi` from the API's own `buildOpenApiDocument()`: generated twice with the same SHA-256, identical to the production `/api/docs.json`, valid OpenAPI 3.0.3 (checked with swagger-parser outside the repository), 16 operations matching the route list in `security.test.ts`. `docs:openapi:check` also passes on a fresh clone. |

### Main flows (F1 to F8)

| Flow ([user-flows.md](user-flows.md)) | Evidence |
|---|---|
| F1 Register and start | Web tests (`auth`); Phase 8 production web and phone |
| F2 Login and logout | Web tests (`auth`); Phase 8 Chrome run; Phase 7 and 8 phone |
| F3 Manage projects (web) | Web tests (`projects`, including the delete confirmation that warns about tasks); Phase 8 production CRUD |
| F4 Manage tasks | Web tests (`tasks`); mobile tests (`endpoints`); Phase 7 and 8 phone |
| F5 Search and filter | Web tests (filters sent to the API, reset); mobile tests (task list query parameters); API tests; Phase 8 production web search |
| F6 Cross-platform sync | Phase 7 and Phase 8 phone with the web app |
| F7 Session expiry (mobile) | Mobile tests (`session`); Phase 7 phone with a revoked token |
| F8 No network (mobile) | Mobile tests (`api-client`, `session`); Phase 7 and 8 phone in airplane mode |

## 7. Non-functional requirements review

Review against [requirements.md](requirements.md) in Phase 9. "Later phase" items are part of the release, documentation and submission phases.

| Req | Status | Evidence |
|---|---|---|
| API-01, API-02 | verified | Express and TypeScript; feature modules with routes, controllers and services (ADR-0002) |
| API-03 | verified | Central error handler; one error shape; generic 500 test; production checks |
| API-04 | verified | pino-http logs method, path, status and response time; secrets redacted ([security-audit.md](security-audit.md), section 5) |
| API-05 | verified | CORS allowlist tests; production CORS checks |
| API-06 | verified | Validation tests on body, params and query with field errors |
| API-07 | verified | Swagger UI and `/api/docs.json` tests; served in production |
| DB-01 | verified | Only the API connects; Supabase Data API disabled (dashboard) |
| DB-02 to DB-05 | verified | Constraint and cascade tests; production catalog identical to the migration (Phase 8) |
| WEB-01, WEB-03 to WEB-08 | verified | Web tests; Phase 8 HTTP and Chrome checks (protected-page redirect, session handling, CRUD, dashboard, search) |
| WEB-02 (responsive) | verified | Phase 9 viewport check in production at 360, 768 and 1280 pixels (section 6) |
| MOB-02 to MOB-11 | verified | Mobile tests; Phase 7 and Phase 8 device checks |
| MOB-01, MOB-12 | verified | Phase 10 release APK (EAS build `8ea20e9b`) installed and run on a physical Android phone; its bundle uses the HTTPS production API set in the EAS profile (section 6) |
| SYNC-01, SYNC-02 | verified | One API and database (Phase 8); sync on device |
| DOC-02 to DOC-04 | verified | App READMEs, `.env.example` templates, [database-design.md](database-design.md), [deployment.md](deployment.md) |
| DOC-01 | verified | Root [README](../README.md) with setup for API, web and mobile, linking each app README (Phase 11); install, shared build and Prisma client generation rechecked on a fresh clone in Phase 11; the apps were run locally in Phases 5 to 7 |
| SUB-02, SUB-04 | verified | ER diagram in [database-design.md](database-design.md); URLs in [deployment.md](deployment.md) |
| SUB-03 | verified | Swagger UI and OpenAPI JSON served in production; exported file [`openapi.json`](openapi.json) identical to the served document (section 6) |
| SUB-05 | verified | APK link and SHA-256 in [deployment.md](deployment.md), section 7 |
| SUB-01, SUB-06 | later phase | Repository visibility and screen recording are part of submission |
