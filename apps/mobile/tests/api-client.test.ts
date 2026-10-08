import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from '@/lib/api-client';
import { ApiError, errorMessage, isSessionError, serverFieldErrors } from '@/lib/api-error';
import { resolveApiBaseUrl } from '@/lib/config';
import { apiError, fakeFetch, json } from './support';

const TOKEN = 'header.payload.signature';
const BASE = 'http://10.0.2.2:4000';

function client(token: string | null, ...responders: Parameters<typeof fakeFetch>) {
  const fetch = fakeFetch(...responders);
  return { api: createApiClient({ baseUrl: BASE, getToken: async () => token, fetchImpl: fetch.impl }), requests: fetch.requests };
}

describe('request construction', () => {
  it('sends the mobile client type and the bearer token, never cookies', async () => {
    const { api, requests } = client(TOKEN, json(200, []));
    await api.request('/projects');
    expect(requests[0]).toMatchObject({ url: `${BASE}/api/projects`, method: 'GET', credentials: 'omit' });
    expect(requests[0]!.headers).toMatchObject({ 'X-Client-Type': 'mobile', Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' });
    expect(requests[0]!.headers).not.toHaveProperty('Origin');
    expect(requests[0]!.headers).not.toHaveProperty('Cookie');
  });

  it('omits Authorization when there is no token', async () => {
    const { api, requests } = client(null, json(200, { user: {} }));
    await api.request('/auth/login', { method: 'POST', body: { email: 'a@example.com', password: 'x' } });
    expect(requests[0]!.headers).not.toHaveProperty('Authorization');
    expect(requests[0]!.headers['Content-Type']).toBe('application/json');
    expect(requests[0]!.body).toEqual({ email: 'a@example.com', password: 'x' });
  });

  it('encodes query parameters, drops empty ones, and never puts the token in the URL', async () => {
    const { api, requests } = client(TOKEN, json(200, []));
    await api.request('/tasks', { query: { search: '100% done & more', status: 'PENDING', priority: undefined, projectId: '' } });
    expect(requests[0]!.url).toBe(`${BASE}/api/tasks?search=100%25%20done%20%26%20more&status=PENDING`);
    expect(requests[0]!.url).not.toContain(TOKEN);
  });

  it('returns undefined for 204', async () => {
    const { api } = client(TOKEN, json(204));
    await expect(api.request('/tasks/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});

describe('error handling', () => {
  it('parses the API error body', async () => {
    const { api } = client(TOKEN, apiError(400, 'VALIDATION_ERROR', 'Request validation failed.', [{ location: 'body', path: 'name', message: 'Name is required.' }]));
    const error = (await api.request('/projects', { method: 'POST', body: {} }).catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', requestId: 'req-1' });
    expect(serverFieldErrors(error)).toEqual({ name: 'Name is required.' });
  });

  it('handles non-JSON responses safely', async () => {
    const { api } = client(TOKEN, () => new Response('<html>Bad gateway</html>', { status: 502 }));
    const error = (await api.request('/dashboard').catch((e) => e)) as ApiError;
    expect(error).toMatchObject({ status: 502, code: 'UNEXPECTED_RESPONSE' });
  });

  it('reports a failed connection as NETWORK_ERROR without the token in the message', async () => {
    const api = createApiClient({ baseUrl: BASE, getToken: async () => TOKEN, fetchImpl: vi.fn().mockRejectedValue(new TypeError('Network request failed')) });
    const error = (await api.request('/dashboard').catch((e) => e)) as ApiError;
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    expect(`${error.message} ${errorMessage(error)}`).not.toContain(TOKEN);
  });

  it('reports a slow server as TIMEOUT', async () => {
    const hanging: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    const api = createApiClient({ baseUrl: BASE, getToken: async () => null, fetchImpl: hanging, timeoutMs: 20 });
    const error = (await api.request('/dashboard').catch((e) => e)) as ApiError;
    expect(error.code).toBe('TIMEOUT');
  });

  it('recognizes session errors', () => {
    for (const code of ['UNAUTHENTICATED', 'TOKEN_EXPIRED', 'TOKEN_REVOKED']) {
      expect(isSessionError(new ApiError(401, code as ApiError['code'], 'x'))).toBe(true);
    }
    expect(isSessionError(new ApiError(401, 'INVALID_CREDENTIALS', 'x'))).toBe(false);
    expect(isSessionError(new ApiError(404, 'NOT_FOUND', 'x'))).toBe(false);
  });

  it('maps errors to readable messages', () => {
    expect(errorMessage(new ApiError(0, 'NETWORK_ERROR', 'x'))).toMatch(/offline/);
    expect(errorMessage(new ApiError(500, 'INTERNAL_ERROR', 'stack trace here'))).toBe('Something went wrong on the server. Please try again.');
    expect(errorMessage(new ApiError(401, 'TOKEN_EXPIRED', 'x'))).toBe('Your session has expired. Please log in again.');
    expect(errorMessage(new ApiError(404, 'NOT_FOUND', 'Task not found.'))).toBe('Task not found.');
    expect(errorMessage(new Error('raw'))).toBe('Something went wrong. Please try again.');
  });
});

describe('resolveApiBaseUrl', () => {
  it('accepts plain origins and rejects missing or malformed values', () => {
    expect(resolveApiBaseUrl('http://10.0.2.2:4000')).toBe('http://10.0.2.2:4000');
    expect(resolveApiBaseUrl(' https://api.example.com/ ')).toBe('https://api.example.com');
    expect(resolveApiBaseUrl(undefined)).toBeNull();
    expect(resolveApiBaseUrl('')).toBeNull();
    expect(resolveApiBaseUrl('api.example.com')).toBeNull();
    expect(resolveApiBaseUrl('https://api.example.com/api')).toBeNull();
  });
});
