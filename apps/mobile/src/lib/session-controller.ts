import type { LoginInput, MeResponse, MobileAuthResponse, RegisterInput, User } from '@pm/shared';
import type { ApiClient } from './api-client';
import { isApiError, isSessionError } from './api-error';

/** Where the token lives; SecureStore in the app, an in-memory fake in tests. */
export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  remove(): Promise<void>;
}

export type RestoreResult =
  | { status: 'signedOut'; expired: boolean }
  | { status: 'signedIn'; user: User }
  | { status: 'unreachable'; error: unknown };

/**
 * Session rules for the mobile app (ADR-0005), independent of React so they can be tested:
 * - the token is written only after a successful login/register and only to the TokenStore
 * - any 401 for the stored token (UNAUTHENTICATED, TOKEN_EXPIRED, TOKEN_REVOKED) deletes it
 * - a network failure at startup keeps the token, so the user is not logged out while offline
 * - logout always deletes the token, even when the API call fails
 */
export function createSessionController(api: ApiClient, store: TokenStore) {
  async function startSession(response: MobileAuthResponse): Promise<User> {
    await store.set(response.token);
    return response.user;
  }

  return {
    async restore(): Promise<RestoreResult> {
      const token = await store.get();
      if (!token) return { status: 'signedOut', expired: false };
      try {
        const { user } = await api.request<MeResponse>('/auth/me');
        return { status: 'signedIn', user };
      } catch (error) {
        if (isSessionError(error)) {
          await store.remove();
          return { status: 'signedOut', expired: true };
        }
        return { status: 'unreachable', error };
      }
    },

    async login(input: LoginInput): Promise<User> {
      return startSession(await api.request<MobileAuthResponse>('/auth/login', { method: 'POST', body: input }));
    },

    async register(input: RegisterInput): Promise<User> {
      return startSession(await api.request<MobileAuthResponse>('/auth/register', { method: 'POST', body: input }));
    },

    async logout(): Promise<void> {
      try {
        // Revokes only this device's token on the server (PD-18).
        await api.request<void>('/auth/logout', { method: 'POST' });
      } catch (error) {
        // An already expired/revoked token or no connection: the local token is removed anyway.
        if (!isApiError(error)) throw error;
      } finally {
        await store.remove();
      }
    },

    /** Called when any request reports that the stored session is no longer valid. */
    async expire(): Promise<void> {
      await store.remove();
    },
  };
}

export type SessionController = ReturnType<typeof createSessionController>;
