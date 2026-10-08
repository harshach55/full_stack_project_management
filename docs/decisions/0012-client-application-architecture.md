# ADR-0012: Client application architecture (web and mobile)

- Status: accepted
- Date: 2026-10-08

## Context

Both clients mostly display and change server data. They must show loading, empty and error states (WEB-06, WEB-07), refresh after mutations and on pull-to-refresh (SYNC-02, MOB-08), handle offline conditions (MOB-11) and validate forms with the shared rules. TanStack Query is part of the stack for the web app. The mobile app needs a navigation approach, which the stack does not name.

## Decision

- **Server state on both clients:** TanStack Query. Query keys include all filters; mutations invalidate related keys (tasks, the parent project, dashboard).
- **No global state library.** Auth state is a small React context; everything else is server state or local component state.
- **Feature folders** (`features/auth`, `dashboard`, `projects`, `tasks`) holding each feature's API calls, query hooks and components; shared UI in `components/`; API client and helpers in `lib/`.
- **Forms:** controlled inputs validated with the shared Zod schemas on submit; server validation errors mapped back to fields. No form library, since there are only four forms (register, login, project, task).
- **Web routing:** Next.js App Router with `(auth)` and `(app)` route groups; data fetched in client components (ADR-0004).
- **Mobile navigation:** Expo Router (file-based routes, Expo's default) with `(auth)` and `(app)` groups and bottom tabs for Dashboard, Projects and Tasks.
- **Mobile connectivity:** NetInfo connected to TanStack Query's online manager; AppState connected to its focus manager so data refreshes when the app returns to the foreground.

## Alternatives considered

- **Plain `fetch` with `useEffect` and local state:** no extra library, but caching, refetching, deduplication and loading/error state would be rewritten by hand in each screen.
- **Redux Toolkit / RTK Query or Zustand:** capable, but the data is server-owned and TanStack Query already covers it; a second state tool adds concepts without a need.
- **React Hook Form:** reduces form boilerplate for many or large forms; with four small forms, controlled inputs plus the shared schemas are enough and keep validation in one obvious place.
- **React Navigation configured manually:** the library Expo Router is built on; manual configuration means more setup code for the same result.

## Decision rationale

Using the same server-state library and folder layout on both clients means the same patterns (query keys, invalidation, error mapping) are written and explained once. Expo Router is the default for new Expo apps and mirrors the web app's file-based routing.

## Tradeoffs

- TanStack Query and Expo Router add dependencies the developer must understand.
- Data fetching only in client components gives up server-side rendering of user data, which this authenticated app does not need.

## Consequences

- Phases 6 and 7 follow the folder layout in the architecture document.
- Query keys and invalidation rules are defined per feature and kept consistent between the two clients.
