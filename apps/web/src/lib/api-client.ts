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

const REQUEST_TIMEOUT_MS = 30_000;

type Query = Record<string, string | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, value);
  }
  const search = params.toString();
  // Always the same-origin /api path: Next.js forwards it to the Express API (ADR-0004).
  return `/api${path}${search ? `?${search}` : ''}`;
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ErrorResponse).error?.code === 'string'
  );
}

/**
 * Small fetch wrapper used by every feature's API functions. Sends JSON, includes the
 * session cookie, and turns any failure into an ApiError. The JWT is never handled here:
 * the browser stores it as an httpOnly cookie that scripts cannot read.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options;
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: combinedSignal,
    });
  } catch (error) {
    if (timeout.aborted) throw new ApiError(0, 'TIMEOUT', 'The server took too long to respond.');
    if (signal?.aborted) throw error; // Cancelled by the caller (for example TanStack Query); not an error to show.
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server.');
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (response.ok) return payload as T;

  if (isErrorResponse(payload)) {
    const { code, message, details, requestId } = payload.error;
    throw new ApiError(response.status, code, message, details ?? [], requestId);
  }
  // A failure without the API's error body, for example a proxy error when the API is down.
  throw new ApiError(response.status, 'UNEXPECTED_RESPONSE', 'Unexpected response from the server.');
}
