# ADR-0007: Database access with Prisma 6 and Supabase PostgreSQL

- Status: accepted
- Validation: Phase 5 verified Prisma 6.19.3 with the engine-free client (`engineType = "client"`) and `@prisma/adapter-pg` 6.19.3; the full API test suite passes through a local PgBouncer in transaction mode with migrations over the direct connection; ownership-scoped update/delete with relation filters works; `prisma generate` needs no database variables. Phase 8 (2026-10-08) verified the live Supabase pooler in Singapore: the deployed API connects through the transaction pooler (port 6543) with `sslmode=verify-full`, and migrations run through the session pooler (port 5432). The pooler's certificate chain ends in the Supabase Root 2021 CA, which is not in Node's default trust store, so the public root certificate is committed (`apps/api/certs/prod-ca-2021.crt`) and trusted through `NODE_EXTRA_CA_CERTS`; Prisma's migration engine gets it through `sslaccept=strict` and `sslcert`. Without the CA, and with a wrong CA, both connections are rejected. Details: [deployment.md](../deployment.md), section 3.
- Date: 2026-10-08

## Context

The stack fixes PostgreSQL on Supabase and Prisma 6 with the pg driver adapter (engine-free client). The API runs on Render. Supabase's direct database host is IPv6-only, and Render does not support outbound IPv6, so the API must connect through Supabase's connection pooler (IPv4). Migrations need a session-level connection. Date-only fields must not shift across timezones (PD-03). Tests must not use the deployed database.

## Decision

- **Prisma version:** an exact Prisma 6 release that supports the engine-free client (`engineType = "client"`) with `@prisma/adapter-pg`. The exact version is pinned in Phase 5 after verifying the configuration; Prisma 7 is not used.
- **Connections:** runtime uses `DATABASE_URL` (Supabase pooler, transaction mode). Migrations use `DIRECT_URL` (session pooler or direct connection). One Prisma client instance per process (`lib/prisma.ts`).
- **TLS:** certificate and host name are always verified against the Supabase root CA (`sslmode=verify-full` at runtime; strict verification enforced by the production migration script). Verification is never disabled.
- **Schema conventions** (implemented in Phase 3):
  - UUID primary keys
  - foreign keys `Project.ownerId -> User.id`, `Task.projectId -> Project.id` (`ON DELETE CASCADE`), `RevokedToken.userId -> User.id`
  - tasks have no owner column; ownership is derived through the project
  - unique index on `User.email` (values stored lowercase)
  - PostgreSQL enums for project status, task status, task priority
  - `DATE` columns for `startDate`, `endDate`, `dueDate`; `timestamptz` for `createdAt` with a database default
  - indexes for owner-scoped and project-scoped list queries
- **Date handling:** the API converts `YYYY-MM-DD` strings to and from `DATE` values without local-time conversion; responses always return `YYYY-MM-DD`.
- **Queries:** Prisma query API only. Ownership conditions are part of every `where`. No raw SQL except the health check's `SELECT 1` through the parameterized tagged-template API.
- **Migrations:** `prisma migrate dev` locally to create migrations, committed to the repository. Production migrations are applied manually with `prisma migrate deploy` and verified before the API is deployed (ADR-0011); never by the build or at server start.
- **Supabase hardening:** the auto-generated Data API is disabled (or row level security enabled on all tables), because the application never uses it.
- **Test database:** a local disposable PostgreSQL in Docker, used only for tests. Never the Supabase database; a second Supabase project is used only if Docker turns out to be impossible.

## Alternatives considered

- **Prisma 7:** current major version, but the stack fixes Prisma 6 and the configuration differs significantly.
- **Prisma with the default Rust query engine (no driver adapter):** standard for Prisma 6, but the agreed plan is the engine-free client, which removes the native engine binary from the deployment.
- **Direct Supabase connection from Render:** not possible over IPv4 without a paid add-on.
- **Supabase client library or Supabase Data API from the clients:** would bypass the Express API and its authorization; contradicts the single-backend requirement.
- **Integer ids:** simpler, but sequential ids reveal record counts and are easy to enumerate.
- **Text columns for dates:** avoids timezone issues but loses date validation and ordering in the database.

## Decision rationale

Supabase's pooler is the supported way to reach the database from an IPv4-only host. The schema conventions put the main integrity rules (ownership chain, cascade, uniqueness, valid enums) into the database itself, not only into application code.

## Tradeoffs

- Transaction-mode pooling restricts session features such as named prepared statements; the pg adapter works with it (verified locally with PgBouncer and against the live pooler).
- The Supabase root CA file must be replaced if Supabase rotates its CA (the current one is valid until 2031).
- Two connection strings must be managed per environment.
- Docker is required to run the integration tests locally.

## Consequences

- Phase 3 writes the Prisma schema and first migration following these conventions.
- Phase 5 verifies the first connection through the pooler before building features.
- A test asserts that the Prisma enums and the shared Zod enums contain the same values.
