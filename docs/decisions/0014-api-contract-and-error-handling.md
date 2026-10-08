# ADR-0014: API contract and error handling details

- Status: accepted
- Date: 2026-10-08

## Context

ADR-0006 set the REST conventions and ADR-0009 the error-handling approach, leaving exact bodies, codes and edge cases to Phase 4. Phase 5 needs a contract precise enough that implementation makes no API decisions. The full contract is [api-contract.md](../api-contract.md); the implementation blueprint is [backend-design.md](../backend-design.md).

## Decision

1. **Success bodies without a wrapper.** Resources are plain objects, lists are plain arrays (`[]` when empty, as PD-11 states), auth endpoints return `{ user }` or `{ user, token, expiresAt }`. Status codes: 200 read/update, 201 create, 204 delete and logout.
2. **One error body:** `{ "error": { "code", "message", "details"?, "requestId" } }`. `details` lists `{ location, path, message }` and appears only for validation errors.
3. **Final error code list:** `VALIDATION_ERROR`, `INVALID_JSON`, `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `INVALID_CREDENTIALS`, `ORIGIN_NOT_ALLOWED`, `NOT_FOUND`, `ROUTE_NOT_FOUND`, `EMAIL_ALREADY_EXISTS`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `RATE_LIMITED`, `INTERNAL_ERROR`.
4. **Revoked tokens get their own code (`TOKEN_REVOKED`).** This refines ADR-0003, ADR-0009 and architecture section 7, which grouped revoked tokens under `UNAUTHENTICATED`; those documents are updated to match. Clients still handle all 401s the same way.
5. **Credential precedence:** an `Authorization` header, if present, is the only credential considered (no fallback to the cookie); otherwise the `pm_session` cookie.
6. **Mobile response mode:** `X-Client-Type: mobile` on login/register returns the token in the body only when the request has no `Origin` header; with an `Origin` header the request is rejected with 403 `ORIGIN_NOT_ALLOWED`. Other header values are a 400.
7. **Full-replacement `PUT`:** every editable field is a required key, optional values as `null`. Task `PUT` bodies must not contain `projectId` at all (400, even with the current value).
8. **Strict input:** unknown keys in bodies and unknown or repeated query parameters are rejected; server-owned fields are never accepted.
9. **Dashboard fields:** `totalProjects`, `projectsInProgress`, `totalTasks`, `completedTasks`, `pendingTasks`, `inProgressTasks`. `projectsInProgress` is required by the assessment (DASH-01); `inProgressTasks` makes the task counts add up to `totalTasks`.
10. **No pagination, fixed newest-first order, no sort parameter.**
11. **Rate limits** (defaults, configurable): login 5 failed attempts per IP and email per 15 minutes, login 50 per IP per 15 minutes, register 10 per IP per hour.
12. **Health** returns its own small body (`status`, `database`) with 200 or 503, outside the error format, because monitors read it.

## Alternatives considered

- **Response envelope (`{ "data": ... }`) for all success responses:** uniform and leaves room for metadata such as pagination. PD-11 already specifies an empty array for empty lists, and there is no metadata to carry because pagination is deferred. Plain bodies are simpler for both clients.
- **RFC 9457 problem details:** standard field names (`type`, `title`, `status`, `detail`). A custom shape with a stable `code` is simpler for the clients, which branch on one string; the shape can still be described fully in OpenAPI.
- **Revoked tokens reported as `UNAUTHENTICATED`:** what ADR-0003 originally stated. A separate code costs nothing, reveals nothing to someone who does not already hold the token, and makes logout behavior directly testable.
- **Falling back to the cookie when a Bearer token is invalid:** would let one request be authenticated by a credential the client did not intend to use and makes failures harder to understand.
- **Ignoring `X-Client-Type: mobile` when `Origin` is present (treating the request as web):** also safe, but hides client misconfiguration; an explicit 403 makes the rule visible and testable.
- **Accepting `projectId` in task `PUT` when it equals the current value:** closer to "full representation", but PD-08 states that `projectId` in an update is rejected, and a simpler rule is easier to test.
- **Ignoring unknown fields instead of rejecting them:** more tolerant of client drift, but hides mistakes and makes mass-assignment protection depend on the service code.
- **`DUPLICATE_EMAIL` as the conflict code:** equivalent; `EMAIL_ALREADY_EXISTS` was already used in the architecture documents and is kept.

## Decision rationale

The contract follows the Phase 1 decisions directly and resolves the remaining choices toward explicit, testable behavior: one credential per request, one error shape, one code per client-relevant situation, and rejection of anything unexpected.

## Tradeoffs

- Adding pagination later with plain arrays requires either headers (for example a total count header) or a new response shape.
- Strict validation means clients must send exactly the documented fields; older clients break if a field is removed from the contract.
- Fourteen error codes must be kept in sync between the API, the shared package and the OpenAPI document.

## Consequences

- `packages/shared` defines the error code list, request schemas and response types named in backend-design.md section 5.
- Phase 5 implements and tests every row of the backend-design.md test contract.
- ADR-0003, ADR-0009 and architecture.md are aligned with decision 4.
