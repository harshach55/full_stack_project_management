# Traceability Matrix

Maps each functional requirement to its endpoint, web screen, mobile screen and planned tests. Test names are placeholders until the test plan in Phase 4. This table is also used as the checklist for the Phase 9 audit and final submission.

Status: `planned` until implemented, then `done` with links to the evidence: API test files, client test files, or the manual and deployed checks recorded in [testing.md](testing.md), section 6. All rows were verified in the Phase 9 audit (2026-10-09).

| Req | Endpoint | Web | Mobile | Planned tests | Status |
|---|---|---|---|---|---|
| AUTH-01 | `POST /api/auth/register` | `/register` | Register | register success; missing fields; invalid email; short password | done: [auth](../apps/api/tests/auth.test.ts) |
| AUTH-02 | `POST /api/auth/register` | `/register` | Register | duplicate email; duplicate email in different case | done: [auth](../apps/api/tests/auth.test.ts) |
| AUTH-03 | (all auth) | - | - | stored password is a bcrypt hash; responses never include password fields | done: [auth](../apps/api/tests/auth.test.ts), [security](../apps/api/tests/security.test.ts) |
| AUTH-04 | `POST /api/auth/login` | `/login` | Login | login success; wrong password; unknown email returns same message | done: [auth](../apps/api/tests/auth.test.ts) |
| AUTH-05 | `POST /api/auth/logout` | header logout | header logout | token rejected after logout; second session still valid | done: [auth](../apps/api/tests/auth.test.ts) |
| AUTH-06 | `GET /api/auth/me` | layout | app start | returns user; 401 without token | done: [auth](../apps/api/tests/auth.test.ts) |
| AUTH-07 | (auth middleware) | redirect to `/login` | Login with message | expired token returns 401 with expiry code | done: [auth](../apps/api/tests/auth.test.ts) |
| AUTH-08 | (all auth) | `/login` | Login | same credentials accepted via cookie and bearer flows | done: [auth](../apps/api/tests/auth.test.ts), [manual](testing.md#6-manual-and-deployed-verification) |
| AUTH-09 | `POST /api/auth/login` | - | - | cookie flags httpOnly, Secure, SameSite=Lax; no token in web response body | done: [auth](../apps/api/tests/auth.test.ts), [manual](testing.md#6-manual-and-deployed-verification) |
| AUTH-10 | `POST /api/auth/login` | - | SecureStore | bearer flow returns token; manual check of storage | done: [auth](../apps/api/tests/auth.test.ts), [mobile session](../apps/mobile/tests/session.test.ts), [manual](testing.md#6-manual-and-deployed-verification) |
| PROJ-01 | `POST /api/projects` | `/projects/new` | - | create success; owner taken from session; validation errors | done: [projects](../apps/api/tests/projects.test.ts) |
| PROJ-02 | `GET /api/projects` | `/projects` | Projects | lists only own projects; newest first | done: [projects](../apps/api/tests/projects.test.ts) |
| PROJ-03 | `GET /api/projects/{id}` | `/projects/[id]` | Project detail | own project; other user's project returns 404; malformed id returns 400 | done: [projects](../apps/api/tests/projects.test.ts) |
| PROJ-04 | `PUT /api/projects/{id}` | `/projects/[id]/edit` | - | update success; other user's project returns 404; endDate before startDate returns 400 | done: [projects](../apps/api/tests/projects.test.ts) |
| PROJ-05 | `DELETE /api/projects/{id}` | `/projects/[id]` | - | delete success; tasks removed; other user's project returns 404 | done: [projects](../apps/api/tests/projects.test.ts) |
| PROJ-06 | (project schema) | project forms | - | invalid status; invalid date; empty name | done: [projects](../apps/api/tests/projects.test.ts) |
| TASK-01 | `POST /api/tasks` | `/tasks/new` | Task form | create in own project; other user's project returns 404 | done: [tasks](../apps/api/tests/tasks.test.ts) |
| TASK-02 | `GET /api/tasks` | `/tasks`, `/projects/[id]` | Tasks, Project detail | all own tasks; empty array when none; filter by own projectId; other user's projectId returns 404; unknown projectId returns 404 | done: [tasks](../apps/api/tests/tasks.test.ts) |
| TASK-03 | `GET /api/tasks/{id}` | `/tasks/[id]/edit` | Task detail | own task; other user's task returns 404 | done: [tasks](../apps/api/tests/tasks.test.ts) |
| TASK-04 | `PUT /api/tasks/{id}` | `/tasks/[id]/edit` | Task form | update success; partial body returns 400; projectId change rejected; other user's task returns 404 | done: [tasks](../apps/api/tests/tasks.test.ts) |
| TASK-05 | `DELETE /api/tasks/{id}` | task actions | Task actions | delete success; other user's task returns 404 | done: [tasks](../apps/api/tests/tasks.test.ts) |
| TASK-06 | `PUT /api/tasks/{id}` | task actions | Task actions | status set to COMPLETED; dashboard count updates | done: [tasks](../apps/api/tests/tasks.test.ts), [dashboard](../apps/api/tests/dashboard.test.ts) |
| TASK-07 | `PUT /api/tasks/{id}` | task actions | Task actions | status/priority change; invalid enum returns 400 | done: [tasks](../apps/api/tests/tasks.test.ts) |
| TASK-08 | (task schema) | task form | Task form | empty name; invalid due date; invalid priority | done: [tasks](../apps/api/tests/tasks.test.ts) |
| DASH-01 | `GET /api/dashboard` | `/dashboard` | Dashboard | counts match seeded data; pending counts only PENDING | done: [dashboard](../apps/api/tests/dashboard.test.ts) |
| DASH-02 | `GET /api/dashboard` | `/dashboard` | Dashboard | two users with data see only their own counts | done: [dashboard](../apps/api/tests/dashboard.test.ts) |
| SRCH-01 | `GET /api/projects?search=` | `/projects` | - | case-insensitive partial match | done: [projects](../apps/api/tests/projects.test.ts) |
| SRCH-02 | `GET /api/projects?status=` | `/projects` | - | status filter; invalid status returns 400 | done: [projects](../apps/api/tests/projects.test.ts) |
| SRCH-03 | `GET /api/tasks?search=` | `/tasks`, `/projects/[id]` | Tasks | case-insensitive partial match | done: [tasks](../apps/api/tests/tasks.test.ts) |
| SRCH-04 | `GET /api/tasks?status=&priority=` | `/tasks`, `/projects/[id]` | Tasks | combined filters; invalid priority returns 400 | done: [tasks](../apps/api/tests/tasks.test.ts) |
| SRCH-05 | project and task lists | - | - | other user's matching names never returned | done: [projects](../apps/api/tests/projects.test.ts), [tasks](../apps/api/tests/tasks.test.ts) |
| WEB-02 | (all pages) | all pages | - | no horizontal scrolling and usable controls at phone, tablet and desktop widths | done: [manual](testing.md#6-manual-and-deployed-verification) |
| MOB-08 | (all lists) | - | all list screens | manual check | done: [manual](testing.md#6-manual-and-deployed-verification) |
| MOB-10 | (auth middleware) | - | Login | manual check with an expired/revoked token | done: [mobile session](../apps/mobile/tests/session.test.ts), [manual](testing.md#6-manual-and-deployed-verification) |
| MOB-11 | - | - | all screens | manual check in airplane mode | done: [manual](testing.md#6-manual-and-deployed-verification) |
| SYNC-02 | (tasks) | `/tasks` | Tasks | manual check following flow F6 | done: [manual](testing.md#6-manual-and-deployed-verification) |
| SEC-01 | all protected routes | - | - | each protected route returns 401 without a session | done: [security](../apps/api/tests/security.test.ts) |
| SEC-04 | create/update routes | - | - | ownerId, id and createdAt in request bodies have no effect or are rejected | done: [projects](../apps/api/tests/projects.test.ts), [tasks](../apps/api/tests/tasks.test.ts) |
| SEC-06 | `POST /api/auth/login`, `/register` | - | - | repeated attempts return 429 | done: [security](../apps/api/tests/security.test.ts) |
| SEC-07 | state-changing routes | - | - | cookie request with foreign Origin rejected | done: [security](../apps/api/tests/security.test.ts) |
| SEC-09 | (logger) | - | - | log output contains no token, cookie or password values | done: [security](../apps/api/tests/security.test.ts), [unit](../apps/api/tests/unit.test.ts) |

Non-functional requirements (WEB, API, DB, DOC, SUB) are verified by review against [requirements.md](requirements.md) during Phase 9; the results are in [testing.md](testing.md), section 7. Security requirements are reviewed in [security-audit.md](security-audit.md).

## API contract mapping

Links requirements to the sections of [api-contract.md](api-contract.md) that define their behavior. Test cases are listed in [backend-design.md](backend-design.md) section 14.

| Req | Endpoint(s) | Contract section | Key status codes / error codes |
|---|---|---|---|
| AUTH-01, AUTH-02, PD-16 | `POST /api/auth/register` | 5.1, 4 | 201; 400 `VALIDATION_ERROR`; 409 `EMAIL_ALREADY_EXISTS`; 429 |
| AUTH-03 | register, login | 5.1, 5.2 | password never in any response |
| AUTH-04 | `POST /api/auth/login` | 5.2 | 200; 401 `INVALID_CREDENTIALS`; 429 |
| AUTH-05, PD-18 | `POST /api/auth/logout` | 5.3 | 204; repeat 401 `TOKEN_REVOKED` |
| AUTH-06 | `GET /api/auth/me` | 5.4 | 200; 401 |
| AUTH-07, PD-14, MOB-10 | all protected routes | 2.1, 2.4 | 401 `TOKEN_EXPIRED` / `TOKEN_REVOKED` / `UNAUTHENTICATED` |
| AUTH-08, SYNC-01, SYNC-02 | all endpoints, both transports | 2.2, 11 | same endpoints for web and mobile |
| AUTH-09 | register, login, logout | 2.2, 2.5 | `pm_session` cookie; no token in web bodies |
| AUTH-10, MOB-09 | register, login | 2.5 | `X-Client-Type: mobile`; 403 with `Origin` |
| PROJ-01 to PROJ-06 | `/api/projects`, `/api/projects/{id}` | 6 | 200/201/204; 400; 404 |
| TASK-01 to TASK-08, PD-06 to PD-08, PD-11 | `/api/tasks`, `/api/tasks/{id}` | 7 | 200/201/204; 400 (partial `PUT`, `projectId`); 404 |
| DASH-01, DASH-02, PD-01 | `GET /api/dashboard` | 8.1 | 200 |
| SRCH-01 to SRCH-05, PD-12, PD-13 | `GET /api/projects`, `GET /api/tasks` | 4, 6.1, 7.1 | 200 `[]` when empty; 400 invalid filters |
| SEC-01, SEC-02, PD-17 | all protected routes | 2.3, 6, 7 | 401; 404 for other users' resources |
| SEC-03, SEC-04, API-06 | all routes with input | 4 | 400 `VALIDATION_ERROR` / `INVALID_JSON`; 413; 415 |
| SEC-06 | login, register | 10 | 429 `RATE_LIMITED` |
| SEC-07, API-05 | `POST`, `PUT`, `DELETE` | 9 | 403 `ORIGIN_NOT_ALLOWED` |
| API-03, SEC-11 | all routes | 3 | error body with `code`, `message`, `requestId` |
| API-07 | `/api/docs`, `/api/docs.json` | 12 | public |
| (operations) | `GET /api/health` | 8.2 | 200; 503 |

## Database design mapping

Links requirements to the schema elements in [database-design.md](database-design.md) that support them. Planned database-level tests are listed where the database itself enforces the rule.

| Req | Tables / schema elements | Planned database-level tests |
|---|---|---|
| AUTH-01, AUTH-02 | `users`; unique `users_email_key`; `users_email_check` (lowercase) | duplicate email in different case returns 409 |
| AUTH-03 | `users.password_hash` (hash only) | stored value is a bcrypt hash |
| AUTH-04, AUTH-06 | `users_email_key` lookup; `users_pkey` lookup | (covered by AUTH tests) |
| AUTH-05, AUTH-07 | `revoked_tokens` (`jti` primary key, `expires_at`) | revoked `jti` rejected; second session unaffected |
| AUTH-08, SYNC-01 | single database for both clients | (covered by AUTH-08, SYNC-02) |
| PROJ-01 to PROJ-04, PROJ-06 | `projects`; `project_status` enum; `projects_dates_check`; `varchar` limits; non-blank name check | endDate before startDate rejected |
| PROJ-05 | `tasks.project_id` `ON DELETE CASCADE` | deleting a project removes its tasks |
| TASK-01 to TASK-08 | `tasks`; `task_status`, `task_priority` enums; FK to `projects` | task cannot reference a missing project |
| DASH-01, DASH-02 | ownership-scoped counts over `projects` and `tasks` joined to `projects` | counts per user with two users' data |
| SRCH-01 to SRCH-05 | ownership-scoped `ILIKE` on `name`; enum filters; `(owner_id, created_at)` and `(project_id, created_at)` indexes | search terms containing `%` or `_` matched literally |
| SEC-02 | ownership chain `users -> projects -> tasks` (no `tasks.owner_id`) | cross-user access returns 404 |
| SEC-05 | parameterized queries only | SQL-like search strings treated as text |
| DB-01 to DB-05 | all tables, constraints, indexes, migration strategy | migrations apply cleanly to an empty database |
