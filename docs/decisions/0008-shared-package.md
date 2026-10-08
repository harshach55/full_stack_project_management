# ADR-0008: Shared package for schemas and types

- Status: accepted, with pending validation
- Pending validation: Metro resolution of the compiled workspace package on the pinned Expo SDK; `node-linker=hoisted` is the fallback (start of Phase 7).
- Date: 2026-10-08

## Context

The API, web app and mobile app use the same request shapes, enums and validation rules. Backend validation is authoritative; client validation exists for user experience. The package is consumed by three toolchains: Node (API runtime), Next.js and Metro (React Native).

## Decision

- Package `packages/shared` (workspace name finalized at scaffold, for example `@pm/shared`).
- Contents: enums, Zod schemas for every request body, query and id param, inferred request types, response types, error codes, field limits, platform-neutral helpers (date string validation).
- Excluded: Prisma, database code, Express, React or React Native code, environment access, secrets, Node-only modules.
- Dependencies: Zod only. One Zod version for the whole workspace.
- **Build:** compiled with `tsc` to ES modules plus `.d.ts` files in `dist/`; `package.json` `exports` points to `dist/`. Built before the apps (`pnpm -r build` runs in dependency order); watch mode during development.
- Server-only rules (email uniqueness, ownership) stay in the API.

## Alternatives considered

- **TypeScript source consumed directly** (no build step, `transpilePackages` in Next.js): works for Next.js and Metro, but the API runs compiled JavaScript on Node, which cannot load `.ts` files from a dependency.
- **Bundling the API** (for example with tsup or esbuild) so it inlines the shared source: removes the shared build step but adds a bundler to the API.
- **Duplicating schemas in each app:** no build coupling, but rules drift between clients and server.
- **Generating client types from the OpenAPI document:** useful for external clients; for an internal monorepo, importing the schemas directly is simpler.

## Decision rationale

A small compiled package gives all three runtimes the same JavaScript output and types with only `tsc`, which the project already uses. Clients reuse exactly the rules the API enforces.

## Tradeoffs

- The shared package must be rebuilt (or in watch mode) before changes are visible to the apps.
- Metro must resolve a symlinked workspace package; this is the main integration risk (architecture risk 6).

## Consequences

- Phase 4 writes the schemas as part of the API contract.
- Phase 7 starts by verifying that the Expo app can import the package on the pinned SDK before building screens; fallback is `node-linker=hoisted`.
- Unit tests cover every schema (valid and invalid cases).
