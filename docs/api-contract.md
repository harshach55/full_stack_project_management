# API Contract

The REST contract for the Project Management API. Phase 5 implements it, and the OpenAPI document produced in Phase 5 must match it.

Sources: [requirements.md](requirements.md), [scope-and-decisions.md](scope-and-decisions.md) (PD-xx), [architecture.md](architecture.md), [database-design.md](database-design.md), ADR-0003 to ADR-0006, ADR-0009, ADR-0010, ADR-0013 and [ADR-0014](decisions/0014-api-contract-and-error-handling.md).

## 1. Conventions

| Topic | Rule |
|---|---|
| Base path | `/api`. Web reaches it through the web app's own domain (`/api/*` rewrite); mobile calls the API host directly. |
| Transport | HTTPS in every deployed environment. |
| Content type | Request bodies are `application/json` (UTF-8). Responses with a body are `application/json`. A `POST`/`PUT` with a body that is not JSON returns 415. |
| Field names | camelCase. |
| IDs | UUID strings, lowercase in responses, for example `"3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f8a9b0c"`. Input is accepted in any letter case. |
| Date-only fields | `"YYYY-MM-DD"` strings (`startDate`, `endDate`, `dueDate`). No time or timezone. |
| Timestamps | ISO 8601 in UTC with milliseconds, for example `"2026-10-08T09:15:30.123Z"` (`createdAt`, `updatedAt`, `expiresAt`). |
| Enums | Uppercase strings exactly as listed: project status `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`; task status `PENDING`, `IN_PROGRESS`, `COMPLETED`; task priority `LOW`, `MEDIUM`, `HIGH`. |
| Null | Optional fields without a value are present in responses with `null`; they are never omitted. In requests, `null` clears an optional field. |
| Empty collections | Lists with no matches return `200` with `[]`. |
| Success bodies | Resources are returned as plain JSON objects; lists as plain JSON arrays; no wrapper object. Auth endpoints return objects with named members (`user`, `token`, `expiresAt`). |
| Error bodies | Always `{ "error": { ... } }` (section 3). |
| Request ID | Every response has an `X-Request-Id` header. A client-supplied `X-Request-Id` (1 to 64 characters of letters, digits, `-`, `_`) is reused; otherwise the server generates a UUID. Error bodies repeat it as `requestId`. |
| Unknown fields | Request bodies and query strings with unknown or server-owned fields are rejected with 400. |
| Pagination | Not supported (deferred, scope document section 3). Lists return all matching items. |
| Sorting | Fixed: newest first (`createdAt` descending, then `id` descending). No sort parameter. |

## 2. Authentication contract

### 2.1 Token

- JWT signed with HS256 (`JWT_SECRET`). Claims: `sub` (user id), `jti` (UUID, unique per issued token), `iat`, `exp` (`iat` + 7 days). No other claims.
- No refresh tokens. After 7 days the user logs in again (PD-14).

### 2.2 Transports

| Client | How the token is sent | How it is obtained |
|---|---|---|
| Web (browser) | Cookie `pm_session`, sent automatically by the browser to the web domain and forwarded by the rewrite | `Set-Cookie` on login/register; never in a response body |
| Mobile | `Authorization: Bearer <token>` | Response body of login/register when the request has `X-Client-Type: mobile` |

Cookie attributes: `pm_session=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`. No `Domain` attribute. `Secure` is omitted only when `COOKIE_SECURE=false` (local HTTP development). Cleared with the same attributes and `Max-Age=0`.

### 2.3 Token resolution on protected routes

1. If an `Authorization` header is present, it is the only credential considered:
   - It must have the form `Bearer <token>` (scheme case-insensitive, one space). Anything else: 401 `UNAUTHENTICATED`.
   - The cookie is ignored, even if the Bearer token fails. There is no fallback.
2. Otherwise, if the `pm_session` cookie is present, it is the credential.
3. Otherwise: 401 `UNAUTHENTICATED` ("Authentication required.").

### 2.4 Token outcomes

| Situation | Status | Code |
|---|---|---|
| No credential | 401 | `UNAUTHENTICATED` |
| Malformed `Authorization` header or malformed JWT | 401 | `UNAUTHENTICATED` |
| Invalid signature, wrong algorithm, missing `sub`/`jti`/`exp`, non-UUID `sub`/`jti` | 401 | `UNAUTHENTICATED` |
| Valid signature, `exp` in the past | 401 | `TOKEN_EXPIRED` |
| Valid and unexpired, `jti` found in `revoked_tokens` | 401 | `TOKEN_REVOKED` |
| Valid, but the user no longer exists (`GET /api/auth/me` only; users are never deleted) | 401 | `UNAUTHENTICATED` |
| Valid | continues; `req.auth = { userId, jti, exp, method }` | |

Expiry is checked only after the signature is verified, so `TOKEN_EXPIRED` is never returned for forged tokens. No clock tolerance is applied.

Clients treat every 401 on an authenticated request the same way: clear the local session and show login with "Your session has expired. Please log in again." (MOB-10, WEB-04). The distinct codes exist for logging and tests.

### 2.5 Mobile response mode (`X-Client-Type`)

- Header `X-Client-Type`, only meaningful on `POST /api/auth/register` and `POST /api/auth/login`. Ignored on other routes.
- Allowed value: `mobile` (case-insensitive). Any other value: 400 `VALIDATION_ERROR`.
- With `X-Client-Type: mobile` and **no** `Origin` header: the response body contains `token` and `expiresAt`; no cookie is set.
- With `X-Client-Type: mobile` **and** an `Origin` header: 403 `ORIGIN_NOT_ALLOWED` ("Token responses are not available to browser requests."). Browsers always send `Origin` on `POST`, so a script in a browser cannot obtain a token in a response body, even from an allowed origin.
- Without the header: web mode. The cookie is set and the body contains only `user`.

## 3. Error contract

Every error response has this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      { "location": "body", "path": "endDate", "message": "End date must be on or after the start date." }
    ],
    "requestId": "9b2f6c1e-1d3a-4f8e-b0c2-7a5d4e3f2a10"
  }
}
```

- `code`: stable machine-readable value from the table below. Clients branch on `code`, never on `message`.
- `message`: short English sentence safe to show to users.
- `details`: present only for `VALIDATION_ERROR`; one entry per problem. `location` is `body`, `query`, `params` or `headers`; `path` is the field path with dots for nesting (empty string for the whole body).
- `requestId`: same value as the `X-Request-Id` response header.
- Never included: stack traces, SQL, Prisma or driver messages, tokens, password hashes, secrets, environment values, internal ids of other users.

| Status | Code | When | Default message |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Body, query, path or header fails validation; unknown fields; partial `PUT` | Request validation failed. |
| 400 | `INVALID_JSON` | Body is not parseable JSON | Request body is not valid JSON. |
| 401 | `UNAUTHENTICATED` | Missing, malformed or invalid credential | Authentication required. |
| 401 | `TOKEN_EXPIRED` | Valid token past its expiry | Your session has expired. Please log in again. |
| 401 | `TOKEN_REVOKED` | Token was logged out | Your session has ended. Please log in again. |
| 401 | `INVALID_CREDENTIALS` | Login with unknown email or wrong password | Invalid email or password. |
| 403 | `ORIGIN_NOT_ALLOWED` | Origin check failed (section 9) or mobile mode requested by a browser | Request origin is not allowed. |
| 404 | `NOT_FOUND` | Resource does not exist or is not owned by the caller | Project not found. / Task not found. |
| 404 | `ROUTE_NOT_FOUND` | No route matches method and path | Route not found. |
| 409 | `EMAIL_ALREADY_EXISTS` | Registration with an email that is already registered | An account with this email already exists. |
| 413 | `PAYLOAD_TOO_LARGE` | Body larger than 100 kb | Request body is too large. |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Body sent with a content type other than JSON | Content type must be application/json. |
| 429 | `RATE_LIMITED` | Rate limit exceeded (section 10) | Too many requests. Please try again later. |
| 500 | `INTERNAL_ERROR` | Any unexpected error | Something went wrong. Please try again. |

`403` is used only for the origin rules. Requests for resources that belong to another user always return `404` (PD-17). The health endpoint's `503` uses its own body (section 8).

## 4. Shared validation rules

Implemented once as Zod schemas in `packages/shared` and used by the API and both clients. The API's result is authoritative.

| Field | Rule | Error message (example) |
|---|---|---|
| `email` | string; trimmed; lowercased; valid email format; max 254 characters | Enter a valid email address. |
| `password` (register) | string; not trimmed; 8 to 72 bytes in UTF-8 | Password must be 8 to 72 bytes long. |
| `password` (login) | string; not trimmed; 1 to 72 bytes | Password is required. |
| `fullName` | string; trimmed; 1 to 100 characters after trimming | Full name is required. |
| `name` (project, task) | string; trimmed; 1 to 120 characters after trimming | Name is required. / Name must be at most 120 characters. |
| `description` | string or `null`; trimmed; max 2000 characters; empty after trimming becomes `null` | Description must be at most 2000 characters. |
| project `status` | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED` | Invalid status. |
| task `status` | `PENDING`, `IN_PROGRESS`, `COMPLETED` | Invalid status. |
| task `priority` | `LOW`, `MEDIUM`, `HIGH` | Invalid priority. |
| `startDate`, `endDate`, `dueDate` | `null` or string matching `YYYY-MM-DD` that is a real calendar date (`2026-02-30` is rejected); empty string rejected | Enter a valid date (YYYY-MM-DD). |
| `endDate` vs `startDate` | when both are non-null, `endDate >= startDate` | End date must be on or after the start date. |
| ids (path, `projectId`) | UUID format | Invalid id. |
| `search` (query) | string; trimmed; max 120 characters; empty after trimming means "no search" | Search must be at most 120 characters. |

General rules:
- **Strict objects.** Unknown keys are rejected. This includes server-owned fields: `id`, `ownerId`, `createdAt`, `updatedAt`, `passwordHash`, `jti`, `token` and, on task update, `projectId`.
- **Types are exact.** Numbers, booleans or arrays where strings are expected are rejected; strings are not coerced.
- **Query parameters** may appear at most once each; repeated parameters are rejected. Unknown query parameters are rejected.
- Values are validated after trimming; stored values are the trimmed values.
- Search terms are matched literally: `%`, `_` and `\` in the term have no wildcard meaning.

## 5. Auth endpoints

### 5.1 POST /api/auth/register

| | |
|---|---|
| Auth | None. Rate limited (register limit). Origin check applies. |
| Headers | `Content-Type: application/json`; optional `X-Client-Type: mobile` |
| Body | `{ "fullName": string, "email": string, "password": string }`, all required |

Behavior:
1. Validate and normalize (trim name, trim and lowercase email).
2. Hash the password with bcryptjs, cost 12.
3. Insert the user. If the unique index on email rejects it: 409 `EMAIL_ALREADY_EXISTS`.
4. Issue a token and respond as for login (registration logs the user in, PD-16).

Response `201 Created`, web mode (with `Set-Cookie: pm_session=...`):

```json
{
  "user": {
    "id": "3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f8a9b0c",
    "fullName": "Alice Example",
    "email": "alice@example.com",
    "createdAt": "2026-10-08T09:15:30.123Z"
  }
}
```

Response `201 Created`, mobile mode (no cookie):

```json
{
  "user": { "id": "...", "fullName": "Alice Example", "email": "alice@example.com", "createdAt": "..." },
  "token": "<jwt>",
  "expiresAt": "2026-10-15T09:15:30.000Z"
}
```

Errors: 400 `VALIDATION_ERROR` / `INVALID_JSON`; 403 `ORIGIN_NOT_ALLOWED`; 409 `EMAIL_ALREADY_EXISTS`; 415; 429 `RATE_LIMITED`.

Account existence: the 409 response necessarily reveals that an email is registered. This is required by AUTH-02 and the register flow (F1). The register rate limit restricts using it to test many emails. Login never reveals it (5.2).

### 5.2 POST /api/auth/login

| | |
|---|---|
| Auth | None. Rate limited (login limits). Origin check applies. |
| Headers | `Content-Type: application/json`; optional `X-Client-Type: mobile` |
| Body | `{ "email": string, "password": string }`, both required |

Behavior:
1. Validate; normalize email.
2. Look up the user by email.
3. If found, compare the password with the stored hash. If not found, compare it with a fixed dummy bcrypt hash (cost 12) and treat the result as a failure, so both paths take similar time.
4. Failure: 401 `INVALID_CREDENTIALS` with the same message for unknown email and wrong password.
5. Success: issue a new token (new `jti`). Earlier tokens of the same user are not affected.

Response `200 OK`: same bodies as register (web mode: `{ user }` plus `Set-Cookie`; mobile mode: `{ user, token, expiresAt }`).

Errors: 400; 401 `INVALID_CREDENTIALS`; 403 `ORIGIN_NOT_ALLOWED`; 415; 429 `RATE_LIMITED`.

If a browser already holds a `pm_session` cookie, a successful login replaces the cookie; the previous token is not revoked and expires on its own.

### 5.3 POST /api/auth/logout

| | |
|---|---|
| Auth | Required (cookie or Bearer). Origin check applies. |
| Body | None (an empty body or `{}` is accepted) |

Behavior:
1. Authenticate as in section 2.3.
2. Insert the token's `jti` and `exp` into `revoked_tokens` (`ON CONFLICT DO NOTHING`).
3. If the credential was the cookie, clear it (`Max-Age=0`).

Response: `204 No Content`.

- Only the presented token is revoked. Logging out on web leaves the mobile token valid, and the reverse (PD-18).
- Calling logout again with the same token returns 401 `TOKEN_REVOKED`. With an expired token it returns 401 `TOKEN_EXPIRED`.
- When the credential was the cookie, every logout response clears the cookie, including the 401 responses, so a browser never keeps a dead cookie.
- Clients delete their local session state after any logout response, including 401 and network errors (mobile deletes the SecureStore entry).

### 5.4 GET /api/auth/me

| | |
|---|---|
| Auth | Required |

Response `200 OK`:

```json
{
  "user": {
    "id": "3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f8a9b0c",
    "fullName": "Alice Example",
    "email": "alice@example.com",
    "createdAt": "2026-10-08T09:15:30.123Z"
  }
}
```

Errors: 401 `UNAUTHENTICATED` / `TOKEN_EXPIRED` / `TOKEN_REVOKED`.

Used by the web app to determine the logged-in user and by the mobile app at startup. Never returns `passwordHash` or token data.

## 6. Project endpoints

All project endpoints require authentication. The owner is always the authenticated user.

### Project representation

```json
{
  "id": "6a0d2b4c-1e3f-4a5b-8c7d-9e0f1a2b3c4d",
  "name": "Website Redesign",
  "description": "New landing page and pricing section",
  "status": "IN_PROGRESS",
  "startDate": "2026-10-01",
  "endDate": "2026-11-15",
  "createdAt": "2026-10-08T09:20:00.000Z",
  "updatedAt": "2026-10-08T10:02:41.512Z"
}
```

`ownerId` is not part of the representation: every project returned belongs to the caller.

### 6.1 GET /api/projects

Query parameters (all optional):

| Name | Type | Meaning |
|---|---|---|
| `search` | string, max 120 | Case-insensitive partial match on `name` |
| `status` | project status | Exact match |

Response `200 OK`: array of project representations owned by the caller, matching all given filters, newest first. `[]` if none.

Errors: 400 `VALIDATION_ERROR` (invalid status, unknown parameter, search too long); 401.

### 6.2 GET /api/projects/{id}

Path: `id` (UUID).

Response `200 OK`: the project representation.

Errors: 400 (`id` not a UUID); 401; 404 `NOT_FOUND` if the project does not exist or belongs to another user.

### 6.3 POST /api/projects

Body:

| Field | Required | Default when omitted |
|---|---|---|
| `name` | yes | |
| `description` | no | `null` |
| `status` | no | `NOT_STARTED` |
| `startDate` | no | `null` |
| `endDate` | no | `null` |

```json
{ "name": "Website Redesign", "description": null, "status": "NOT_STARTED", "startDate": "2026-10-01", "endDate": null }
```

Response `201 Created`: the created project representation. A `Location` header is not used.

Errors: 400 (validation, including `endDate` before `startDate` and any `ownerId`/`id`/timestamps in the body); 401; 403 `ORIGIN_NOT_ALLOWED`; 415.

### 6.4 PUT /api/projects/{id}

Full replacement of the editable representation (PD-07). **All five editable fields are required keys**; optional values are sent as `null`:

| Field | Required key | Value |
|---|---|---|
| `name` | yes | non-blank string |
| `description` | yes | string or `null` |
| `status` | yes | project status |
| `startDate` | yes | date or `null` |
| `endDate` | yes | date or `null` |

```json
{ "name": "Website Redesign", "description": "New landing page", "status": "COMPLETED", "startDate": "2026-10-01", "endDate": "2026-11-15" }
```

- A missing key is a 400 `VALIDATION_ERROR` with one detail per missing field (a partial body is never applied).
- `id`, `ownerId`, `createdAt`, `updatedAt` in the body: 400. Ownership cannot be changed.
- `status` is whatever the client sends; it is never derived from tasks.

Response `200 OK`: the updated project representation (`updatedAt` changed).

Errors: 400; 401; 403 `ORIGIN_NOT_ALLOWED`; 404 `NOT_FOUND`; 415.

### 6.5 DELETE /api/projects/{id}

Deletes the project and, through the database cascade, all its tasks (PD-09). Clients confirm before calling.

Response: `204 No Content`.

Errors: 400 (`id` not a UUID); 401; 403 `ORIGIN_NOT_ALLOWED`; 404 `NOT_FOUND` (missing, another user's, or already deleted).

## 7. Task endpoints

All task endpoints require authentication. Tasks have no owner field: a task is accessible only if its project's owner is the caller.

### Task representation

```json
{
  "id": "b7e1c3d5-2f4a-4b6c-9d8e-0a1b2c3d4e5f",
  "projectId": "6a0d2b4c-1e3f-4a5b-8c7d-9e0f1a2b3c4d",
  "name": "Draft homepage copy",
  "description": null,
  "priority": "HIGH",
  "status": "IN_PROGRESS",
  "dueDate": "2026-10-20",
  "createdAt": "2026-10-08T09:30:00.000Z",
  "updatedAt": "2026-10-08T11:00:00.000Z"
}
```

The representation does not include the project's name. Clients that list tasks across projects also load `GET /api/projects` and look names up by `projectId`.

### 7.1 GET /api/tasks

Query parameters (all optional):

| Name | Type | Meaning |
|---|---|---|
| `projectId` | UUID | Only tasks of this project |
| `search` | string, max 120 | Case-insensitive partial match on `name` |
| `status` | task status | Exact match |
| `priority` | task priority | Exact match |

Behavior (PD-11):
- Without `projectId`: all tasks in all of the caller's projects that match the other filters. `200` with `[]` if none.
- With `projectId`: if the project exists and belongs to the caller, its tasks matching the other filters (possibly `[]`). If the project does not exist or belongs to another user: 404 `NOT_FOUND` ("Project not found.").
- Newest first.

Errors: 400; 401; 404 `NOT_FOUND` (only with `projectId`).

### 7.2 GET /api/tasks/{id}

Response `200 OK`: the task representation.

Errors: 400; 401; 404 `NOT_FOUND` if the task does not exist or its project belongs to another user.

### 7.3 POST /api/tasks

Body:

| Field | Required | Default when omitted |
|---|---|---|
| `projectId` | yes | |
| `name` | yes | |
| `description` | no | `null` |
| `priority` | no | `MEDIUM` |
| `status` | no | `PENDING` |
| `dueDate` | no | `null` |

```json
{ "projectId": "6a0d2b4c-1e3f-4a5b-8c7d-9e0f1a2b3c4d", "name": "Draft homepage copy", "priority": "HIGH", "dueDate": "2026-10-20" }
```

- The project must exist and belong to the caller, otherwise 404 `NOT_FOUND` ("Project not found."). The response is the same whether the project is missing or another user's.
- `dueDate` may be in the past and does not need to be inside the project's dates (PD-05).

Response `201 Created`: the created task representation.

Errors: 400; 401; 403 `ORIGIN_NOT_ALLOWED`; 404 `NOT_FOUND`; 415.

### 7.4 PUT /api/tasks/{id}

Full replacement of the editable task representation (PD-06, PD-07, PD-08).

Editable representation (exactly these keys, **all required**):

| Field | Value |
|---|---|
| `name` | non-blank string |
| `description` | string or `null` |
| `priority` | task priority |
| `status` | task status |
| `dueDate` | date or `null` |

```json
{ "name": "Draft homepage copy", "description": null, "priority": "HIGH", "status": "COMPLETED", "dueDate": "2026-10-20" }
```

- **Omitted field:** 400 `VALIDATION_ERROR` naming each missing field. Nothing is changed.
- **`projectId` in the body:** 400 `VALIDATION_ERROR` (`path: "projectId"`, "Project cannot be changed."), even when the value equals the current project. `projectId` is not part of the editable representation; the task's project is fixed at creation and identified by the URL's task id.
- `id`, `createdAt`, `updatedAt`, `ownerId` in the body: 400.

Response `200 OK`: the updated task representation (including its unchanged `projectId`).

Errors: 400; 401; 403 `ORIGIN_NOT_ALLOWED`; 404 `NOT_FOUND`; 415.

**Quick actions (mark completed, change status, change priority).** The client takes the current task representation it already displays, keeps only the five editable fields, changes the one field, and sends the complete object:

```
current = { id, projectId, name, description, priority, status, dueDate, createdAt, updatedAt }
body    = { name: current.name, description: current.description, priority: current.priority,
            status: "COMPLETED", dueDate: current.dueDate }
PUT /api/tasks/{current.id} with body
```

Concurrent edits from two devices: the last `PUT` wins (architecture section 19).

### 7.5 DELETE /api/tasks/{id}

Response: `204 No Content`.

Errors: 400; 401; 403 `ORIGIN_NOT_ALLOWED`; 404 `NOT_FOUND`.

## 8. Dashboard and health

### 8.1 GET /api/dashboard

| | |
|---|---|
| Auth | Required |
| Query | None (unknown parameters: 400) |

Response `200 OK`:

```json
{
  "totalProjects": 4,
  "projectsInProgress": 2,
  "totalTasks": 17,
  "completedTasks": 6,
  "pendingTasks": 8,
  "inProgressTasks": 3
}
```

| Field | Definition (caller's data only) |
|---|---|
| `totalProjects` | Number of the caller's projects |
| `projectsInProgress` | Projects with status `IN_PROGRESS` (required by the assessment, DASH-01) |
| `totalTasks` | Tasks in the caller's projects |
| `completedTasks` | Tasks with status `COMPLETED` |
| `pendingTasks` | Tasks with status exactly `PENDING` (PD-01) |
| `inProgressTasks` | Tasks with status `IN_PROGRESS` |

All values are non-negative integers, `0` for a new user. `totalTasks = completedTasks + pendingTasks + inProgressTasks`. Counts are computed per request (nothing stored).

Errors: 400; 401.

### 8.2 GET /api/health

| | |
|---|---|
| Auth | None. Not rate limited. Not part of the origin check (safe method). |

Behavior: runs `SELECT 1` with a 2-second timeout.

| Result | Status | Body |
|---|---|---|
| Database reachable | 200 | `{ "status": "ok", "database": "ok" }` |
| Database unreachable or timeout | 503 | `{ "status": "error", "database": "unavailable" }` |

Response includes `Cache-Control: no-store`. No version, hostname, environment, connection or error details.

## 9. CORS, Origin check and CSRF

**Allowlist:** `CORS_ALLOWED_ORIGINS`, comma-separated exact origins (scheme, host, port), no wildcards and no trailing slashes.
- Development: `http://localhost:3000` (the Next.js dev server).
- Production: the production web origin (for example `https://<project>.vercel.app`). Preview deployment URLs are not allowed unless added explicitly.

**CORS** (for browsers calling the API origin directly; the web app normally uses the same-origin rewrite, where CORS does not apply):

| Header | Value |
|---|---|
| `Access-Control-Allow-Origin` | The request's `Origin`, only if it is in the allowlist; otherwise no CORS headers are sent |
| `Access-Control-Allow-Credentials` | `true` (allowed origins only) |
| `Access-Control-Allow-Methods` | `GET, POST, PUT, DELETE, OPTIONS` |
| `Access-Control-Allow-Headers` | `Content-Type, Authorization, X-Client-Type, X-Request-Id` |
| `Access-Control-Expose-Headers` | `X-Request-Id, Retry-After` |
| `Access-Control-Max-Age` | `600` |

Preflight `OPTIONS` requests from allowed origins get `204`.

**Origin check** (all routes, methods `POST`, `PUT`, `DELETE`):

| Request | Result |
|---|---|
| `Origin` present and in the allowlist | allowed |
| `Origin` present and not in the allowlist (including `null`) | 403 `ORIGIN_NOT_ALLOWED` |
| No `Origin`, has `pm_session` cookie, no `Authorization` header | 403 `ORIGIN_NOT_ALLOWED` |
| No `Origin`, no cookie (mobile app, API tools) | allowed |

`GET`, `HEAD` and `OPTIONS` are not checked; they do not change data.

CSRF protection for the web session therefore has two layers: `SameSite=Lax` (browsers do not attach the cookie to cross-site `POST`/`PUT`/`DELETE`) and the origin check above (which also covers login and register, preventing login CSRF).

## 10. Rate limiting

| Limiter | Routes | Key | Limit (default) | Counts |
|---|---|---|---|---|
| Login per account | `POST /api/auth/login` | client IP + normalized email | 5 per 15 minutes | Failed attempts only (successful logins are not counted) |
| Login per IP | `POST /api/auth/login` | client IP | 50 per 15 minutes | All attempts |
| Register per IP | `POST /api/auth/register` | client IP | 10 per hour | All attempts |

- When a limit is exceeded: 429 `RATE_LIMITED` with a `Retry-After` header (seconds) and standard `RateLimit` headers.
- Client IP is `req.ip` with `trust proxy` set to `TRUST_PROXY_HOPS` (1 on Render). For web traffic this is a Vercel address; the per-account limiter is what protects individual accounts (ADR-0010).
- The per-account key normalizes the email the same way as validation (trim, lowercase). Requests without a usable email string are keyed by IP only.
- Limits are configurable through environment variables (`RATE_LIMIT_LOGIN_ACCOUNT_MAX`, `RATE_LIMIT_LOGIN_IP_MAX`, `RATE_LIMIT_REGISTER_IP_MAX`, `RATE_LIMIT_WINDOW_MS`); the defaults above apply when unset.
- No other routes are rate limited.

## 11. Client compatibility

The API has no client-specific business logic. Web and mobile call the same endpoints with the same bodies; only the token transport differs (section 2.2) and, for login/register, the response mode (section 2.5).

| Need | Web | Mobile | Endpoint(s) |
|---|---|---|---|
| Register, login, logout | cookie | Bearer + SecureStore | `/api/auth/register`, `/login`, `/logout` |
| Persistent session, startup check | cookie, `GET /api/auth/me` | stored token, `GET /api/auth/me` | `/api/auth/me` |
| Session expiry to login | any 401 | any 401 | all protected routes |
| Dashboard | yes | yes | `/api/dashboard` |
| Project create/edit/delete | yes | not used (PD-10) | `POST`, `PUT`, `DELETE /api/projects...` |
| Project viewing | yes | yes | `GET /api/projects`, `GET /api/projects/{id}` |
| Task CRUD | yes | yes | `/api/tasks...` |
| Status / priority changes, mark completed | full `PUT` | full `PUT` | `PUT /api/tasks/{id}` |
| Search and filters | projects and tasks | tasks | query parameters |
| Refresh / sync | refetch | pull-to-refresh refetch | the same `GET` endpoints |
| Same backend and database | yes | yes | one API deployment |

## 12. API documentation

- Phase 5 produces the OpenAPI document from the same Zod schemas used for validation and serves it at `/api/docs.json` (JSON) and `/api/docs` (Swagger UI).
- It documents every endpoint in this contract, both login/register response modes, the cookie and Bearer security schemes, and the error shape with the code list.
- `/api/docs` and `/api/docs.json` are public, not rate limited and not origin checked.
- This phase creates no OpenAPI files or code.
