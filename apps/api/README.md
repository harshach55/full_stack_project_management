# API (`apps/api`)

Express + TypeScript REST API shared by the web and Android clients. Contract: [docs/api-contract.md](../../docs/api-contract.md). Design: [docs/backend-design.md](../../docs/backend-design.md).

No connection strings, passwords or secrets are stored in this repository. Every developer supplies local values through git-ignored environment files (or shell variables), described below.

## Requirements

- Node.js 24 (see `.nvmrc`) and pnpm 10 through Corepack (`corepack enable`, or prefix commands with `corepack`)
- Docker (local PostgreSQL for development and tests)

## Environment variables

| File (git-ignored) | Template | Variables |
|---|---|---|
| `.env` (repository root) | [`.env.example`](../../.env.example) | `PM_LOCAL_DB_PASSWORD`: password for the local Docker PostgreSQL (your choice) |
| `apps/api/.env` | [`apps/api/.env.example`](.env.example) | `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` (required) and optional settings |
| `apps/api/.env.test` | [`apps/api/.env.test.example`](.env.test.example) | `TEST_DATABASE_URL` (required for tests), `TEST_DIRECT_DATABASE_URL` (optional) |

The local Docker PostgreSQL (from `docker-compose.yml`) listens on `localhost:5433`, user `pm`, password `PM_LOCAL_DB_PASSWORD`, with two databases:

| Placeholder | Database | Used by |
|---|---|---|
| `<LOCAL_DATABASE_URL>` | `pm_dev` | `DATABASE_URL` and `DIRECT_URL` in `apps/api/.env` |
| `<LOCAL_TEST_DATABASE_URL>` | `pm_test` | `TEST_DATABASE_URL` in `apps/api/.env.test` |

Each placeholder is a standard PostgreSQL connection URL built from those values (scheme `postgresql`, then user, password, host, port and database name). Percent-encode special characters in the password.

## Local setup

From the repository root:

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Create the root `.env` from `.env.example` and set `PM_LOCAL_DB_PASSWORD`.
3. Start PostgreSQL (creates `pm_dev` and `pm_test` on first start):
   ```bash
   pnpm db:up
   ```
4. Create `apps/api/.env` from `apps/api/.env.example`:
   - `DATABASE_URL=<LOCAL_DATABASE_URL>` and `DIRECT_URL=<LOCAL_DATABASE_URL>`
   - `JWT_SECRET=` a generated value (the command is in the template)
5. Build the shared package and apply migrations to `pm_dev`:
   ```bash
   pnpm --filter @pm/shared build
   pnpm --filter @pm/api db:migrate:deploy
   ```
6. Start the API:
   ```bash
   pnpm --filter @pm/api dev
   ```

The API runs on port 4000 under `/api`. Documentation: `/api/docs` (Swagger UI) and `/api/docs.json` (OpenAPI).

If you change `PM_LOCAL_DB_PASSWORD` after the first start, recreate the database volume (`docker compose down -v`), because PostgreSQL keeps the password it was initialized with.

## Scripts (`pnpm --filter @pm/api <script>`)

| Script | Purpose |
|---|---|
| `dev` | Run with reload (`tsx watch`) |
| `build` | Generate the Prisma client and compile to `dist/` |
| `start` | Run the compiled server |
| `typecheck` | Type-check sources and tests |
| `test` | Run the test suite against the local test database |
| `test:coverage` | Tests with a coverage report |
| `db:migrate:dev` | Create and apply a migration (local database only) |
| `db:migrate:deploy` / `db:migrate:status` | Apply / inspect migrations |

## Tests

1. Make sure PostgreSQL is running (`pnpm db:up`).
2. Create `apps/api/.env.test` from `apps/api/.env.test.example` and set `TEST_DATABASE_URL=<LOCAL_TEST_DATABASE_URL>`. Alternatively, export `TEST_DATABASE_URL` in your shell (shell values take precedence over the file).
3. Run:
   ```bash
   pnpm --filter @pm/api test
   ```

The test run applies all migrations to the test database first and generates its own JWT signing key. It stops with a setup message if `TEST_DATABASE_URL` is missing, and refuses to run unless the URL points to `localhost` (or `127.0.0.1`) and a database whose name ends in `_test`.

### Running the tests behind a transaction-mode pooler

Production uses Supabase's pooler in transaction mode. To run the same suite through a local PgBouncer configured the same way:

```bash
docker compose --profile pooler up -d pgbouncer
TEST_DATABASE_URL=<LOCAL_POOLED_TEST_DATABASE_URL> \
TEST_DIRECT_DATABASE_URL=<LOCAL_TEST_DATABASE_URL> \
pnpm --filter @pm/api test
```

`<LOCAL_POOLED_TEST_DATABASE_URL>` is the same as `<LOCAL_TEST_DATABASE_URL>` with port `6433` (PgBouncer). Migrations always use the direct connection.

## Migrations

- New migrations are created only against the local database (`db:migrate:dev`).
- The first migration contains hand-written `CHECK` constraints that Prisma cannot express; keep them when editing migrations.
- Production migrations are applied manually with `DIRECT_URL` and checked with `db:migrate:status` before and after; they are never run by the build or at server start (ADR-0011).
