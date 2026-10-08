# ADR-0010: Security architecture

- Status: accepted
- Date: 2026-10-08

## Context

Security requirements SEC-01 to SEC-11 cover authentication, ownership isolation, validation, injection, CSRF, rate limiting, headers, logging and secrets. The deployment adds two constraints: the API sits behind Render's proxy, and web requests additionally pass through Vercel's rewrite, so the connecting address for web requests is a Vercel address shared by many users.

## Decision

| Area | Measure |
|---|---|
| Passwords | bcryptjs cost 12; 8 to 72 bytes; hash never selected into responses |
| Tokens | ADR-0003 (HS256, pinned algorithm, 7 days, `jti` revocation); `JWT_SECRET` at least 32 random bytes |
| Authorization | Ownership condition inside every project/task query; 404 for foreign resources; owner always from the token |
| Validation | Shared Zod schemas on body, params and query; strict objects reject unknown fields (blocks mass assignment); 100 kb JSON limit |
| Injection | Prisma query API only; no string-built SQL |
| CSRF | `SameSite=Lax` cookie + global origin check for `POST`/`PUT`/`DELETE` (ADR-0004) |
| CORS | Allowlist from `CORS_ALLOWED_ORIGINS`; credentials only for listed origins; no wildcard |
| Headers | helmet defaults; relaxed Content Security Policy only on `/api/docs` for Swagger UI |
| Rate limiting | `express-rate-limit`. Login: strict limit keyed by client IP + normalized email, plus a looser per-IP limit. Register: per-IP limit. 429 with `RATE_LIMITED` |
| Proxy awareness | `trust proxy` set to exactly the number of proxies in front of the API (`TRUST_PROXY_HOPS`, 1 on Render). Never `true`, which would let clients spoof their IP through `X-Forwarded-For` |
| Web token | `HttpOnly; Secure; SameSite=Lax` cookie; never in a response body for web |
| Mobile token | SecureStore only; mobile response mode refused when an `Origin` header is present |
| Logging | pino redaction of authorization headers, cookies, `Set-Cookie`, passwords, tokens; no request bodies logged |
| Errors | Central handler; no stack traces or database details in responses (ADR-0009) |
| Secrets | Environment variables only, validated at startup; `.env` files git-ignored; no secrets in `EXPO_PUBLIC_*` |
| Transport | HTTPS on all deployed endpoints; database connections over TLS |
| Database surface | Supabase Data API disabled or RLS enabled; only the API connects |
| Dependencies | `pnpm audit` review before submission |

## Alternatives considered

- **Per-IP login limit only:** through the Vercel rewrite, all web users would share one limit, so a few failed logins could block everyone.
- **`trust proxy = true` to read the leftmost `X-Forwarded-For` value:** gets the original client IP when every proxy is trusted, but lets any client spoof its IP and bypass limits.
- **CSRF tokens (synchronizer or double-submit):** standard protection, but needs token issuing and storage on both sides. `SameSite=Lax` plus a strict origin check covers the same threats for this design with less code.
- **Account lockout after failed logins:** stops guessing but lets an attacker lock out any known email. Rate limiting slows guessing without that side effect.
- **Shared rate-limit store (Redis):** needed for several instances; the API runs as one instance.

## Decision rationale

Each measure maps to a requirement and to a test in the traceability matrix. Keying the strict login limit on email makes brute-force protection independent of how many proxies sit between the user and the API.

## Tradeoffs

- In-memory rate limits reset when the service restarts or sleeps.
- Per-IP limits for web traffic are effectively shared; they are set loosely and act only against bulk abuse.
- Origin checking relies on browsers sending `Origin` on unsafe requests, which all current browsers do.

## Consequences

- Phase 4 adds the rate-limit, origin and token error codes to the contract.
- Phase 8 verified that the deployed rewrite forwards `Origin` unchanged (ADR-0004). Client IP forwarding in `X-Forwarded-For` was not observable from outside; the rate limits do not depend on it.
- Phase 9 audited every row of this table against the code and tests: [security-audit.md](../security-audit.md).
