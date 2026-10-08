# ADR-0003: JWT access tokens with per-token revocation

- Status: accepted
- Date: 2026-10-08

## Context

Requirements: JWT authentication, bcryptjs with cost 12, 7-day sessions without refresh tokens (PD-14), logout that ends only the current session so web and mobile stay independent (PD-18), expired tokens rejected with a distinguishable error so mobile can show a session-expired message (MOB-10).

A plain JWT stays valid until it expires, so logout needs server-side state.

## Decision

- **Token:** JWT signed with HS256 using `JWT_SECRET`. Claims: `sub` (user id), `jti` (random UUID per issued token), `iat`, `exp` (7 days). No personal data in the token.
- **Verification:** signature, `algorithms: ['HS256']` only, expiry. Expired tokens return 401 `TOKEN_EXPIRED`; revoked tokens return 401 `TOKEN_REVOKED` (refined in ADR-0014); any other failure returns 401 `UNAUTHENTICATED`.
- **Revocation:** a `RevokedToken` table (`jti` primary key, `userId`, `expiresAt`). Logout inserts the current token's `jti`. The authenticate middleware rejects tokens whose `jti` is in the table. Rows are deleted after `expiresAt` passes, because an expired token is rejected anyway.
- **Token source:** `Authorization: Bearer` header first, otherwise the session cookie. One middleware handles both clients.
- **Passwords:** bcryptjs, cost 12, input limited to 72 bytes (bcrypt ignores bytes after 72). Login compares against a dummy hash when the email is unknown, so response time does not reveal which emails exist.
- **Registration** issues a token immediately (PD-16). Uniqueness is enforced by the database unique index; the conflict is mapped to 409.
- **JWT library:** `jsonwebtoken`, with the algorithm explicitly pinned on verify.

## Alternatives considered

- **Stateless JWT, logout only deletes the token on the client:** no database lookup per request, but a copied token would keep working for up to 7 days after logout. Rejected: logout should end the session on the server.
- **Session allowlist table** (row per login, token carries a session id): supports "log out all devices" and listing sessions. Every login writes a row and the table grows with logins instead of logouts. Neither extra feature is required. A denylist is the smaller design that meets the requirement and matches the agreed "token revocation data" approach.
- **Opaque session ids instead of JWT:** simpler revocation, but the stack specifies JWT.
- **Refresh tokens with short access tokens:** better for long-lived sessions; out of scope (PD-14, optional feature).
- **`jose` instead of `jsonwebtoken`:** modern and standards-focused; either works in Node. `jsonwebtoken` is chosen for its simple API and wide usage; nothing else in the design depends on this choice.

## Decision rationale

The denylist gives real per-token logout with one primary-key lookup per request and stores data only for logged-out tokens that have not expired yet. Using `jti` per token makes web and mobile sessions independent by construction.

## Tradeoffs

- Every authenticated request costs one indexed database lookup. Acceptable at this scale.
- Without an allowlist there is no "log out everywhere" feature.
- Changing a password (not in scope) would not invalidate existing tokens.

## Consequences

- Phase 3 adds the `RevokedToken` model.
- Phase 4 defines the error codes `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `INVALID_CREDENTIALS` (ADR-0014).
- Phase 5 implements the cleanup of expired revocation rows (on startup and on an interval). Note: this cleanup was deferred in Phase 5 and is not implemented; expired rows are harmless ([backend-design.md](../backend-design.md), section 16).
- Tests sign tokens with a past expiry to cover `TOKEN_EXPIRED`.
