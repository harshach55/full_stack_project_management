import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { isApiError, isSessionError } from './api-error';

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (!isApiError(error)) return false;
  const temporary = error.status === 0 || error.status >= 500;
  return temporary && failureCount < 1;
}

/**
 * TanStack Query client. Any request rejected because the session is missing, expired or
 * revoked calls `onSessionError`, which deletes the token and returns to login.
 */
export function createQueryClient(onSessionError: () => void): QueryClient {
  const handleError = (error: unknown) => {
    if (isSessionError(error)) onSessionError();
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetry },
      // Mutations fail immediately when offline (with a clear message) instead of waiting silently.
      mutations: { retry: false, networkMode: 'always' },
    },
  });
}
