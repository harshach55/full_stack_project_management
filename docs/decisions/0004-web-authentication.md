# ADR-0004: Web authentication through a same-origin API rewrite

- Status: accepted, with pending validation
- Pending validation: header forwarding through the deployed Vercel rewrite (`Origin`, `Set-Cookie`, client IP); the route-handler proxy is the fallback if it fails (Phase 8 and 10).
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
- Header forwarding by the rewrite (`Origin`, `Set-Cookie`, `X-Forwarded-For`) must be verified on the real deployment.

## Consequences

- `API_ORIGIN` is a server-side variable on Vercel; no `NEXT_PUBLIC_*` variable is needed.
- Phase 8/10 includes a check that login, cookie storage, the origin check and logout work through the deployed rewrite; if not, switch to the route-handler fallback.
- Cookie name and attributes are finalized in Phase 4.
