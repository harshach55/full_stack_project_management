# ADR-0009: Centralized error handling and error codes

- Status: accepted
- Date: 2026-10-08

## Context

The API must return consistent, safe errors (API-03, SEC-11). Clients need stable values to react to (for example `TOKEN_EXPIRED` for the mobile session-expired flow). Clients must also handle failures that never reach the API (no network, timeouts, a sleeping free-tier server).

## Decision

**API**
- A single error middleware, registered last, converts every error into one JSON shape: a stable `code`, a readable `message` and optional `details` (field errors for validation). Exact JSON in Phase 4.
- Application code throws `AppError(status, code, message, details?)` for expected cases.
- Express 5 forwards errors from async handlers to the middleware.
- Mapping of known errors:
  - Zod error: 400 `VALIDATION_ERROR` with field details
  - malformed JSON body: 400 `INVALID_JSON`
  - body too large: 413 `PAYLOAD_TOO_LARGE`
  - JWT expired / invalid / revoked: 401 `TOKEN_EXPIRED` / `UNAUTHENTICATED`
  - wrong credentials: 401 `INVALID_CREDENTIALS`
  - origin rejected: 403 `ORIGIN_NOT_ALLOWED`
  - missing or not owned: 404 `NOT_FOUND`; unknown route: 404 `ROUTE_NOT_FOUND`
  - Prisma unique violation on email: 409 `EMAIL_ALREADY_EXISTS`
  - rate limit: 429 `RATE_LIMITED`
  - anything else: 500 `INTERNAL_ERROR` with a generic message
- 5xx errors are logged with stack traces and the request id; responses never include stack traces, SQL, Prisma messages, tokens or passwords.
- Error codes are defined once in `packages/shared`.

**Clients**
- The API client converts every failure into one client error type: API errors keep their `code`; a failed connection becomes `NETWORK_ERROR`; an aborted slow request becomes `TIMEOUT`.
- One function maps client error codes to user messages.
- `401` triggers the session-expired flow; `NETWORK_ERROR`/`TIMEOUT` show an offline or "server is starting" message with Retry.

## Alternatives considered

- **Handling errors in each route with try/catch:** repetitive and easy to make inconsistent.
- **Returning only HTTP status and message:** clients would need to parse message text to tell `TOKEN_EXPIRED` from other 401s.
- **RFC 9457 problem details** (`application/problem+json`): a formal standard. A smaller custom shape with `code`, `message` and `details` covers the needs here; the choice can be revisited in Phase 4 without affecting the architecture.

## Decision rationale

One middleware is the only place that decides what leaves the server, which makes "no internal details in responses" easy to verify. Stable codes let both clients implement the required flows without depending on message wording.

## Tradeoffs

- Every new error case must be added to the shared code list.
- Generic 500 messages give users less detail; the request id in logs and response headers links a report to the server log.

## Consequences

- Phase 4 fixes the error JSON and the full code list.
- Tests assert status and `code` for each category, and that 500 responses contain no internal details.
