import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isApiError } from './api-client';
import { isAuthPath, isSessionError, loginUrlFor, redirectToLogin } from './session';

/** Retry only failures that may be temporary (network, timeouts, 5xx), and only once. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (!isApiError(error)) return false;
  const temporary = error.status === 0 || error.status >= 500;
  return temporary && failureCount < 1;
}

/**
 * Creates the TanStack Query client. Any request rejected because the session is missing,
 * expired or revoked clears the cache and returns the user to the login page (WEB-04),
 * except on the login and register pages themselves, where a 401 is expected.
 */
export function createQueryClient(): QueryClient {
  const handleError = (error: unknown) => {
    if (!isSessionError(error) || isAuthPath(window.location.pathname)) return;
    client.clear();
    redirectToLogin(loginUrlFor(error));
  };

  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        // Refetch when the user returns to the tab, so changes made on another device appear (SYNC-02).
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
  return client;
}
