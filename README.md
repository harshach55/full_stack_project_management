# Project Management System

A project and task management application with a responsive web app and an Android app. Both clients use one REST API and one PostgreSQL database.

## Status

- Backend API (`apps/api`) and shared validation package (`packages/shared`): implemented and tested. See [apps/api/README.md](apps/api/README.md).
- Web app (`apps/web`): implemented and tested. See [apps/web/README.md](apps/web/README.md).
- Android app (`apps/mobile`): not started yet.

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

Setup, environment and deployment instructions will be added as each part of the system is built.
