# Project Management System

A project and task management application with a responsive web app and an Android app. Both clients use one REST API and one PostgreSQL database, so the same account sees the same data on both.

Users register and log in, manage their projects (name, description, status, start and end dates) and the tasks inside them (name, description, priority, status, due date), search and filter both, and see a dashboard of their own counts. Every user sees only their own data.

## Live deployment

| Component | Address |
|---|---|
| Web app (Vercel) | https://pm-system-harsha.vercel.app |
| API (Render) | Base URL `https://pm-api-lb5m.onrender.com`, all routes under `/api` (the bare origin returns 404) |
| API documentation (Swagger UI) | https://pm-api-lb5m.onrender.com/api/docs |
| OpenAPI JSON (live) | https://pm-api-lb5m.onrender.com/api/docs.json |
| OpenAPI JSON (exported) | [docs/openapi.json](docs/openapi.json) |
| Database | Supabase PostgreSQL, Singapore region; the clients never connect to it directly, only the API does |

The API runs on Render's free tier and sleeps after inactivity, so the first request can take about a minute. Open https://pm-api-lb5m.onrender.com/api/health first to wake it. The free Supabase project pauses after a long period of inactivity; the health response then reports `"database":"unavailable"` until the project is resumed in the Supabase dashboard.

## Android release

| Item | Value |
|---|---|
| Release | [v0.1.0 on GitHub](https://github.com/harshach55/full_stack_project_management/releases/tag/v0.1.0) |
| APK | [project-manager-v0.1.0.apk](https://github.com/harshach55/full_stack_project_management/releases/download/v0.1.0/project-manager-v0.1.0.apk) |
| Version | 0.1.0 (versionCode 1) |
| Package | `com.harshach55.projectmanager` |
| SHA-256 | `c167b270ee8f1cdc909337254b489dc11559f605b573f46e8464b23b271c9c03` |
| EAS build | `8ea20e9b-2d0d-4973-a703-b42e124cc25c` |

The APK talks to the production API above. To install it, download it on an Android phone and allow installation from that source when asked. Build details and the device checks it passed are in [docs/deployment.md](docs/deployment.md#release-build-eas).

## Submission deliverables

All seven deliverables listed in the assessment are complete.

| # | Deliverable | Status | Location |
|---|---|---|---|
| 1 | Public GitHub repository | Completed | https://github.com/harshach55/full_stack_project_management |
| 2 | Database schema / ER diagram | Completed | [docs/database-design.md](docs/database-design.md#5-entity-relationship-diagram), section 5; Prisma schema in [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma) |
| 3 | API documentation | Completed | [Swagger UI](https://pm-api-lb5m.onrender.com/api/docs), [OpenAPI JSON](https://pm-api-lb5m.onrender.com/api/docs.json), exported [docs/openapi.json](docs/openapi.json), [API contract](docs/api-contract.md) |
| 4 | README | Completed | This file |
| 5 | Web and backend deployment URLs | Completed | [Live deployment](#live-deployment) |
| 6 | Android APK | Completed | [Android release](#android-release) |
| 7 | Five-minute screen recording | Completed and submitted | Video demonstration: Submitted separately |

## Technology

| Area | Stack |
|---|---|
| Web | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, TanStack Query 5 |
| Mobile | Expo SDK 57, React Native 0.86, Expo Router, Expo SecureStore, NetInfo, TanStack Query 5 |
| API | Node.js 24, Express 5, TypeScript, Prisma 6 with the pg driver adapter, pino, helmet |
| Shared | Zod 4 schemas, enums, types and error codes in `packages/shared`, used by all three apps |
| Database | PostgreSQL 17 (Supabase in production, Docker locally) |
| API docs | OpenAPI 3.0 generated from the shared Zod schemas, served with Swagger UI |
| Tests | Vitest, Supertest (API against a real test database), Testing Library (web) |
| Hosting | Vercel (web), Render (API), Supabase (database), Expo EAS Build (APK) |
| Tooling | pnpm 10 workspaces |

Authentication: the web app uses an httpOnly session cookie through a same-origin `/api` rewrite; the Android app sends a Bearer token kept in SecureStore. Logging out on one device does not log out the other. Details are in [docs/architecture.md](docs/architecture.md).

## Repository layout

```
apps/
  api/        Express REST API, Prisma schema and migrations, API tests
  web/        Next.js web app
  mobile/     Expo Android app and EAS build profile
packages/
  shared/     Zod schemas, enums, types and error codes
docs/         requirements, architecture, ADRs, API contract, deployment, testing, security, OpenAPI export
docker-compose.yml   local PostgreSQL for development and tests (the apps are not containerized)
```

## Local setup

Prerequisites:

- Node.js 24.11.1 (see [`.nvmrc`](.nvmrc))
- pnpm 10.34.6 through Corepack: run `corepack enable` once, or prefix pnpm commands with `corepack`
- Docker, for the local PostgreSQL
- For the Android app: an Android phone with Expo Go (SDK 57) on the same Wi-Fi, or an Android emulator

Steps, from the repository root:

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Copy [`.env.example`](.env.example) to `.env` and choose a value for `PM_LOCAL_DB_PASSWORD`.
3. Start PostgreSQL. It creates the `pm_dev` and `pm_test` databases on `localhost:5433` on first start:
   ```bash
   pnpm db:up
   ```
4. Copy [`apps/api/.env.example`](apps/api/.env.example) to `apps/api/.env` and set `DATABASE_URL`, `DIRECT_URL` (both pointing at `pm_dev`) and `JWT_SECRET`. The template explains each value and how to generate the secret; the other defaults work for local development.
5. Build the shared package, generate the Prisma client and apply the migrations:
   ```bash
   pnpm --filter @pm/shared build
   pnpm --filter @pm/api db:generate
   pnpm --filter @pm/api db:migrate:deploy
   ```
6. Start the API (http://localhost:4000, Swagger UI at http://localhost:4000/api/docs):
   ```bash
   pnpm --filter @pm/api dev
   ```
7. In a second terminal, start the web app (http://localhost:3000). It forwards `/api` to `http://localhost:4000` by default:
   ```bash
   pnpm --filter @pm/web dev
   ```
8. For the Android app, copy [`apps/mobile/.env.example`](apps/mobile/.env.example) to `apps/mobile/.env.local`, set `EXPO_PUBLIC_API_URL` (your computer's LAN address for a phone, `http://10.0.2.2:4000` for an emulator, or the production API), then:
   ```bash
   pnpm --filter @pm/mobile start
   ```
   Scan the QR code with Expo Go, or press `a` for a running emulator.

More detail, including troubleshooting, is in each app's README: [API](apps/api/README.md), [web](apps/web/README.md), [mobile](apps/mobile/README.md).

## Tests

The API tests need the local PostgreSQL (`pnpm db:up`) and `apps/api/.env.test`, copied from [`apps/api/.env.test.example`](apps/api/.env.test.example) with `TEST_DATABASE_URL` pointing at `pm_test`. They refuse to run against anything other than a local database whose name ends in `_test`.

```bash
pnpm test                                  # all packages
pnpm --filter @pm/api test                 # API only (also @pm/web, @pm/mobile, @pm/shared)
pnpm --filter @pm/api test:coverage        # API with coverage
pnpm typecheck                             # all packages
pnpm --filter @pm/api docs:openapi:check   # docs/openapi.json matches the generated document
```

Latest full run: 245 tests passed (API 146, web 48, mobile 33, shared 18); API line coverage 97%. Suites, coverage and the manual, device and production checks are in [docs/testing.md](docs/testing.md).

## API documentation

The OpenAPI document is generated from the same shared Zod schemas the API uses for validation. The running API serves it at `/api/docs.json` and as Swagger UI at `/api/docs`. A copy is committed as [docs/openapi.json](docs/openapi.json) for use without a running server. After changing an endpoint or schema, rebuild the shared package and regenerate the file:

```bash
pnpm --filter @pm/shared build
pnpm --filter @pm/api docs:openapi
```

The full contract, including error codes and rate limits, is in [docs/api-contract.md](docs/api-contract.md).

## Android release build

The APK is built in the cloud by EAS Build with the `preview` profile in [`apps/mobile/eas.json`](apps/mobile/eas.json), which sets APK output and the production API address. EAS commands must be run from `apps/mobile`, never from the repository root (from the root, EAS ignores the profile and the build fails):

```bash
cd apps/mobile
npx eas-cli@24.12.0 login
npx eas-cli@24.12.0 build -p android --profile preview
```

Signing keys are stored by EAS, not in the repository. See [docs/deployment.md](docs/deployment.md#release-build-eas).

## Deployment

Production setup for Supabase, Render, Vercel and EAS, the manual migration procedure, environment variables, verification results and rollback steps are in [docs/deployment.md](docs/deployment.md). No secrets are stored in the repository.

## Documentation

- [Documentation index](docs/README.md)
- [Requirements](docs/requirements.md), [scope and decisions](docs/scope-and-decisions.md), [traceability matrix](docs/traceability-matrix.md), [user flows](docs/user-flows.md)
- [Architecture](docs/architecture.md) and [architecture decision records](docs/decisions/)
- [Database design](docs/database-design.md) (includes the ER diagram)
- [API contract](docs/api-contract.md), [backend design](docs/backend-design.md), [OpenAPI JSON](docs/openapi.json)
- [Deployment](docs/deployment.md)
- [Testing](docs/testing.md)
- [Security audit](docs/security-audit.md)
