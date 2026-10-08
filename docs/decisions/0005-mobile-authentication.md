# ADR-0005: Mobile authentication with Bearer tokens and SecureStore

- Status: accepted
- Date: 2026-10-08

## Context

The Android app uses the same login and register endpoints as the web app but cannot rely on browser cookie handling. The token must be stored with Expo SecureStore (Android Keystore-backed), never AsyncStorage (AUTH-10, MOB-09). Expired or revoked tokens must return the user to login with a clear message (MOB-10). No-network conditions must not log the user out or crash the app (MOB-11).

The same `POST /api/auth/login` must set a cookie for web and return the token for mobile, without exposing the web token to JavaScript.

## Decision

- **Client type signal:** the mobile app sends an explicit header on login and register (working name `X-Client-Type: mobile`; final name in Phase 4). With the header, the API returns `{ user, token, expiresAt }` and sets no cookie. Without it, the API sets the cookie and returns only the user.
- Requests that carry an `Origin` header (sent by browsers) cannot use the mobile mode, so a script running in a browser cannot obtain a token in the response body.
- **Storage:** the token is stored and read only through `auth-storage.ts` (SecureStore get/set/delete).
- **Requests:** one API client adds `Authorization: Bearer <token>`, the base URL from `EXPO_PUBLIC_API_URL` and a request timeout.
- **Startup:** no token: login screen. Token: `GET /api/auth/me`; 200 enters the app; 401 deletes the token and shows login with the session-expired message; network failure shows an offline screen with Retry and keeps the token.
- **401 on any request:** delete the token, clear cached data, show login with the session-expired message.
- **Logout:** call `POST /api/auth/logout` to revoke the token, then delete it locally regardless of the call's result.

## Alternatives considered

- **Separate mobile login endpoint** (for example `/api/auth/mobile/login`): explicit, but changes the required endpoint list.
- **Detecting the client from `User-Agent`:** easy to get wrong and easy to spoof; rejected by the requirement not to rely on browser detection.
- **A field in the request body** (`"client": "mobile"`): works, but mixes transport concerns with the credentials payload and must be added to the shared login schema for both clients.
- **Always return the token in the body and also set the cookie:** simplest, but exposes the web token to browser JavaScript.
- **Cookies on mobile:** React Native's cookie handling is platform-dependent and SecureStore is the required storage.

## Decision rationale

A request header keeps the endpoint and the request body identical for both clients, is explicit, and is trivial to send from the mobile API client. Refusing the mobile mode when an `Origin` header is present keeps the web token rule intact.

## Tradeoffs

- The API has two response variants for login/register, which the OpenAPI document must describe.
- Any non-browser client (for example API testing tools) can request a token in the body. That is equivalent to using the mobile app and still requires valid credentials.

## Consequences

- Phase 4 fixes the header name and both response shapes.
- The mobile API client distinguishes HTTP errors from network errors and timeouts (ADR-0009).
- Release APKs must point at the HTTPS API URL (ADR-0011).
