# Requirements

Each requirement has an ID and acceptance criteria. Product decisions referenced as `PD-xx` are defined in [scope-and-decisions.md](scope-and-decisions.md).

## 1. Authentication (AUTH)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| AUTH-01 | Register with full name, email and password via `POST /api/auth/register`. | Valid input creates the user and returns a session (PD-16). Missing/invalid fields return 400 with field errors. |
| AUTH-02 | Email addresses are unique. | Registering an existing email (any letter case, PD-15) returns 409. |
| AUTH-03 | Passwords are hashed with bcrypt (cost 12) and never stored or returned in plain text. | Database stores only a bcrypt hash. No response contains the password or hash. |
| AUTH-04 | Log in via `POST /api/auth/login`. | Correct credentials return a session. Wrong email or password returns 401 with the same generic message for both. |
| AUTH-05 | Log out via `POST /api/auth/logout`. | The current token stops working immediately. Other sessions of the same user keep working (PD-18). |
| AUTH-06 | Get the current user via `GET /api/auth/me`. | Returns id, full name, email, createdAt for a valid session; 401 otherwise. |
| AUTH-07 | Sessions last until logout or token expiry (7 days, PD-14). | A token older than 7 days is rejected with 401 and an error code that identifies expiry. |
| AUTH-08 | One account works on web and mobile. | A user registered on web can log in on mobile and see the same data, and the reverse. |
| AUTH-09 | Web stores the session in an httpOnly, Secure, SameSite=Lax cookie. | The token is not readable from browser JavaScript. |
| AUTH-10 | Mobile sends the token as `Authorization: Bearer <token>` and stores it in Expo SecureStore. | The token is never written to AsyncStorage or plain files. |

## 2. Projects (PROJ)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| PROJ-01 | Create a project via `POST /api/projects`. | Valid input returns 201 with the project. The owner is the authenticated user; a client-supplied owner is ignored or rejected. |
| PROJ-02 | List own projects via `GET /api/projects`. | Returns only the user's projects, newest first (PD-13). |
| PROJ-03 | View a project via `GET /api/projects/{id}`. | Returns the project if owned; 404 if missing or owned by someone else (PD-17); 400 for a malformed id. |
| PROJ-04 | Edit a project via `PUT /api/projects/{id}`. | Body is the complete editable representation; partial bodies return 400 (PD-07). Same 404/400 rules as PROJ-03. |
| PROJ-05 | Delete a project via `DELETE /api/projects/{id}`. | Deletes the project and its tasks (PD-09). Same 404/400 rules. Clients confirm before deleting. |
| PROJ-06 | Project fields: name, description, status, start date, end date, created date. | Validation follows the field rules; endDate >= startDate (PD-04). |

## 3. Tasks (TASK)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| TASK-01 | Create a task via `POST /api/tasks` with a `projectId`. | 201 if the user owns the project. A project owned by someone else, or a missing project, returns 404. |
| TASK-02 | List tasks via `GET /api/tasks`. | Without `projectId`: all of the user's tasks, 200 with an empty array if none match. With `projectId`: the tasks in that project if the user owns it; 404 if the project belongs to another user or does not exist (PD-11). Newest first. |
| TASK-03 | View a task via `GET /api/tasks/{id}`. | Returns the task if its project is owned by the user; otherwise 404. |
| TASK-04 | Edit a task via `PUT /api/tasks/{id}`. | Body is the complete editable representation; partial bodies return 400 (PD-07). `projectId` cannot change (PD-08). Ownership checked through the project. |
| TASK-05 | Delete a task via `DELETE /api/tasks/{id}`. | Ownership checked through the project; otherwise 404. |
| TASK-06 | Mark a task completed. | `PUT` with the complete task representation and status `COMPLETED` (PD-06, PD-07); reflected in dashboard counts. |
| TASK-07 | Change task status and priority. | `PUT` with the complete task representation (PD-06, PD-07); invalid enum values return 400. |
| TASK-08 | Task fields: name, description, priority, status, due date, created date. | Validation follows the field rules. |

## 4. Dashboard (DASH)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| DASH-01 | `GET /api/dashboard` returns totals for the user's data. | Returns total projects, total tasks, completed tasks, pending tasks (status `PENDING`, PD-01) and projects in progress (status `IN_PROGRESS`). |
| DASH-02 | Statistics never include other users' data. | With two users holding data, each user's counts match only their own records. |

## 5. Search and filtering (SRCH)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| SRCH-01 | Search projects by name. | Case-insensitive partial match (PD-12). |
| SRCH-02 | Filter projects by status. | Only valid status values accepted; invalid returns 400. |
| SRCH-03 | Search tasks by name. | Case-insensitive partial match. |
| SRCH-04 | Filter tasks by status and by priority. | Filters combine with each other, with search and with `projectId`. |
| SRCH-05 | Search and filters only cover the user's own data. | Searching for a name that exists only in another user's data returns an empty list. |

## 6. Web application (WEB)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| WEB-01 | Built with Next.js and TypeScript. | |
| WEB-02 | Responsive layout. | Usable at phone (360px), tablet and desktop widths without horizontal scrolling. |
| WEB-03 | Protected routes. | Visiting an app page without a session redirects to login. Logged-in users visiting login/register go to the dashboard. |
| WEB-04 | Authentication state handling. | The UI reflects the current user; logout returns to login; an expired session redirects to login with a message. |
| WEB-05 | Form validation. | Fields are validated before submit with the same rules as the API; server errors are shown next to the relevant fields. |
| WEB-06 | Loading indicators. | Every data fetch and form submit shows a loading state; buttons cannot be double-submitted. |
| WEB-07 | Error handling. | Network and server errors show a readable message with a retry option where it makes sense. Empty lists show an empty state. |
| WEB-08 | Full project and task management, dashboard, search and filters. | All PROJ, TASK, DASH and SRCH requirements are reachable from the web UI. |

## 7. Mobile application (MOB)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| MOB-01 | Android app built with Expo, React Native and TypeScript, distributed as an APK. | Installs and runs on a physical Android device. |
| MOB-02 | Register, login, logout. | Same rules and messages as the API. Registration logs the user in. |
| MOB-03 | Dashboard. | Shows the five statistics from DASH-01. |
| MOB-04 | View projects and tasks under a project. | Project list and project detail with its tasks (PD-10). Project create, edit and delete are also available (PD-10, amended in Phase 7). |
| MOB-05 | Create, edit and delete tasks. | Delete asks for confirmation. |
| MOB-06 | Mark completed, change status, change priority. | Changes are saved through the API and visible after refresh on web. |
| MOB-07 | Search tasks; filter tasks by status and priority. | Same behavior as SRCH-03 and SRCH-04. |
| MOB-08 | Pull-to-refresh on lists and dashboard. | Pulling reloads data from the API. |
| MOB-09 | Secure token storage. | Token stored with Expo SecureStore (Android Keystore backed). |
| MOB-10 | Expired token handling. | Any 401 for an expired or revoked token clears the stored token and shows the login screen with "Your session has expired. Please log in again." |
| MOB-11 | No-network handling. | With no connection, screens show a clear offline/error message with a retry option; the app does not crash or show a blank screen. |
| MOB-12 | Connects to the deployed API. | The API base URL is configurable at build time; the release APK uses the HTTPS deployment URL. |

## 8. Cross-platform sync (SYNC)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| SYNC-01 | Web and mobile use the same API and database. | There is one backend deployment and one database. |
| SYNC-02 | Changes appear on the other platform after refresh. | Create/edit/delete a task on one platform, refresh (web) or pull-to-refresh (mobile) on the other, and see the change. |

## 9. Backend (API)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| API-01 | Node.js, Express and TypeScript REST API. | |
| API-02 | Organized routes and middleware. | Code is grouped by feature (auth, projects, tasks, dashboard) with separate route, controller and service layers. |
| API-03 | Centralized error handling and consistent responses. | All errors use one JSON error format with a stable error code; no stack traces in production responses. |
| API-04 | Logging. | Each request is logged with method, path, status and duration; secrets are redacted (SEC-09). |
| API-05 | CORS configured with an allowlist. | Only configured origins receive CORS headers; credentials are not allowed for unlisted origins. |
| API-06 | Request validation on body, path params and query. | Invalid input returns 400 with field-level errors. |
| API-07 | API documentation. | Swagger UI at `/api/docs` and OpenAPI JSON at `/api/docs.json`, generated from the same schemas used for validation. |

## 10. Database (DB)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| DB-01 | PostgreSQL on Supabase, accessed through Prisma 6. | Only the API connects to the database. |
| DB-02 | Relational design with User, Project and Task, plus session/revocation data. | Foreign keys: Project.ownerId -> User, Task.projectId -> Project. |
| DB-03 | Referential integrity. | A task cannot exist without a project; deleting a project cascades to its tasks (PD-09). |
| DB-04 | Useful indexes. | Unique index on email; indexes supporting owner-scoped lists and filters. |
| DB-05 | Versioned migrations. | Schema changes are applied through Prisma migrations stored in the repository. |

## 11. Security (SEC)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| SEC-01 | All project, task and dashboard endpoints require authentication. | Requests without a valid session return 401. |
| SEC-02 | Ownership isolation on every read, write, search, filter and count. | Cross-user access returns 404 (PD-17); verified by automated tests with two users. |
| SEC-03 | Backend validation is authoritative. | Required fields, invalid email, empty strings, invalid dates, invalid enums, malformed ids and malformed JSON are rejected with 400. |
| SEC-04 | No mass assignment. | Clients cannot set owner, id or createdAt. |
| SEC-05 | Parameterized database access only. | All queries go through Prisma's query API; no raw SQL built from strings. |
| SEC-06 | Rate limiting on login and registration. | Repeated attempts return 429. |
| SEC-07 | CSRF protection for cookie-authenticated requests. | SameSite=Lax cookie plus an Origin check on state-changing requests. |
| SEC-08 | Security headers. | helmet enabled. |
| SEC-09 | Secrets never logged or returned. | Authorization headers, cookies, passwords and tokens are redacted from logs. |
| SEC-10 | Secrets come from environment variables. | No secrets in the repository; `.env.example` files contain placeholders only. |
| SEC-11 | Safe error responses. | No stack traces, SQL or internal details in production responses. |

## 12. Testing (TEST)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| TEST-01 | API tests with Vitest and Supertest. | Cover authentication, authorization, validation, projects, tasks, dashboard, search/filtering, security and cross-user isolation. |
| TEST-02 | Tests run against a separate test database. | Tests never touch the deployed database. |

## 13. Documentation (DOC) and submission (SUB)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| DOC-01 | README with setup for API, web and mobile. | A developer can run all three locally by following it. |
| DOC-02 | Environment variables documented. | Every variable listed with purpose and example value. |
| DOC-03 | Database setup and migrations documented. | |
| DOC-04 | Deployment documented, including how mobile connects to the deployed API. | |
| SUB-01 | Public GitHub repository. | |
| SUB-02 | Database schema / ER diagram. | |
| SUB-03 | API documentation. | Swagger URL and exported OpenAPI JSON. |
| SUB-04 | Web and API deployment URLs. | |
| SUB-05 | Android APK or distribution link. | |
| SUB-06 | 5-minute screen recording. | Shows the same account on web and mobile, creating a task on one platform and seeing it on the other. |
