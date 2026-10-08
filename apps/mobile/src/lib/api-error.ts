import type { ErrorDetail, ErrorResponse } from '@pm/shared';

/** Client-side error codes in addition to the API's codes (ADR-0009). */
export type ClientErrorCode = 'NETWORK_ERROR' | 'TIMEOUT' | 'UNEXPECTED_RESPONSE';

/** Every failed request becomes an ApiError, whether the API answered or not. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorResponse['error']['code'] | ClientErrorCode,
    message: string,
    readonly details: ErrorDetail[] = [],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** True for API answers that mean "the stored token is not a valid session". */
export function isSessionError(error: unknown): boolean {
  return (
    isApiError(error) &&
    error.status === 401 &&
    (error.code === 'UNAUTHENTICATED' || error.code === 'TOKEN_EXPIRED' || error.code === 'TOKEN_REVOKED')
  );
}

export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.';

/**
 * Short message for the user. API messages for client errors are written to be shown;
 * server errors and unknown failures get generic wording so internal details never appear.
 */
export function errorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong. Please try again.';
  switch (error.code) {
    case 'NETWORK_ERROR':
      return 'You appear to be offline or the server cannot be reached. Check your connection and try again.';
    case 'TIMEOUT':
      return 'The server is taking too long to respond. It may be starting up; please try again in a moment.';
    case 'RATE_LIMITED':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'TOKEN_EXPIRED':
    case 'TOKEN_REVOKED':
      return SESSION_EXPIRED_MESSAGE;
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
