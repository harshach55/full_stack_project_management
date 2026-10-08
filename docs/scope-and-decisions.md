# Scope and Product Decisions

## 1. Product summary

A project management system where a user registers once and manages projects and tasks from a responsive web app or an Android app. Both clients use the same REST API and the same PostgreSQL database, so a change made on one platform is visible on the other after a refresh.

## 2. In scope (mandatory)

- User registration, login, logout and current-user lookup
- Project CRUD (web), project viewing (mobile)
- Task CRUD, completion, status and priority changes (web and mobile)
- Dashboard statistics for the user's own data
- Search and filtering for projects (web) and tasks (web and mobile)
- Strict per-user data isolation on every endpoint
- Web app (Next.js), Android app (Expo), API (Express), PostgreSQL (Supabase)
- API documentation (OpenAPI/Swagger), automated API tests
- Deployment of API, web and Android APK; README and setup documentation

## 3. Optional features

Optional features are added only after all mandatory requirements are complete, and only if they are clearly useful.

| Feature | Plan |
|---|---|
| Automated tests (unit/integration) | Planned. Treated as part of the quality bar, built alongside the API. |
| Shared validation and types | Planned. Zod schemas in `packages/shared` are part of the agreed stack. |
| Pagination and sorting | Deferred. Lists use a fixed default order (PD-08). Revisit if lists become large. |
| Docker (local/test database) | Candidate. Useful for running tests against a disposable PostgreSQL. |
| CI pipeline | Candidate, after tests exist. |
| Refresh tokens, RBAC, audit logs, push notifications, offline task viewing | Out of scope unless time remains. |

## 4. Out of scope

- iOS build (optional in the assessment)
- Sharing projects between users, teams, roles or invitations
- Password reset, email verification, social login
- Real-time sync (websockets); sync happens on refresh / pull-to-refresh
- File attachments, comments, notifications

## 5. Product decisions

| ID | Decision | Notes |
|---|---|---|
| PD-01 | Dashboard "Pending Tasks" counts tasks with status `PENDING` only. | `IN_PROGRESS` tasks are not counted as pending. |
| PD-02 | Required text fields: project name, task name (plus full name, email and password at registration). Descriptions are optional. | Required strings are trimmed; whitespace-only values are rejected. |
| PD-03 | Project `startDate`, `endDate` and task `dueDate` are optional, date-only values in `YYYY-MM-DD` format. | No time or timezone component. |
| PD-04 | When both exist, project `endDate` must be on or after `startDate`. | Validated on create and update. |
| PD-05 | Task `dueDate` is independent of the project's date range. | Past due dates are allowed. |
| PD-06 | Tasks are updated through `PUT /api/tasks/{id}`. No `PATCH` endpoint. | Status and priority changes (including "mark completed") use the same endpoint. |
| PD-07 | `PUT` is a full replacement of the editable representation. Every `PUT` body must contain the complete editable representation; partial bodies are rejected with 400. Applies to projects and tasks. | Quick actions (mobile status or priority change, mark completed) take the current task data, change the field locally and send the complete updated representation. |
| PD-08 | A task's `projectId` cannot change after creation. | A `projectId` in a task update request is rejected. |
| PD-09 | Deleting a project deletes its tasks (cascade). Clients ask for confirmation first. | Enforced by a database foreign key rule, not only by application code. |
| PD-10 | Mobile supports viewing projects and full task management. Amended in Phase 7: mobile also creates, edits and deletes projects, as requested for Phase 7. | The assessment requires project viewing on mobile; project editing is additional and uses the same API endpoints and rules as the web app. |
| PD-11 | `GET /api/tasks` without `projectId` returns all of the user's tasks (200, empty array if none match). `GET /api/tasks?projectId={id}` returns the matching tasks if the user owns the project. | If the project belongs to another user or does not exist, the response is 404 in both cases, so another user's project existence is never revealed. |
| PD-12 | Search is case-insensitive partial matching on the name field. | Example: `des` matches "Website Redesign". |
| PD-13 | Default list order is newest first (`createdAt DESC`). | Applies to project and task lists. |
| PD-14 | Access tokens expire after 7 days. No refresh tokens. | Expired session sends the user to login with a clear message. |
| PD-15 | Emails are trimmed and normalized to lowercase before storage and lookup. | `Alice@Example.com` and `alice@example.com` are the same account. |
| PD-16 | Successful registration logs the user in immediately. | Same session result as login. |
| PD-17 | Requests for another user's resources return `404 Not Found`, not `403`. | Avoids revealing that the resource exists. |
| PD-18 | Logout ends only the current session (token). | Logging out on web does not log out mobile, and vice versa. |

## 6. Field rules

These limits are final engineering decisions. They change only if the API contract phase finds a concrete reason.

| Entity | Field | Type | Required | Rules |
|---|---|---|---|---|
| User | fullName | string | yes | trimmed, 1 to 100 characters |
| User | email | string | yes | valid email, max 254 characters, lowercase, unique |
| User | password | string | yes | 8 to 72 bytes (bcrypt input limit) |
| Project | name | string | yes | trimmed, 1 to 120 characters |
| Project | description | string | no | max 2000 characters |
| Project | status | enum | no | `NOT_STARTED` (default), `IN_PROGRESS`, `COMPLETED` |
| Project | startDate, endDate | date | no | `YYYY-MM-DD`, valid calendar date, endDate >= startDate |
| Task | name | string | yes | trimmed, 1 to 120 characters |
| Task | description | string | no | max 2000 characters |
| Task | priority | enum | no | `LOW`, `MEDIUM` (default), `HIGH` |
| Task | status | enum | no | `PENDING` (default), `IN_PROGRESS`, `COMPLETED` |
| Task | dueDate | date | no | `YYYY-MM-DD`, valid calendar date |
| Task | projectId | id | yes (create only) | must reference a project the user owns |
| All | createdAt | timestamp | system | set by the server, read-only |

## 7. Assumptions

- Each project has exactly one owner; there is no sharing between users.
- Project status is controlled manually by the user and is never derived from task completion.
- Search applies to names only (not descriptions), using case-insensitive partial matching.
- Data volume per user is small (tens to hundreds of records), so lists are not paginated initially.
- Only test data is used in any environment.
