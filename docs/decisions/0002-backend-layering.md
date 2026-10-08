# ADR-0002: Backend layering by feature module

- Status: accepted
- Date: 2026-10-08

## Context

The API has four feature areas (auth, projects, tasks, dashboard) and a health check. Every data operation must be ownership-scoped. The code must be easy to test and easy to explain, without enterprise layering that the scope does not need.

## Decision

Group code by feature under `src/modules/<feature>/` with three thin layers:

- **routes:** path, method and middleware (rate limit, authenticate, validate); no logic
- **controller:** maps HTTP to a service call and sends the response
- **service:** business rules and Prisma queries; every function receives `userId` explicitly

Plus a **mapper** per resource that converts database records into response shapes.

Cross-cutting code lives in `src/middleware/`, `src/lib/` and `src/config/`. `src/routes.ts` mounts the module routers. `app.ts` builds the Express app; `server.ts` starts it.

There is no separate repository layer. Services call the Prisma client directly.

## Alternatives considered

- **Layer-first folders** (`controllers/`, `services/`, `routes/` at the top level): one feature is then spread across several folders, and finding all task code means visiting each of them.
- **Repository layer between services and Prisma:** a common pattern for swapping databases or mocking data access. Prisma already provides a typed, parameterized query API, and the most important rule (ownership) is a query condition that belongs next to the business rule. A repository layer here would mostly pass calls through.
- **Fat route handlers (no controller/service split):** less code, but HTTP details and business rules mix, and services could not be reused or unit-tested separately.

## Decision rationale

Feature modules keep each resource's code together. Keeping the ownership condition inside the service query makes it visible in one place per operation, which is what code review and the security tests check. Tests use a real PostgreSQL database (ADR-0007), so there is no need to mock data access.

## Tradeoffs

- Services are coupled to Prisma. Replacing the ORM would mean rewriting services. That is acceptable: the ORM is a fixed part of the stack.
- Unit testing services in isolation requires a database; integration tests cover them instead.

## Consequences

- Each service function signature starts with `userId` (except registration and login).
- Code review checklist for Phase 5 and Phase 9: every Prisma call on `project` or `task` contains the ownership condition.
- Express 5 is used so that errors thrown in async handlers reach the error middleware without wrappers (ADR-0009).
