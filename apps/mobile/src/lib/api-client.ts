import { CLIENT_TYPE_HEADER, MOBILE_CLIENT_TYPE, type ErrorResponse } from '@pm/shared';
import { ApiError } from './api-error';

type Query = Record<string, string | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
}

export interface ApiClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
}

export interface ApiClientOptions {
  /** API origin, for example http://10.0.2.2:4000 (no trailing slash). */
  baseUrl: string;
  /** Reads the stored token; null when the user is not logged in. */
  getToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

function buildUrl(baseUrl: string, path: string, query?: Query): string {
  const params: string[] = [];
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }
  return `${baseUrl}/api${path}${params.length ? `?${params.join('&')}` : ''}`;
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return typeof value === 'object' && value !== null && 'error' in value && typeof (value as ErrorResponse).error?.code === 'string';
}

/**
 * API client for the mobile app (ADR-0005). Every request:
 * - sends X-Client-Type: mobile and, when logged in, Authorization: Bearer <token>
 * - never sends cookies (credentials: 'omit') and never puts the token in the URL
 * - turns any failure into an ApiError; error messages never contain the token
 */
export function createApiClient({ baseUrl, getToken, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }: ApiClientOptions): ApiClient {
  return {
    async request<T>(path: string, { method = 'GET', body, query, signal }: RequestOptions = {}): Promise<T> {
      const token = await getToken();
      const headers: Record<string, string> = {
        Accept: 'application/json',
        [CLIENT_TYPE_HEADER]: MOBILE_CLIENT_TYPE,
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (body !== undefined) headers['Content-Type'] = 'application/json';

      // Timeout plus the caller's signal (for example TanStack Query cancelling a request).
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      const onCallerAbort = () => controller.abort();
      signal?.addEventListener('abort', onCallerAbort);

      let response: Response;
      try {
        response = await fetchImpl(buildUrl(baseUrl, path, query), {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          credentials: 'omit',
          signal: controller.signal,
        });
      } catch (error) {
        if (timedOut) throw new ApiError(0, 'TIMEOUT', 'The server took too long to respond.');
        if (signal?.aborted) throw error;
        throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server.');
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onCallerAbort);
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
      throw new ApiError(response.status, 'UNEXPECTED_RESPONSE', 'Unexpected response from the server.');
    },
  };
}
