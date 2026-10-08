import type { LoginInput, RegisterInput, User } from '@pm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SESSION_EXPIRED_MESSAGE } from '@/lib/api-error';
import { session } from '@/lib/api';
import { onSessionExpired } from '@/lib/session-events';

type AuthState =
  | { status: 'checking' }
  | { status: 'signedOut'; notice: string | null }
  | { status: 'signedIn'; user: User }
  | { status: 'unreachable'; error: unknown };

interface AuthContextValue {
  state: AuthState;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Owns the session state for the whole app. Screens never read the token: the session
 * controller stores it in SecureStore and the API client attaches it to requests.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'checking' });

  const restore = useCallback(async () => {
    if (!session) return;
    setState({ status: 'checking' });
    const result = await session.restore();
    if (result.status === 'signedIn') setState({ status: 'signedIn', user: result.user });
    else if (result.status === 'signedOut') setState({ status: 'signedOut', notice: result.expired ? SESSION_EXPIRED_MESSAGE : null });
    else setState({ status: 'unreachable', error: result.error });
  }, []);

  useEffect(() => {
    void restore();
  }, [restore]);

  // Any request that finds the session invalid ends it here, once, for the whole app.
  useEffect(
    () =>
      onSessionExpired(() => {
        void session?.expire().finally(() => {
          queryClient.clear();
          setState({ status: 'signedOut', notice: SESSION_EXPIRED_MESSAGE });
        });
      }),
    [queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      login: async (input) => {
        if (!session) return;
        const user = await session.login(input);
        queryClient.clear();
        setState({ status: 'signedIn', user });
      },
      register: async (input) => {
        if (!session) return;
        const user = await session.register(input);
        queryClient.clear();
        setState({ status: 'signedIn', user });
      },
      logout: async () => {
        if (!session) return;
        await session.logout();
        queryClient.clear();
        setState({ status: 'signedOut', notice: null });
      },
      retry: () => void restore(),
    }),
    [state, queryClient, restore],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

/** The logged-in user; only used inside the (app) route group, which requires a session. */
export function useCurrentUser(): User {
  const { state } = useAuth();
  if (state.status !== 'signedIn') throw new Error('useCurrentUser requires a signed-in session');
  return state.user;
}
