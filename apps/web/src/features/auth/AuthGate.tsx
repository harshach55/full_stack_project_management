'use client';

import type { User } from '@pm/shared';
import { createContext, useContext, type ReactNode } from 'react';
import { LoadingState } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/States';
import { isSessionError } from '@/lib/session';
import { useCurrentUser } from './hooks';

const CurrentUserContext = createContext<User | null>(null);

/** The authenticated user inside the protected area (always set below AuthGate). */
export function useAuthenticatedUser(): User {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error('useAuthenticatedUser must be used inside AuthGate');
  return user;
}

/**
 * Protected area boundary. Renders its children only after GET /api/auth/me confirms the
 * session; the API remains the real security boundary for every request. A 401 is handled
 * by the query client, which redirects to the login page.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { data, error, isPending, refetch } = useCurrentUser();

  if (isPending || isSessionError(error)) return <LoadingState label="Checking your session..." />;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorState error={error} onRetry={() => void refetch()} title="Could not check your session" />
      </div>
    );
  }
  return <CurrentUserContext.Provider value={data.user}>{children}</CurrentUserContext.Provider>;
}
