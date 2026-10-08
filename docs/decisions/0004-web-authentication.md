# ADR-0004: Web authentication through a same-origin API rewrite

- Status: accepted
- Validation: verified locally in Phase 6 with `next start`, and on the deployed Vercel rewrite in Phase 8 (2026-10-08, see [deployment.md](../deployment.md), section 9). Through `https://pm-system-harsha.vercel.app/api/*` the rewrite forwards `Origin` unchanged (a foreign origin gets 403 `ORIGIN_NOT_ALLOWED`, a cookie request without `Origin` gets 403) and passes `Set-Cookie` back unchanged. In Chrome the session cookie `pm_session` is stored for the Vercel host only (no `Domain`), with `HttpOnly; Secure; SameSite=Lax; Path=/`; `document.cookie` cannot read it, no token is kept in web storage, and the browser never contacts the API host directly. Login, `GET /api/auth/me`, CRUD, dashboard and logout (cookie cleared, token revoked) work through the rewrite. The rewrite runs on Vercel's edge, not in a serverless function. Whether Vercel adds the client address to `X-Forwarded-For` is not observable without logging it; the rate-limit design does not depend on it (ADR-0010). The route-handler fallback was not needed.
- Date: 2026-10-08

## Context

The web app must keep the JWT in an `HttpOnly; Secure; SameSite=Lax` cookie that browser JavaScript cannot read (AUTH-09). The web app is hosted on Vercel (`*.vercel.app`) and the API on Render (`*.onrender.com`). These are different sites. A cookie set by the API domain is a third-party cookie from the web app's point of view: `SameSite=Lax` cookies are not sent on the web app's cross-site `fetch` calls, and `SameSite=None` cookies are blocked by Safari and restricted in other browsers.

## Decision

- `next.config` rewrites `/api/:path*` to `${API_ORIGIN}/api/:path*`. The browser only talks to the web domain; Vercel forwards the request to Render and passes the response back, including `Set-Cookie`.
- The cookie is host-only on the web domain: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`, no `Domain` attribute.
- Web login/register responses contain the user but never the token.
- CSRF protection: `SameSite=Lax` plus a global origin check in the API for `POST`, `PUT`, `DELETE` (see the architecture document, sections 5 and 9).
- Protected pages: the Next.js request interceptor (the `middleware`/`proxy` file convention of the pinned version) redirects to `/login` when the cookie is missing. It does not verify the token; the API does.
- Authentication state on the client comes from `GET /api/auth/me`. A 401 anywhere clears the query cache and redirects to `/login?reason=session-expired`.
- Local development uses the same rewrite (`API_ORIGIN=http://localhost:<api port>`), so development behaves like production.

## Alternatives considered

- **Browser calls the API domain directly with `SameSite=None; Secure` cookies and CORS credentials:** blocked by Safari's third-party cookie rules and fragile elsewhere.
- **Token in `localStorage` with a Bearer header:** readable by any script on the page (XSS exposure); rejected by the requirement that the web JWT is not exposed to JavaScript.
- **Custom domain with web and API on subdomains of one site:** would make the cookie first-party without a proxy, but requires buying and managing a domain. Not needed for the assessment.
- **Next.js route handler proxy** (`app/api/[...path]/route.ts`) that forwards requests in code: gives full control over forwarded headers. Kept as the fallback if the rewrite turns out to drop headers that the API needs.
- **Backend-for-frontend:** Next.js stores the JWT server-side and keeps its own session. Duplicates authentication logic in two services.
- **Verifying the JWT in the Next.js interceptor:** would need `JWT_SECRET` on Vercel as well, spreading the secret to a second service for a check that only affects redirects.

## Decision rationale

The rewrite turns the API into a same-origin endpoint with a single configuration entry, keeps the cookie first-party in every browser, and needs no extra server code. Authentication logic stays only in the API.

## Tradeoffs

- Every web API call has an extra network hop through Vercel.
- The API sees Vercel's IP as the connecting address for web requests; rate limiting is designed around this (ADR-0010).
- Header forwarding by the rewrite (`Origin`, `Set-Cookie`) was verified on the real deployment (Phase 8).

## Consequences

- `API_ORIGIN` is a server-side variable on Vercel; no `NEXT_PUBLIC_*` variable is needed.
- Login, cookie storage, the origin check and logout were verified through the deployed rewrite in Phase 8; the route-handler fallback remains documented but unused.
- Cookie name and attributes are finalized in Phase 4.
