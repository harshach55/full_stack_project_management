# ADR-0001: Monorepo with pnpm workspaces

- Status: accepted
- Validated: Node 24.11.1 with every app. Mobile (Phase 7): Expo SDK 57.0.27 with React Native 0.86.3 (requires Node 24.3 or later) installs, typechecks, bundles for Android and runs the Metro dev server; the mobile app uses TypeScript 6.0.3 as required by the Expo SDK, the other packages stay on 5.9.3. Web part (Phase 6): Node 24.11.1 with Next.js 16.4.0, React 19.3.0, TanStack Query 5.104.1, Tailwind CSS 4.3.3 and jsdom 29.1.1 for tests (jsdom 30 requires Node 24.15 or later, so it was not used). Backend part validated in Phase 5: Node 24.11.1 with Prisma 6.19.3, Express 5.2.1, TypeScript 5.9.3, Zod 4.6.5, Vitest 5.0.3 and pnpm 10.34.6 (install, typecheck, build, tests and the compiled server).
- Date: 2026-10-08

## Context

The system has three applications (API, web, mobile) that share one API contract and the same validation rules. The assessment asks for a single repository link, and the stack fixes pnpm workspaces with `apps/api`, `apps/web`, `apps/mobile` and `packages/shared`. Development happens on Windows; deployment targets are Linux (Render, Vercel, EAS).

## Decision

- One Git repository, pnpm workspaces, layout `apps/{api,web,mobile}` and `packages/shared`.
- Root `package.json` holds only workspace scripts and shared dev tooling (TypeScript, lint/format); runtime dependencies live in each app.
- Root `tsconfig.base.json` with strict settings, extended by every package.
- Workspace packages reference each other with `workspace:*`.
- One Node version (Node 24 LTS) for local development and every deployment target, pinned through `engines` and a version file; pnpm version pinned through the `packageManager` field (Corepack). Compatibility with the pinned Prisma, Next.js, Expo and tooling versions is verified when each app is scaffolded.
- No task-runner layer. Root scripts use `pnpm --filter` and `pnpm -r` (which builds in dependency order).
- All scripts are cross-platform (no shell-specific syntax).

## Alternatives considered

- **Separate repositories per app:** shared schemas would need publishing or copying, and one change to the contract would span several repositories and commits.
- **Turborepo or Nx on top of pnpm:** adds caching and task graphs, which help large repositories. With four packages, `pnpm -r` already runs builds in dependency order, so the extra tool is not needed.
- **npm or Yarn workspaces:** workable, but pnpm is the agreed tool and its strict dependency isolation catches undeclared dependencies.

## Decision rationale

A single repository keeps the API contract, both clients and the documentation in one reviewable history, which matches how the assessment is evaluated. pnpm alone covers the needed workspace features.

## Tradeoffs

- pnpm's symlinked `node_modules` layout needs care with React Native's bundler (Metro). See ADR-0008 and risk 6 in the architecture document.
- Each hosting platform must be configured to build one app out of a monorepo.

## Consequences

- The Phase 5 scaffold creates the workspace files and verifies that each app can import `packages/shared`.
- Deployment configuration (Render, Vercel, EAS) must set the app directory and install from the repository root (ADR-0011).
