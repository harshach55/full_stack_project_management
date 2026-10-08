import { isApiError } from './api-client';

const AUTH_PATHS = ['/login', '/register'];

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** True for API answers that mean "this browser has no valid session". */
export function isSessionError(error: unknown): boolean {
  return (
    isApiError(error) &&
    error.status === 401 &&
    (error.code === 'UNAUTHENTICATED' || error.code === 'TOKEN_EXPIRED' || error.code === 'TOKEN_REVOKED')
  );
}

/** Login URL to send the user to, with a message when an existing session ended. */
export function loginUrlFor(error: unknown): string {
  const expired = isApiError(error) && (error.code === 'TOKEN_EXPIRED' || error.code === 'TOKEN_REVOKED');
  return expired ? '/login?reason=session-expired' : '/login';
}

/**
 * Leaves the protected area after the API rejected the session. A full navigation is used on
 * purpose: it drops every piece of in-memory state from the ended session.
 */
export function redirectToLogin(url: string): void {
  window.location.replace(url);
}
