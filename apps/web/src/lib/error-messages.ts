import { isApiError } from './api-client';

/**
 * Turns any error into a short message for the user. API messages for client errors are
 * written to be shown to users; server errors and unknown failures get generic wording,
 * so internal details never reach the screen.
 */
export function errorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong. Please try again.';

  switch (error.code) {
    case 'NETWORK_ERROR':
      return 'Cannot reach the server. Check your connection and try again.';
    case 'TIMEOUT':
      return 'The server is taking too long to respond. It may be starting up; please try again in a moment.';
    case 'RATE_LIMITED':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'ORIGIN_NOT_ALLOWED':
      return 'This request was blocked for security reasons. Reload the page and try again.';
    case 'TOKEN_EXPIRED':
    case 'TOKEN_REVOKED':
      return 'Your session has expired. Please log in again.';
    case 'UNEXPECTED_RESPONSE':
    case 'INTERNAL_ERROR':
      return 'Something went wrong on the server. Please try again.';
    default:
      return error.status >= 500 ? 'Something went wrong on the server. Please try again.' : error.message;
  }
}

/** Field errors from a VALIDATION_ERROR response, keyed by body field name. */
export function serverFieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error) || error.code !== 'VALIDATION_ERROR') return {};
  const fields: Record<string, string> = {};
  for (const detail of error.details) {
    if (detail.location === 'body' && detail.path && !fields[detail.path]) fields[detail.path] = detail.message;
  }
  return fields;
}
