# ADR-0013: Database schema design

- Status: accepted
- Date: 2026-10-08

## Context

ADR-0007 fixed the database platform and general conventions (PostgreSQL on Supabase, Prisma 6, UUID keys, enums, `DATE` columns, cascade from projects to tasks). ADR-0003 fixed token revocation by `jti`. Phase 3 turns these into a concrete schema: tables, columns, constraints, indexes and the rules for changing the schema later. The full design is in [database-design.md](../database-design.md).

Requirements that shape the schema: ownership isolation with 404 for foreign resources (SEC-02, PD-17), cascade delete (PD-09), case-insensitive unique email (PD-15), date-only fields (PD-03), `endDate >= startDate` (PD-04), independent web and mobile sessions (PD-18), and the field limits in the scope document.

## Decision

1. **Four tables:** `users`, `projects`, `tasks`, `revoked_tokens`. snake_case plural table names, mapped to `User`, `Project`, `Task`, `RevokedToken` in Prisma.
2. **Ownership chain without duplication:** `projects.owner_id -> users.id`; `tasks.project_id -> projects.id`. Tasks have no `owner_id`.
3. **Referential actions:** `tasks.project_id` `ON DELETE CASCADE`; `projects.owner_id` `ON DELETE RESTRICT`; `revoked_tokens.user_id` `ON DELETE CASCADE`.
4. **Keys:** UUID primary keys with a database default (`gen_random_uuid()`); `revoked_tokens` uses the token's `jti` as its primary key.
5. **Enums:** native PostgreSQL enum types `project_status`, `task_status`, `task_priority` with defaults `NOT_STARTED`, `PENDING`, `MEDIUM`.
6. **Integrity checks in the database:** length limits through `varchar(n)` (full name 100, email 254, names 120, descriptions 2000); non-blank checks on required names; `email = lower(email)`; `end_date >= start_date` when both are set. These `CHECK` constraints are added as SQL in the migration because the Prisma schema cannot declare them.
7. **Email:** one column, stored lowercase by the application, with a plain unique index plus the lowercase check.
8. **Timestamps:** `timestamptz(3)`; `created_at` on all tables except `revoked_tokens` (which has `revoked_at` and `expires_at`); `updated_at` only on `projects` and `tasks`, the tables that are edited.
9. **Indexes:** only `users.email` (unique), `projects (owner_id, created_at)` and `tasks (project_id, created_at)` in addition to primary keys. No status, priority, name or full-text indexes.
10. **No soft delete, no stored counts, no derived project status.**
11. **Migrations:** generated against the local Docker database, reviewed, committed; applied to production manually per ADR-0011; expand/contract for anything that is not purely additive.

## Alternatives considered

- **`owner_id` on tasks:** simpler task queries (no join), but two sources of truth for ownership that can disagree; the join is cheap with the chosen indexes.
- **`ON DELETE CASCADE` from users to projects:** convenient if account deletion existed, but no feature deletes users, and a cascade would make an accidental user delete remove all their data. `RESTRICT` can be relaxed when a deletion feature is designed.
- **Text columns with `CHECK` constraints instead of enum types:** easier to change values, but enums are the approved choice (ADR-0007), are mapped directly by Prisma and reject invalid values just as well.
- **Lookup tables for statuses and priorities:** useful when values are user-configurable; here they are fixed by the requirements, so a join per query would add nothing.
- **`citext` column or a unique index on `lower(email)`:** both give case-insensitive uniqueness in the database. `citext` needs an extension; a functional index cannot be declared in the Prisma schema. Lowercasing in the application plus `CHECK (email = lower(email))` and a plain unique index gives the same guarantee with standard features.
- **Client-generated UUIDs (Prisma `uuid()`):** works, but rows inserted outside Prisma (seed SQL, manual fixes) would have no default. A database default keeps the database self-sufficient.
- **Surrogate id plus a unique `jti` column in `revoked_tokens`:** an extra column and index for no benefit; `jti` is already a unique random UUID.
- **Composite indexes for every filter (`owner_id, status`, `project_id, priority`, ...) and a trigram index for search:** faster at large volumes, but per-user data is small and each index slows writes and adds migration weight. They can be added later without breaking changes.
- **A trigger to block changes to `tasks.project_id`:** enforces PD-08 in the database, but adds procedural SQL that has to be maintained outside Prisma. The update schema already cannot carry `project_id`, and tests cover it.
- **Soft delete (`deleted_at`):** supports restore and history, which no requirement asks for; it would also force every query to filter deleted rows.

## Decision rationale

The schema stores each fact once and lets the database enforce the rules that protect integrity (ownership chain, cascade, enum values, date order, unique lowercase email), while the application keeps the rules that are about input format. The index set follows the access paths of the actual queries: every query starts from one user's projects or one project's tasks.

## Tradeoffs

- Task queries need a join to `projects` to check ownership.
- Five `CHECK` constraints live in migration SQL rather than in the Prisma schema, so the schema file alone does not show every rule; `database-design.md` lists them.
- Changing enum values requires migrations (and expand/contract for removals).
- Without status/priority indexes, filters scan a user's rows after the owner lookup; fine for expected volumes, to be revisited if data grows.

## Consequences

- Phase 4 uses these column limits and enum values in the API contract and shared schemas.
- Phase 5 writes the Prisma schema and first migration from `database-design.md`, appends the `CHECK` constraints to the generated SQL, and confirms that later migrations keep them.
- Tests cover cascade delete, the date check, duplicate email in different case, and ownership isolation through the project chain.
