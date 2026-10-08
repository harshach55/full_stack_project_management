# Security Audit

Phase 9 review of the security design ([ADR-0010](decisions/0010-security-architecture.md)) against the implementation, the tests and the deployed system. Test details are in [testing.md](testing.md); production evidence is in [deployment.md](deployment.md), section 9.

- Date: 2026-10-09
- Scope: `apps/api` source and tests, web and mobile clients (secret exposure, token handling), dependencies (`pnpm audit`), the Phase 8 production evidence.
- Method: read-only code review, mapping of every measure to tests, full test run with coverage, dependency audit. Rate-limit and other attack-style tests were run only against the local test database, never against production.

## 1. Summary

- **No defects found** in application code. No application code was changed in Phase 9.
- **Three test gaps closed** (logger redaction, task search with SQL-like text and wildcards, project `PUT` with server-owned fields); see [testing.md](testing.md), section 3.
- **Dependencies:** five advisories (three high, two moderate), none in the API or web runtime. Accepted and documented without upgrades (section 7).
- **Known risks** documented and accepted: the registration rate limit shared through Vercel's egress addresses, the depth limit of the log redaction backstop, and in-memory rate limits (section 8).

## 2. ADR-0010 measures

| Area | Implementation | Tests and evidence | Result |
|---|---|---|---|
| Passwords | bcryptjs cost 12 ([`password.ts`](../apps/api/src/lib/password.ts)); 8 to 72 bytes (shared schema); responses built by [`user.mapper.ts`](../apps/api/src/modules/auth/user.mapper.ts) with four public fields; unknown emails compared against a dummy hash so timing does not reveal accounts | `auth.test.ts` (length rules, same 401 for unknown email); `security.test.ts` (no hash in responses) | Pass |
| Tokens | HS256 signed and verified with the algorithm pinned; claims validated (`sub`, `jti`, `exp`); 7-day lifetime; `jti` revocation checked on every request ([`jwt.ts`](../apps/api/src/lib/jwt.ts), [`authenticate.ts`](../apps/api/src/middleware/authenticate.ts)); `JWT_SECRET` at least 32 bytes ([`env.ts`](../apps/api/src/config/env.ts)) | `auth.test.ts` (wrong secret, other algorithm, `alg: none`, missing claims, expired, revoked) | Pass |
| Authorization | Owner condition inside every project and task query; owner always from the token (section 3) | Isolation tests in `projects`, `tasks`, `dashboard`; production two-user checks | Pass |
| Validation | Shared strict Zod schemas on body, params and query ([`validate.ts`](../apps/api/src/middleware/validate.ts)); 100 kb JSON limit | Validation tables in `auth`, `projects`, `tasks`; 413 test | Pass |
| Injection | Prisma query API only. The only raw queries are the health check's `SELECT 1` and the test helper's `TRUNCATE`, both parameterized tagged templates; no SQL built from strings | SQL-like names and searches in `security` and `tasks` | Pass |
| CSRF | `SameSite=Lax` cookie plus origin check for `POST`, `PUT`, `DELETE` ([`origin-check.ts`](../apps/api/src/middleware/origin-check.ts)) | `security.test.ts` (foreign, missing and allowed origin; login CSRF); production checks through the rewrite | Pass |
| CORS | Exact allowlist from `CORS_ALLOWED_ORIGINS`; credentials only for listed origins; never `*` ([`app.ts`](../apps/api/src/app.ts)) | `security.test.ts`; production preflight checks | Pass |
| Headers | helmet globally; relaxed Content Security Policy only on `/api/docs` ([`routes.ts`](../apps/api/src/routes.ts)) | `security.test.ts` (headers, Swagger UI); production HSTS | Pass |
| Rate limiting | Login per IP + email (failed attempts only) and per IP; register per IP ([`rate-limit.ts`](../apps/api/src/middleware/rate-limit.ts), wired in [`auth.routes.ts`](../apps/api/src/modules/auth/auth.routes.ts)) | `security.test.ts` (all three limiters return 429; `Retry-After` checked) | Pass; see section 8 for the shared registration limit |
| Proxy awareness | `trust proxy` set to the number `TRUST_PROXY_HOPS` (1 on Render), never `true` | Configuration review; [deployment.md](deployment.md), section 5 | Pass |
| Web token | Token only in the `pm_session` cookie, never in a web response body ([`auth.controller.ts`](../apps/api/src/modules/auth/auth.controller.ts)) | `auth.test.ts`; Phase 8 Chrome run (cookie not readable by `document.cookie`, nothing in web storage) | Pass |
| Mobile token | SecureStore only ([`token-storage.ts`](../apps/mobile/src/lib/token-storage.ts)); mobile response mode refused when `Origin` is present ([`client-type.ts`](../apps/api/src/middleware/client-type.ts)) | `auth.test.ts`; mobile `session` tests; Phase 7 device capture (no `Origin`, no cookie) | Pass |
| Logging | No request bodies or headers logged (request serializer: id, method, path; response: status); pino redaction paths as a backstop ([`logger.ts`](../apps/api/src/lib/logger.ts)) | `security.test.ts` (no token, cookie, password or email in logs); `unit.test.ts` (redaction paths) | Pass; see section 5 for the depth limit |
| Errors | One error handler decides every response; unexpected errors become a generic 500 ([`error-handler.ts`](../apps/api/src/middleware/error-handler.ts)) | `security.test.ts` (500 without internals); production error checks | Pass |
| Secrets | Environment variables validated at startup without printing values; `.env` files git-ignored; only placeholders in `.env.example` files | `unit.test.ts` (config errors name variables only); section 6 | Pass |
| Transport | HTTPS with HSTS on web and API; database TLS verified against the Supabase root CA | Phase 8 checks ([deployment.md](deployment.md), sections 3 and 9) | Pass |
| Database surface | Supabase Data API disabled; only the API connects | Supabase dashboard (confirmed by the project owner). An external probe of the Data API was optional and not run. | Pass |
| Dependencies | `pnpm audit` review | Section 7 | Reviewed; five advisories accepted |

## 3. Ownership review

Every Prisma call on `project` or `task` (the checklist item of [ADR-0002](decisions/0002-backend-layering.md)):

| File | Call | Ownership condition |
|---|---|---|
| [`projects.service.ts`](../apps/api/src/modules/projects/projects.service.ts) | `project.findMany` (list) | `ownerId: userId` |
| | `project.findFirst` (get) | `id` and `ownerId: userId` |
| | `project.create` | `ownerId` set from the token; the body cannot contain it |
| | `project.update` | `where: { id, ownerId: userId }` |
| | `project.delete` | `where: { id, ownerId: userId }` |
| [`tasks.service.ts`](../apps/api/src/modules/tasks/tasks.service.ts) | `project.findFirst` (`assertProjectOwned`) | `id` and `ownerId: userId` |
| | `task.findMany` (list) | `project: { ownerId: userId }`; with `projectId`, the project is checked first |
| | `task.findFirst` (get) | `id` and `project: { ownerId: userId }` |
| | `task.create` | Preceded by `assertProjectOwned`; a project deleted in between causes a foreign-key error mapped to 404 |
| | `task.update` | `where: { id, project: { ownerId: userId } }`; `projectId` is never written |
| | `task.delete` | `where: { id, project: { ownerId: userId } }` |
| [`dashboard.service.ts`](../apps/api/src/modules/dashboard/dashboard.service.ts) | `project.groupBy` | `ownerId: userId` |
| | `task.groupBy` | `project: { ownerId: userId }` |

All 13 calls are scoped. The other Prisma calls touch only users (by email or by the token's user id) and revoked tokens.

## 4. Security requirements

| Req | Result | Evidence |
|---|---|---|
| SEC-01 | Pass | All 13 protected routes return 401 without a session (`security.test.ts`) |
| SEC-02 | Pass | Section 3; two-user tests in `projects`, `tasks`, `dashboard`; production checks |
| SEC-03 | Pass | Validation tables; `INVALID_JSON`; malformed ids |
| SEC-04 | Pass | Strict schemas; `ownerId`, `id`, `createdAt` rejected on create and update; `projectId` rejected on task update |
| SEC-05 | Pass | Prisma query API only (section 2, Injection) |
| SEC-06 | Pass | 429 tests for login and registration |
| SEC-07 | Pass | `SameSite=Lax` plus origin check; tests and production checks |
| SEC-08 | Pass | helmet; header test; production HSTS |
| SEC-09 | Pass | Section 5 |
| SEC-10 | Pass | Section 6 |
| SEC-11 | Pass | Generic 500 test; production error responses without stack traces |

## 5. Logging and secret redaction

**Why the API does not expose secrets in logs.** The request logger records only the request id, method, path (without query string), status and duration; request bodies and headers are never logged. The application's own log calls record only an error object for unexpected 500 errors, an error code for rejected requests, the health check's failure reason, and the port, environment and signal at startup and shutdown. None of these carries a password, token, cookie or connection string. A test drives a mobile registration, a web login, `me` with cookie and Bearer, and a failed login through a trace-level logger and finds no token, cookie value, password or email in the output. In Phase 8 the production build started in production mode logged no connection string, password or signing key.

**Redaction backstop and its limit.** `REDACT_PATHS` removes the `Authorization` and `Cookie` request headers, `Set-Cookie`, and any `password`, `passwordHash`, `token`, `jwtSecret` or `databaseUrl` field. The wildcard paths (`*.password` and the others) match exactly one level of nesting: a field at the top level of a log object, or nested two or more levels deep, is not redacted. This was confirmed with the production paths. It is a known limitation of a defense-in-depth measure, not an exposure: no current log call passes such fields at any depth. Widening the paths would be an application change and was not made in Phase 9; any new log call must not include credentials.

## 6. Secrets and client exposure

- Production secrets (`DATABASE_URL`, `JWT_SECRET`, the database password) exist only in Render's environment settings and in the git-ignored `apps/api/.env.production` on the machine that runs migrations ([deployment.md](deployment.md), section 8).
- Phase 8 scanned all tracked files and the full git history for the production password, pooler user and project reference: none found. No credential-shaped connection strings, JWTs or private keys are tracked. The committed `prod-ca-2021.crt` is Supabase's public root certificate.
- Web: no `NEXT_PUBLIC_*` variables; `API_ORIGIN` is server-side. The deployed client bundles contain no secrets and not even the API host (Phase 8 scan).
- Mobile: the only build-time variable is `EXPO_PUBLIC_API_URL`, a public URL. The exported Android bundle contains no connection strings or secret names (Phase 8 scan).

## 7. Dependency audit

`pnpm audit` (2026-10-09) reports five advisories, unchanged after the Phase 9 test additions. None affects the API or the web runtime.

| Package | Severity | Advisory | Dependency path | Reachable by users | Rationale |
|---|---|---|---|---|---|
| `decode-uri-component` 0.2.2 | moderate | GHSA-vcc3-ghjq-m6fr, denial of service through slow decoding of malformed percent-encoded input | `apps/mobile` > `expo-router` > `query-string` > `decode-uri-component` | Yes, in the Android app: the decoder is part of the bundle and parses incoming app URLs | Triggering it requires the user to open a crafted deep link on their own device; the impact is a freeze of the app on that device, with no data exposure. The fixed version (0.5.0 or later) is not accepted by `query-string` 7, so an override would likely break `expo-router`. |
| `deepmerge-ts` 7.1.5 | high | GHSA-ggr8-5vv4-36mx, stack exhaustion when merging recursive objects | `apps/api` > `prisma` (CLI) > `@prisma/config` > `deepmerge-ts` | No | Used by the Prisma CLI while loading its own configuration at build and migration time; never with user input, and not used by the running API. |
| `node-forge` 1.4.0 | high | GHSA-86w9-cpqp-85rv, RSA PKCS#1 v1.5 signature verification accepts extra nested elements | `apps/mobile` > `expo` > `@expo/cli` > `node-forge` | No | Part of the Expo developer CLI, not the app bundle. No fixed version is published. |
| `braces` 3.0.3 | high | GHSA-vfj7-8cjw-p6xm, stack exhaustion with deeply nested patterns | `apps/mobile` > `expo` > `@expo/metro` > `metro-file-map` > `micromatch` > `braces` | No | Bundler tooling that expands file patterns from the project's own configuration. No fixed version is published. |
| `uuid` 7.0.3 | moderate | GHSA-w5hq-g745-h8pq, missing buffer bounds check in v3, v5 and v6 when a buffer is passed | `apps/mobile` > `expo` > `@expo/config-plugins` > `xcode` > `uuid` | No | iOS project tooling used at build time; not used for the Android build and never called with user-provided buffers. |

**Decision:** all five are accepted and documented; no dependency is upgraded or overridden in Phase 9. They are rechecked when Expo, `expo-router` or Prisma are next updated, and before submission.

## 8. Known design risks

**Registration rate limit shared through Vercel.** Web registrations reach the API through the Vercel rewrite, so the API sees a Vercel egress address as the client (`TRUST_PROXY_HOPS=1`; [architecture.md](architecture.md), section 15). The registration limit of 10 per hour per address (`RATE_LIMIT_REGISTER_IP_MAX=10`) may therefore be shared by all web users whose requests leave Vercel from the same address; once reached, further web registrations from that address get 429 for the rest of the hour. Mobile registrations are counted per device address and are not affected. Login is not affected in the same way, because its strict limit is keyed by address and email.

- How many egress addresses Vercel uses could not be measured without sending enough registrations to trigger the limit in production, which would create accounts and could block real users; rate-limit tests are run only locally.
- The value stays at 10. Expected registration volume for this project is far below the limit, and a lower limit keeps automated account creation slow. If web registrations start failing with 429, the limit can be raised on Render without a code change.

**Other accepted risks**

- Rate limits are kept in memory (one instance) and reset when the free Render service restarts or sleeps (ADR-0010).
- Whether Vercel adds the client address to `X-Forwarded-For` is not observable without logging it; no limit depends on it (ADR-0004).
- The log redaction backstop has a depth limit (section 5).

## 9. Follow-ups

None is required for the assessment. Possible later improvements, each needing a separate decision:

- Widen the redaction paths (for example top-level and deeper `password` and `token` fields).
- Re-run `pnpm audit` after Expo, `expo-router` or Prisma updates, and before submission.
- Revisit the registration limit if the 429 rate for web registrations becomes visible.
