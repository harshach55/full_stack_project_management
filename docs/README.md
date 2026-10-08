# Project Documentation

Planning and design documents for the Project Management System (web, Android, shared REST API, PostgreSQL).

| Document | Purpose |
|---|---|
| [requirements.md](requirements.md) | Functional and non-functional requirements with IDs and acceptance criteria |
| [scope-and-decisions.md](scope-and-decisions.md) | Scope boundaries, product decisions and assumptions |
| [traceability-matrix.md](traceability-matrix.md) | Requirement to endpoint, screen and test mapping |
| [user-flows.md](user-flows.md) | Screen inventory and main user flows for web and mobile |
| [architecture.md](architecture.md) | System architecture: components, flows, security, deployment, environment, testing, risks |
| [database-design.md](database-design.md) | Database design: tables, constraints, indexes, ER diagram, ownership queries, migration strategy |
| [api-contract.md](api-contract.md) | REST API contract: conventions, authentication, every endpoint, error codes, CORS, rate limits |
| [backend-design.md](backend-design.md) | Backend implementation blueprint: modules, middleware order, services, errors, logging, configuration, test contract |
| [deployment.md](deployment.md) | Production setup: Supabase, Render, Vercel, migrations, environment variables, TLS, verification, rollback |
| [testing.md](testing.md) | Test suites, how to run them, coverage, manual and deployed verification, non-functional review |
| [security-audit.md](security-audit.md) | Phase 9 security audit: ADR-0010 measures, ownership review, logging, dependency audit, known risks |
| [decisions/](decisions/) | Architecture decision records (ADRs) |

## Architecture decision records

| ADR | Decision |
|---|---|
| [0001](decisions/0001-monorepo-architecture.md) | Monorepo with pnpm workspaces |
| [0002](decisions/0002-backend-layering.md) | Backend layering by feature module |
| [0003](decisions/0003-authentication-architecture.md) | JWT access tokens with per-token revocation |
| [0004](decisions/0004-web-authentication.md) | Web authentication through a same-origin API rewrite |
| [0005](decisions/0005-mobile-authentication.md) | Mobile authentication with Bearer tokens and SecureStore |
| [0006](decisions/0006-api-design.md) | REST API conventions and documentation |
| [0007](decisions/0007-database-access.md) | Database access with Prisma 6 and Supabase PostgreSQL |
| [0008](decisions/0008-shared-package.md) | Shared package for schemas and types |
| [0009](decisions/0009-error-handling.md) | Centralized error handling and error codes |
| [0010](decisions/0010-security-architecture.md) | Security architecture |
| [0011](decisions/0011-deployment-architecture.md) | Deployment architecture |
| [0012](decisions/0012-client-application-architecture.md) | Client application architecture (web and mobile) |
| [0013](decisions/0013-database-schema-design.md) | Database schema design |
| [0014](decisions/0014-api-contract-and-error-handling.md) | API contract and error handling details |

## Conventions

- Requirement IDs use a prefix per area: `AUTH`, `PROJ`, `TASK`, `DASH`, `SRCH`, `WEB`, `MOB`, `SYNC`, `API`, `DB`, `SEC`, `TEST`, `DOC`, `SUB`.
- Product decisions use `PD-xx` IDs (see [scope-and-decisions.md](scope-and-decisions.md)).
- "User" means the authenticated user making the request. "Own" means resources where the user is the owner, directly (projects) or through the parent project (tasks).
