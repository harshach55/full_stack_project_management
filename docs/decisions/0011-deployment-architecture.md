# ADR-0011: Deployment architecture

- Status: accepted, with pending validation
- Validation (Phase 8, 2026-10-08): Supabase project in Singapore (`ap-southeast-1` pooler) with the Data API disabled; the first migration applied manually with `prisma migrate deploy` and verified before the API was deployed; Render web service in Singapore on Node 24.11.1 (from `.nvmrc`, confirmed in the build log), auto-deploy off, health check `/api/health`; Vercel project with root `apps/web` on Node 24.x, `API_ORIGIN` set for Production only. The rewrite runs at Vercel's edge; the function region was changed from the default `iad1` to Singapore (`sin1`), so server-rendered pages also run next to the API (observed in the `X-Vercel-Id` header after redeploying). Settings and results: [deployment.md](../deployment.md).
- Pending validation: the EAS build profile and the Node version used for EAS builds (release build phase).
- Date: 2026-10-08

## Context

Hosting is fixed: Vercel (web), Render (API), Supabase (database), Expo EAS (Android build). The assessment needs public URLs for web and API and an installable Android build. Free plans are expected, which brings sleep/pause behavior and fewer deployment features (Render's pre-deploy command is not available on free instances). All three apps build from one monorepo.

Schema changes must reach the production database in a controlled way: each migration is applied and verified before the API code that depends on it is deployed.

## Decision

**Region**
- Singapore for both Render and Supabase, if the region is available on the selected plans. Availability is verified when the services are created; if Singapore is not available on one of them, the closest available region is chosen for both and the choice is recorded in the deployment documentation.

**Supabase**
- One project for the deployed environment.
- `DATABASE_URL`: pooler, transaction mode (runtime). `DIRECT_URL`: session pooler or direct connection (migrations only).
- Data API disabled (or RLS enabled on all tables).

**Production migrations (controlled, manual)**
- Migrations are never applied by the Render build or at server start.
- They are applied from a developer machine with `prisma migrate deploy`, using `DIRECT_URL` from a local, git-ignored environment file (`apps/api/.env.production`, through `pnpm --filter @pm/api db:prod:deploy`). Production credentials are never committed.
- Before applying: `prisma migrate status` shows which migrations are pending.
- After applying: `prisma migrate status` reports the schema as up to date, and the expected tables and columns are checked in Supabase.
- Migrations are written to be compatible with the currently running API version (add first, remove later), because the database is updated before the new API is deployed.

**Render (API)**
- Web service from the repository root. Build command installs with pnpm (frozen lockfile, including devDependencies with `--prod=false`), builds `shared`, generates the Prisma client and builds `api`. It does not run migrations.
- Start command `node dist/server.js` (from `apps/api`). Health check path `/api/health`.
- Auto-deploy is turned off; deployments are triggered manually after the migration step has been verified.
- Environment: the API variables from the architecture document with `NODE_ENV=production`, `TRUST_PROXY_HOPS=1`, `COOKIE_SECURE=true` and `NODE_EXTRA_CA_CERTS` pointing to the Supabase root CA (ADR-0007). `DIRECT_URL` is not needed on Render.

**Vercel (web)**
- Project root `apps/web`, pnpm workspace install, `shared` built before the web build.
- `API_ORIGIN` set to the Render URL; used by the `/api/:path*` rewrite.

**EAS (mobile)**
- Build profile that produces an APK (EAS builds an Android App Bundle by default, which cannot be installed directly).
- `EXPO_PUBLIC_API_URL` set to the HTTPS Render URL in that profile.
- APK distributed through the EAS build link or a GitHub release.

**Node version**
- One Node version (Node 24 LTS) locally, on Render, on Vercel and for EAS builds. Its compatibility with the pinned Prisma 6, Next.js, Expo SDK and tooling versions is verified when each app is scaffolded; if a pinned version does not support it, the whole project moves to a supported LTS version together.

**Deployment sequence** (initial deployment and every release that contains a migration)

1. Database available (Supabase project reachable).
2. Apply migration (`prisma migrate deploy` with `DIRECT_URL`).
3. Verify migration (`prisma migrate status`, tables and columns checked).
4. Deploy API (manual Render deploy).
5. Verify `GET /api/health` returns 200 with the database reported as ok.
6. Deploy web (Vercel, `API_ORIGIN` pointing to the verified API).
7. Build mobile APK (EAS, `EXPO_PUBLIC_API_URL` pointing to the verified API).
8. Run integration/demo verification: register/login on web and mobile with the same account, create a task on one platform and see it on the other, check logout independence and the session-expired flow.

Before a demo or review: call `/api/health` to wake the API and confirm the database.

## Alternatives considered

- **`prisma migrate deploy` in the Render build command:** fully automatic, but a migration could be applied by a build that later fails, leaving the database ahead of the running code, and schema changes would happen on every push without a review step.
- **Render pre-deploy command:** the platform's intended place for migrations, but not available on free instances.
- **Running migrations at server start:** every restart, including wake-up from sleep, would run them, and a failure would block the API from starting.
- **CI job that applies migrations:** automated and auditable, but requires a CI pipeline (optional feature) and production database credentials stored in CI.
- **Docker image deployment on Render:** more control, but adds an image build to maintain; the native Node environment is sufficient. Docker is used only for the local test database.

## Decision rationale

Manual, verified migrations make each schema change an explicit, reviewable step that happens before the code depending on it is deployed. For a project with few migrations and one maintainer, the extra manual step costs little and avoids builds changing the production database.

## Tradeoffs

- The migration step can be forgotten; the deployment sequence and the `/api/health` check after deploy reduce that risk, and the README lists the steps.
- Production database credentials must be available on the machine that runs migrations (in a git-ignored file).
- Migrations must remain compatible with the previous API version during the gap between migration and deploy.
- Free-tier sleep (Render) and inactivity pause (Supabase) affect first-request latency and availability during review.
- The API URL is fixed inside the APK; changing it requires a new build.

## Consequences

- [deployment.md](../deployment.md) documents each platform's settings and the deployment sequence step by step.
- An Expo account and a first APK test build are prepared early (Phase 7) to avoid queue delays near the deadline.
- If the rewrite header verification (ADR-0004) fails, the web deployment switches to the route-handler proxy.
