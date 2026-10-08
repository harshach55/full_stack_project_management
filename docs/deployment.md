# Deployment

How the production environment is set up, configured and verified. Decisions and their reasons are in [ADR-0011](decisions/0011-deployment-architecture.md) (deployment), [ADR-0004](decisions/0004-web-authentication.md) (web authentication through the rewrite) and [ADR-0007](decisions/0007-database-access.md) (database access).

No secret values appear in this document or anywhere in the repository. Secrets are entered directly in the platform dashboards or in git-ignored local files.

## 1. Overview

| Component | Platform | Address | Region |
|---|---|---|---|
| Web app (Next.js) | Vercel | https://pm-system-harsha.vercel.app | Edge network; functions in Singapore (`sin1`) |
| API (Express) | Render, free web service | https://pm-api-lb5m.onrender.com (docs: `/api/docs`) | Singapore |
| Database (PostgreSQL 17) | Supabase | Connection pooler `aws-0-ap-southeast-1.pooler.supabase.com` | Singapore (`ap-southeast-1`) |
| Android app | Expo EAS Build, APK (section 7) | Uses the API address above | |

```
Browser  ->  Vercel (pages + /api/* rewrite)  ->  Render API  ->  Supabase pooler  ->  PostgreSQL
Android  ------------------------------------>  Render API
```

The browser only talks to the Vercel origin; the session cookie is first-party there (ADR-0004). The Android app calls the API directly with a Bearer token.

## 2. Deployment order

The order from ADR-0011, used for the first deployment and for every release that contains a migration:

1. Database available.
2. Apply the migration (`db:prod:deploy`, section 4).
3. Verify the migration (`db:prod:status`, `db:prod:check`).
4. Deploy the API on Render (manual deploy).
5. Verify `GET /api/health` returns 200 with `"database":"ok"`.
6. Deploy the web app on Vercel.
7. Build the Android APK against the API (section 7).
8. Smoke-test web and mobile (section 9).

## 3. Database (Supabase)

Project settings:

- Region: Singapore.
- Data API: disabled. The application never uses it, and the `public` schema holds the users table with password hashes. This must be off before the first migration.
- Settings > Database > SSL Configuration: "Enforce SSL on incoming connections" enabled.

Connection strings (dashboard: **Connect** > **Connection String** > type **URI**):

| Variable | Method in the dashboard | Port | Append | Used by |
|---|---|---|---|---|
| `DATABASE_URL` | Transaction pooler | 6543 | `?sslmode=verify-full` | Running API (Render) and `db:prod:check` |
| `DIRECT_URL` | Session pooler | 5432 | nothing required; the script enforces strict TLS | Migration commands only, never Render |

Replace `[YOUR-PASSWORD]` with the database password, without the brackets. A password made of letters and digits only needs no URL encoding.

The direct database host is IPv6-only and Render has no outbound IPv6, so both connections go through the pooler (ADR-0007).

### TLS and the Supabase CA certificate

The pooler presents a certificate for `*.pooler.supabase.com` issued by the Supabase Intermediate 2021 CA, which chains to the **Supabase Root 2021 CA**. That root is not in Node's default trust store, so a verified connection fails with "self-signed certificate in certificate chain" unless the root is trusted explicitly.

- [`apps/api/certs/prod-ca-2021.crt`](../apps/api/certs/prod-ca-2021.crt) is the public root certificate downloaded from Supabase (Settings > Database > SSL Configuration). It contains no private key. SHA-256 fingerprint: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`, valid until 2031-04-26.
- Runtime (pg driver): `sslmode=verify-full` checks the chain and the host name; `NODE_EXTRA_CA_CERTS=certs/prod-ca-2021.crt` adds the root to Node's trust store.
- Migrations (Prisma's migration engine): plain `sslmode=require` encrypts but does **not** verify the server. The migration script therefore always adds `sslaccept=strict&sslcert=../certs/prod-ca-2021.crt`.

Never use `sslmode=no-verify`, `uselibpqcompat`, `sslaccept=accept_invalid_certs` or `NODE_TLS_REJECT_UNAUTHORIZED`.

## 4. Production migrations

Migrations are applied manually from a developer machine, never by the Render build or at server start (ADR-0011).

1. Copy [`apps/api/.env.production.example`](../apps/api/.env.production.example) to `apps/api/.env.production` (git-ignored) and fill in both connection strings (section 3).
2. Use a network that allows outbound ports 5432 and 6543. Some campus and office networks block them; a phone hotspot works.
3. From the repository root:

```bash
pnpm --filter @pm/api db:prod:check    # connect like the running API, list tables
pnpm --filter @pm/api db:prod:status   # pending migrations
pnpm --filter @pm/api db:prod:deploy   # apply pending migrations
pnpm --filter @pm/api db:prod:status   # must report "Database schema is up to date!"
```

[`apps/api/scripts/prisma-production.mjs`](../apps/api/scripts/prisma-production.mjs) makes these commands safe to run:

- It reads connection settings only from `apps/api/.env.production` and passes them to Prisma as process variables. These take precedence over a local `apps/api/.env`, so a development database is never targeted by mistake (tested with decoy files and shell variables).
- It refuses `localhost` and loopback targets.
- It requires `sslmode=verify-full` for `DATABASE_URL` and forces strict verification against the Supabase CA for `DIRECT_URL`; weaker or bypassing TLS parameters stop the script.
- It prints the target host, port and database name, never a connection string or password.

`prisma migrate reset` and `prisma db push` are never used against production. Migrations must stay compatible with the API version that is running while they are applied (add first, remove later).

First production migration (2026-10-08): `20261008091951_init` applied to the empty database. Afterwards the production catalog (tables, columns, enums, indexes, constraints) was compared with a local database migrated from the same file and was identical.

## 5. API (Render)

Web service settings:

| Setting | Value |
|---|---|
| Repository and branch | `harshach55/full_stack_project_management`, `main` |
| Root directory | empty (repository root) |
| Language and instance | Node, Free |
| Region | Singapore |
| Build command | `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm --filter @pm/shared build && pnpm --filter @pm/api build` |
| Start command | `cd apps/api && node dist/server.js` |
| Health check path | `/api/health` |
| Auto-deploy | Off (deploy manually after the migration step) |
| Pre-deploy command | none |

Notes:

- `--prod=false` keeps devDependencies (TypeScript, Prisma CLI) installed when `NODE_ENV=production` is set; without it the build fails.
- The start command runs `node` directly (not through pnpm), so Render's `SIGTERM` reaches the server and the graceful shutdown runs.
- Node version comes from [`.nvmrc`](../.nvmrc) (24.11.1).

Environment variables:

| Variable | Value | Secret |
|---|---|---|
| `NODE_ENV` | `production` | no |
| `DATABASE_URL` | transaction pooler URL with `?sslmode=verify-full` | **yes** |
| `JWT_SECRET` | generated with Render's **Generate** button | **yes** |
| `JWT_EXPIRES_IN` | `7d` | no |
| `CORS_ALLOWED_ORIGINS` | `https://pm-system-harsha.vercel.app` (exact origin, no wildcard) | no |
| `COOKIE_SECURE` | `true` | no |
| `TRUST_PROXY_HOPS` | `1` | no |
| `NODE_EXTRA_CA_CERTS` | `certs/prod-ca-2021.crt` (relative to `apps/api`, the start directory) | no |

Not configured on Render: `DIRECT_URL`, `PORT` (Render provides it), rate-limit and log-level variables (defaults apply), and any TLS override.

`CORS_ALLOWED_ORIGINS` also drives the origin check for state-changing requests. Vercel preview URLs are deliberately not allowed.

## 6. Web (Vercel)

| Setting | Value |
|---|---|
| Repository and branch | `harshach55/full_stack_project_management`, `main` |
| Framework preset | Next.js |
| Root directory | `apps/web` (files outside the root directory are included, for the workspace) |
| Install command | default (pnpm, detected from the lockfile) |
| Build command | `pnpm --filter @pm/shared build && pnpm build` |
| Node.js version | 24.x |
| Function region (Settings > Functions) | Singapore (`sin1`) |
| Environment variable | `API_ORIGIN=https://pm-api-lb5m.onrender.com`, Production environment only |

- `API_ORIGIN` is not a secret and is not exposed to the browser (no `NEXT_PUBLIC_` prefix). The `/api/:path*` rewrite reads it at build time, so a change requires a new deployment.
- Without `API_ORIGIN` a production build fails on purpose; preview builds without it therefore fail instead of calling the production API from an origin the API rejects.
- The rewrite runs on Vercel's edge network (the nearest edge, `bom1` from India); API requests do not pass through a serverless function. Server-rendered pages run as functions in the project's function region, set to Singapore (`sin1`) next to the API. Vercel's default is `iad1` (US East); the `X-Vercel-Id` response header shows the regions in use (`<edge>::<function region>::<id>`).

## 7. Mobile

The app reads the API address from `EXPO_PUBLIC_API_URL` when the bundle is built (ADR-0005). For local testing against production, `apps/mobile/.env.local` (git-ignored) contains:

```
EXPO_PUBLIC_API_URL=https://pm-api-lb5m.onrender.com
```

Restart Expo with `--clear` after changing it; otherwise Metro can reuse a bundle built with the previous value. The address is public and the app holds no secrets.

### Release build (EAS)

The release APK is built in the cloud by EAS Build for the Expo project `@harsha_chodavarapu/project-manager` (project ID `32b2ac5d-a0a0-4024-a2f6-49cddd24ff0b`, linked in `apps/mobile/app.json`).

| Setting | Value |
|---|---|
| Configuration file | [`apps/mobile/eas.json`](../apps/mobile/eas.json), profile `preview` |
| Output | `android.buildType: apk` (the EAS default is an App Bundle, which cannot be installed directly) |
| Distribution | `internal` (installable from a link) |
| Node / pnpm on the build server | 24.11.1 / 10.34.6 |
| API address | `EXPO_PUBLIC_API_URL=https://pm-api-lb5m.onrender.com`, set in the profile `env` |
| Android package | `com.harshach55.projectmanager` |
| Version | `0.1.0` from `app.json` (`appVersionSource: local`), versionCode 1 |
| Signing | Keystore generated by EAS on the first build and stored by EAS (remote credentials); never in the repository |

Build command, run from `apps/mobile` after `npx eas-cli@24.12.0 login`:

```bash
cd apps/mobile
npx eas-cli@24.12.0 build -p android --profile preview
```

It must run from `apps/mobile`. Run from the repository root, EAS treats the root as the app: it creates a root `app.json` and `eas.json` (delete them, they are not part of the project), ignores the profile above and installs with the build image's default pnpm 8.7.5, which cannot read the version 9.0 lockfile and stops with "pnpm-lock.yaml is absent".

On the build server:

- EAS uploads the repository without git-ignored files and installs the whole workspace from the root with `pnpm install --frozen-lockfile`.
- `apps/mobile/.env.local` is git-ignored and not uploaded; the API address comes only from the profile.
- `packages/shared/dist` is git-ignored, so the `eas-build-post-install` script in `apps/mobile/package.json` runs `pnpm --filter @pm/shared build` before the app is bundled.

Release build of 2026-10-09:

| Item | Value |
|---|---|
| EAS build | `8ea20e9b-2d0d-4973-a703-b42e124cc25c`, profile `preview`, status finished |
| Source | Commit `31424cd` plus the EAS configuration, committed unchanged afterwards as `75932a2` |
| APK | https://expo.dev/artifacts/eas/txPUFKkccknWAyumw7dkcZ7-nguSs0O0c9fIemGCCuQ.apk (also attached to the GitHub Release `v0.1.0`) |
| Size | 99,568,528 bytes |
| SHA-256 | `c167b270ee8f1cdc909337254b489dc11559f605b573f46e8464b23b271c9c03` |

Checks on this build:

- Build log: Node 24.11.1 and pnpm 10.34.6 installed; frozen-lockfile install reported the lockfile up to date; the post-install hook built the shared package; Gradle build successful.
- APK file: valid archive with an APK signing block; the manifest package is `com.harshach55.projectmanager`.
- JavaScript bundle: contains `https://pm-api-lb5m.onrender.com` and no LAN address. The only other local addresses are text from libraries and from the app's own setup message (`10.0.2.2`), not request targets.
- Physical Android phone, APK installed from the EAS link, against the production API (section 9).

## 8. Secrets

| Secret | Where it lives |
|---|---|
| Database password, `DATABASE_URL`, `DIRECT_URL` | Supabase; Render (`DATABASE_URL` only); `apps/api/.env.production` on the machine that runs migrations |
| `JWT_SECRET` | Render only (generated there) |
| Android signing keystore | EAS only (remote credentials) |
| Supabase keys | Not used by the application |

Never committed: `.env`, `.env.local`, `.env.production` or any other filled-in environment file, connection strings with passwords, the JWT secret, platform tokens, and screenshots of dashboard values. `.gitignore` excludes all `.env.*` files except the `.example` templates.

## 9. Verification

Phase 8 checks against the live deployment (2026-10-08), run with fake `@example.com` accounts:

| Area | Result |
|---|---|
| Database | Strict TLS verified on both pooler ports (TLS 1.3, chain to the Supabase root); default trust store and a wrong CA are rejected |
| API direct, mobile mode | 51 checks passed: health, HTTPS redirect, HSTS, docs, error responses without internals, CORS allowlist, foreign `Origin` rejected, register, login, `me`, project and task CRUD, dashboard, ownership isolation (404), logout, revoked and tampered tokens |
| Web through the rewrite | 31 checks passed: pages, protected-page redirects, health and docs through the rewrite, `Set-Cookie` and `Origin` forwarded unchanged, cookie `pm_session` with `HttpOnly; Secure; SameSite=Lax; Path=/`, host-only, CRUD, dashboard, logout and revocation, client bundles free of secrets and of the API host |
| Function region | `X-Vercel-Id` shows `sin1` for server-rendered pages; web and browser checks rerun after the change: all passed |
| Real browser (Chrome) | 14 checks passed: login and logout through the UI, cookie stored for `pm-system-harsha.vercel.app` only, not readable by `document.cookie`, no token in web storage, browser never contacts Render directly |
| Android phone (Expo Go) | Login, dashboard, project and task reads and changes, session restore, logout and offline message work against the production API; changes appear on the web app and the other way round |

Phase 10 check of the release APK (2026-10-09), installed on a physical Android phone and used with the production API: the app launches; login, dashboard, project creation, task creation, task status and priority changes, and task search and filters work; changes made on the phone appear in the web app with the same account and the other way round; logging out on the web leaves the phone signed in; logout on the phone works; airplane mode shows the offline message. All 11 checks passed.

Before a demo, call `/api/health` to wake the API.

## 10. Rollback

- **API:** Render > the service > Events: roll back to the previous successful deploy. Configuration mistakes are fixed in Environment and redeployed.
- **Web:** Vercel > Deployments: promote the previous production deployment (Instant Rollback).
- **Database:** Prisma has no down migrations. Problems are fixed with a new forward migration. Because migrations are applied before the API that needs them and stay compatible with the running version, rolling back the API does not require a database rollback.

## 11. Free-tier behavior

- Render free services sleep after inactivity; the first request can take about a minute. Call `/api/health` first to wake the service.
- Supabase pauses free projects after a period of inactivity; keep the project active during review.
- Some networks block outbound PostgreSQL ports (section 4). This affects only migration commands from a developer machine, not the deployed API.
