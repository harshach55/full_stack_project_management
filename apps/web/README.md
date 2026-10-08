# Web app (`apps/web`)

Next.js (App Router) + TypeScript + Tailwind CSS + TanStack Query. It uses the same REST API and database as the Android app. Architecture: [docs/architecture.md](../../docs/architecture.md) (sections 9 and 16), [ADR-0004](../../docs/decisions/0004-web-authentication.md), [ADR-0012](../../docs/decisions/0012-client-application-architecture.md).

## How it talks to the API

- The browser only calls this app's own origin. `next.config.ts` rewrites `/api/:path*` to the Express API at `API_ORIGIN`, so the session cookie (`pm_session`, httpOnly, SameSite=Lax) is first-party.
- The app never sees the JWT: it is not in any response body, not in `localStorage`/`sessionStorage`, and not readable by JavaScript. Requests use `credentials: 'include'`; no `Authorization` header is ever sent.
- Who is logged in comes from `GET /api/auth/me`. Any 401 (`UNAUTHENTICATED`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`) clears cached data and returns to `/login` (with "Your session has expired" for expired or revoked sessions). There are no refresh tokens.
- `src/proxy.ts` redirects protected pages to `/login` when no session cookie exists at all. It does not verify the token; the API does.

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `API_ORIGIN` | `apps/web/.env.local` (git-ignored), or the hosting platform | Origin of the Express API, for example `http://localhost:4000` locally. Server-side only (no `NEXT_PUBLIC_` prefix); read when the app is built. Defaults to `http://localhost:4000` in development; required for production builds. |

The web app holds no secrets. See [`.env.example`](.env.example).

## Local development

Start the API first (see [apps/api/README.md](../api/README.md)), then from the repository root:

```bash
pnpm --filter @pm/shared build   # the web app imports the compiled shared package
pnpm --filter @pm/web dev        # http://localhost:3000
```

The API's `CORS_ALLOWED_ORIGINS` must include `http://localhost:3000` (the origin the Origin check expects), and `COOKIE_SECURE=false` is needed for the cookie over plain HTTP locally.

## Scripts (`pnpm --filter @pm/web <script>`)

| Script | Purpose |
|---|---|
| `dev` | Development server on port 3000 |
| `build` | Production build (set `API_ORIGIN`) |
| `start` | Run the production build on port 3000 |
| `typecheck` | Type-check sources and tests |
| `test` | Component and unit tests (Vitest, Testing Library, jsdom) |

## Structure

```
src/
  app/                  routes: (auth)/login, (auth)/register, (app)/dashboard, (app)/projects/..., (app)/tasks/...
  components/ui/        buttons, form fields, dialog, loading/empty/error states
  components/layout/    header with navigation and logout
  features/auth/        API calls, session hooks, login/register forms, AuthGate
  features/dashboard/   the six statistics from GET /api/dashboard
  features/projects/    list with search/filter, detail, form, delete confirmation
  features/tasks/       list with search/filters, detail, form, quick actions, full-PUT body builder
  lib/                  API client, error messages, query client, query keys, dates, form helpers
  providers/            TanStack Query provider
  proxy.ts              redirect to /login when there is no session cookie
tests/                  Vitest + Testing Library tests (fetch is mocked; no API needed)
```

## Notes

- Validation uses the shared Zod schemas from `packages/shared`; the API validates again and is authoritative.
- Task updates always send the complete editable representation (`name`, `description`, `priority`, `status`, `dueDate`) through `PUT`, including quick actions; `projectId` is never sent and cannot be changed.
- Search and filters are sent to the API as query parameters; nothing is filtered locally. Typing is debounced (300 ms); clearing the search applies immediately.
