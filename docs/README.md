# Project Documentation

Planning and design documents for the Project Management System (web, Android, shared REST API, PostgreSQL).

| Document | Purpose |
|---|---|
| [requirements.md](requirements.md) | Functional and non-functional requirements with IDs and acceptance criteria |
| [scope-and-decisions.md](scope-and-decisions.md) | Scope boundaries, product decisions and assumptions |
| [traceability-matrix.md](traceability-matrix.md) | Requirement to endpoint, screen and test mapping |
| [user-flows.md](user-flows.md) | Screen inventory and main user flows for web and mobile |
| [decisions/](decisions/) | Architecture decision records (ADRs) |

Later phases add architecture, database (ER diagram), API contract, testing and deployment documents to this folder.

## Conventions

- Requirement IDs use a prefix per area: `AUTH`, `PROJ`, `TASK`, `DASH`, `SRCH`, `WEB`, `MOB`, `SYNC`, `API`, `DB`, `SEC`, `TEST`, `DOC`, `SUB`.
- Product decisions use `PD-xx` IDs (see [scope-and-decisions.md](scope-and-decisions.md)).
- "User" means the authenticated user making the request. "Own" means resources where the user is the owner, directly (projects) or through the parent project (tasks).
