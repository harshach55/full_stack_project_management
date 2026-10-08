# Project Management System

A project and task management application with a responsive web app and an Android app. Both clients use one REST API and one PostgreSQL database.

## Status

- Backend API (`apps/api`) and shared validation package (`packages/shared`): implemented and tested. See [apps/api/README.md](apps/api/README.md).
- Web app (`apps/web`): implemented and tested. See [apps/web/README.md](apps/web/README.md).
- Android app (`apps/mobile`): implemented and validated on a physical device against the production API (no release build yet). See [apps/mobile/README.md](apps/mobile/README.md).
- Deployment: web on Vercel (https://pm-system-harsha.vercel.app), API on Render (https://pm-api-lb5m.onrender.com, docs at `/api/docs`), database on Supabase. See [docs/deployment.md](docs/deployment.md).

## Planned stack

- Web: Next.js, TypeScript, Tailwind CSS, TanStack Query
- Mobile: React Native with Expo, TypeScript (Android)
- API: Node.js, Express, TypeScript
- Database: PostgreSQL (Supabase) with Prisma
- Validation: Zod; API docs: OpenAPI / Swagger; Tests: Vitest, Supertest

## Documentation

- [Documentation index](docs/README.md)
- [Requirements](docs/requirements.md)
- [Scope and decisions](docs/scope-and-decisions.md)
- [Traceability matrix](docs/traceability-matrix.md)
- [Screens and user flows](docs/user-flows.md)
- [Deployment](docs/deployment.md)
- [Testing](docs/testing.md)
- [Security audit](docs/security-audit.md)

Setup and environment instructions are in each app's README; production setup is in [docs/deployment.md](docs/deployment.md).
