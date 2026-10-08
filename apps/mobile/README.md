# Android app (`apps/mobile`)

React Native + Expo (SDK 57) + TypeScript + Expo Router. It uses the same REST API and database as the web app; only the way the session token travels is different. Architecture: [docs/architecture.md](../../docs/architecture.md) (sections 10 and 17), [ADR-0005](../../docs/decisions/0005-mobile-authentication.md), [ADR-0008](../../docs/decisions/0008-shared-package.md), [ADR-0012](../../docs/decisions/0012-client-application-architecture.md).

## How it talks to the API

- Every request goes directly to the Express API at `EXPO_PUBLIC_API_URL` and carries `X-Client-Type: mobile`; authenticated requests add `Authorization: Bearer <token>`. Cookies are never sent (`credentials: 'omit'`) and the token is never placed in a URL.
- Login and register with `X-Client-Type: mobile` (and no `Origin` header) return the token in the response body (api-contract.md, section 2.5). The API rejects that header when an `Origin` header is present.
- Errors use the API's error body (`error.code`, `message`, `details`, `requestId`); the client adds `NETWORK_ERROR` and `TIMEOUT`. Users see short messages, never raw responses.
- Task updates always send the complete editable representation (`name`, `description`, `priority`, `status`, `dueDate`) with `PUT`, including quick actions; `projectId` is never sent.

## Session and token storage

- The JWT is stored only with Expo SecureStore (Android Keystore-backed encryption), under one key, by `src/lib/token-storage.ts`. It is never written to AsyncStorage or files, never logged and never shown.
- On startup: no token means the login screen; with a token the app calls `GET /api/auth/me`. A 401 (`UNAUTHENTICATED`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`) deletes the token and shows login with "Your session has expired. Please log in again." If the server cannot be reached, the token is kept and a Retry screen is shown.
- Any 401 from a later request ends the session the same way. There are no refresh tokens; sessions last 7 days.
- Logout calls `POST /api/auth/logout` (revokes only this device's token, so the web session stays logged in) and always deletes the local token, even if the call fails.
- The rules live in `src/lib/session-controller.ts` (no React or Expo imports), so they are unit tested.

## Offline behavior

- NetInfo drives an "offline" banner on every screen and TanStack Query's online state: queries pause while offline and already loaded data stays visible.
- Actions that need the server (save, delete, status or priority changes) fail immediately with a clear message instead of waiting. Nothing is queued for later.
- When the connection returns, pull to refresh (or returning to the app) loads the current server data.

## Routes

```
app/_layout.tsx                 providers + the only auth gate (Stack.Protected)
app/(auth)/login, register
app/(app)/(tabs)/index          Dashboard (six statistics, logout)
app/(app)/(tabs)/projects       project list: search by name, status filter
app/(app)/(tabs)/tasks          task list: search, status, priority and project filters
app/(app)/project/new, [id], [id]/edit
app/(app)/task/new, [id], [id]/edit
```

Every list and the dashboard support pull-to-refresh. Deleting asks for confirmation (a project's tasks are deleted with it).

## Environment

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | API origin, no trailing slash. Embedded in the app bundle, so it must never hold a secret. There is no default: without it the app shows a setup message. |

Create `apps/mobile/.env.local` (git-ignored) from [`.env.example`](.env.example):

- **Android emulator**, API running on this computer: `http://10.0.2.2:4000`. Inside the emulator `localhost` is the emulator itself; `10.0.2.2` is the host computer.
- **Physical Android phone** with Expo Go on the same Wi-Fi: `http://<computer-LAN-IP>:4000`, and allow port 4000 through the computer's firewall.
- **Production API:** `https://pm-api-lb5m.onrender.com` (see [docs/deployment.md](../../docs/deployment.md)).

Expo reads the file when it starts; restart Expo with `--clear` after changing it, so Metro does not reuse a bundle built with the old value.

## Running locally

1. Start PostgreSQL and the API (see [apps/api/README.md](../api/README.md)). For the phone or emulator the API does not need CORS changes: mobile requests send no `Origin` header.
2. From the repository root:
   ```bash
   pnpm install
   pnpm --filter @pm/shared build      # the app imports the compiled shared package
   pnpm --filter @pm/mobile start      # Metro dev server
   ```
3. Open the app:
   - **Emulator:** with an Android emulator running (Android Studio), press `a` in the Expo terminal.
   - **Phone:** install Expo Go (it must support SDK 57) and scan the QR code shown by Expo.

If Expo Go fails with "Failed to download remote update", Expo may be advertising an address the phone cannot download from, for example on a computer with two network interfaces in the same network. Start Expo with the address of the interface the computer uses to reach the phone:

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME = '<computer-LAN-IP>'
pnpm --filter @pm/mobile start --clear
```

## Scripts (`pnpm --filter @pm/mobile <script>`)

| Script | Purpose |
|---|---|
| `start` | Metro dev server |
| `android` | Start and open on a connected emulator or device |
| `typecheck` | Type-check app, sources and tests |
| `test` | Unit tests (Vitest, Node) for the API client, session rules, endpoints and request bodies |
| `export:android` | Bundle for Android (Metro + Hermes) into `.expo-export/` as a build check |
| `eas-build-post-install` | Run by EAS on the build server only: builds `packages/shared`, whose compiled output is not in git |

`expo-doctor` (`pnpm dlx expo-doctor`) reports React 19.3.0 as a duplicate: that copy belongs to the web app in the same workspace. The Android bundle contains only React 19.2.3 (checked in Phase 7), because pnpm gives each app its own dependencies.

## Release build (APK)

The installable APK is built by EAS Build with the `preview` profile in [`eas.json`](eas.json): APK output, internal distribution, Node 24.11.1, pnpm 10.34.6 and `EXPO_PUBLIC_API_URL=https://pm-api-lb5m.onrender.com`. The `.env.local` file is not used for it. Package name: `com.harshach55.projectmanager`.

Always run the build from this directory, never from the repository root:

```bash
cd apps/mobile
npx eas-cli@24.12.0 login
npx eas-cli@24.12.0 build -p android --profile preview
```

EAS signs the APK with a keystore it stores itself; no signing files are kept in the repository. When the build finishes, EAS prints the APK link; open it on the phone to install. The current release, its checksum and its verification are in [docs/deployment.md](../../docs/deployment.md), section 7.

## Notes

- Shared validation, enums and types come from `packages/shared`; Metro uses the compiled package through Expo's default, workspace-aware configuration (ADR-0008).
- The mobile app uses TypeScript 6.0.3 because Expo SDK 57 requires it; the other packages use 5.9.3.
- HTTP API addresses work in development; the release APK uses the HTTPS deployment URL from the EAS profile.
