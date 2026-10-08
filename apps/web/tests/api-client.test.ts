import { describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from '@/lib/api-client';
import { errorMessage, serverFieldErrors } from '@/lib/error-messages';
import { apiError, json, mockApi, on } from './support/test-utils';

describe('apiRequest', () => {
  it('calls the same-origin /api path with the session cookie and no bearer token', async () => {
    const { requests } = mockApi(on('GET', '/api/projects', () => json(200, [])));
    await apiRequest('/projects', { query: { search: 'web', status: undefined } });
    expect(requests[0]).toMatchObject({ method: 'GET', path: '/api/projects', credentials: 'include' });
    expect(requests[0]!.query.get('search')).toBe('web');
    expect(requests[0]!.query.has('status')).toBe(false);
    expect(Object.keys(requests[0]!.headers).map((h) => h.toLowerCase())).not.toContain('authorization');
  });

  it('sends JSON bodies', async () => {
    const { requests } = mockApi(on('POST', '/api/projects', () => json(201, { id: 'x' })));
    await apiRequest('/projects', { method: 'POST', body: { name: 'P' } });
    expect(requests[0]!.headers['Content-Type']).toBe('application/json');
    expect(requests[0]!.body).toEqual({ name: 'P' });
  });

  it('returns undefined for 204', async () => {
    mockApi(on('DELETE', '/api/projects/1', () => json(204)));
    await expect(apiRequest('/projects/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('turns API errors into ApiError with code, details and request id', async () => {
    mockApi(on('POST', '/api/projects', () => apiError(400, 'VALIDATION_ERROR', 'Request validation failed.', [{ location: 'body', path: 'name', message: 'Name is required.' }])));
    const error = (await apiRequest('/projects', { method: 'POST', body: {} }).catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', requestId: 'req-test-1' });
    expect(serverFieldErrors(error)).toEqual({ name: 'Name is required.' });
  });

  it('reports a response without the API error body as UNEXPECTED_RESPONSE', async () => {
    mockApi(on('GET', '/api/dashboard', () => json(502, 'Bad gateway')));
    const error = (await apiRequest('/dashboard').catch((e) => e)) as ApiError;
    expect(error).toMatchObject({ status: 502, code: 'UNEXPECTED_RESPONSE' });
  });

  it('reports a failed connection as NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const error = (await apiRequest('/dashboard').catch((e) => e)) as ApiError;
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});

describe('errorMessage', () => {
  const make = (status: number, code: string, message = 'API message.') => new ApiError(status, code as ApiError['code'], message);

  it('maps errors to readable messages without internal details', () => {
    expect(errorMessage(make(0, 'NETWORK_ERROR'))).toMatch(/Cannot reach the server/);
    expect(errorMessage(make(429, 'RATE_LIMITED'))).toMatch(/Too many attempts/);
    expect(errorMessage(make(500, 'INTERNAL_ERROR', 'TypeError at line 3'))).toBe('Something went wrong on the server. Please try again.');
    expect(errorMessage(make(401, 'TOKEN_EXPIRED'))).toMatch(/session has expired/);
    expect(errorMessage(make(404, 'NOT_FOUND', 'Project not found.'))).toBe('Project not found.');
    expect(errorMessage(new Error('raw'))).toBe('Something went wrong. Please try again.');
  });
});
