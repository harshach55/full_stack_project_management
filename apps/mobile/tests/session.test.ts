import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import { createQueryClient } from '@/lib/query-client';
import { createSessionController } from '@/lib/session-controller';
import { apiError, fakeFetch, json, memoryStore, USER } from './support';

const TOKEN = 'stored.jwt.token';

function setup(initialToken: string | null, ...responders: Parameters<typeof fakeFetch>) {
  const store = memoryStore(initialToken);
  const fetch = fakeFetch(...responders);
  const api = createApiClient({ baseUrl: 'http://10.0.2.2:4000', getToken: store.get, fetchImpl: fetch.impl });
  return { store, requests: fetch.requests, session: createSessionController(api, store) };
}

describe('restore on startup', () => {
  it('without a stored token: signed out, no request', async () => {
    const { session, requests } = setup(null);
    expect(await session.restore()).toEqual({ status: 'signedOut', expired: false });
    expect(requests).toHaveLength(0);
  });

  it('with a valid token: calls /auth/me and signs in', async () => {
    const { session, requests, store } = setup(TOKEN, json(200, { user: USER }));
    expect(await session.restore()).toEqual({ status: 'signedIn', user: USER });
    expect(requests[0]!.url).toMatch(/\/api\/auth\/me$/);
    expect(requests[0]!.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(store.value).toBe(TOKEN);
  });

  it.each(['TOKEN_EXPIRED', 'TOKEN_REVOKED', 'UNAUTHENTICATED'])('with %s: deletes the token and reports expiry', async (code) => {
    const { session, store } = setup(TOKEN, apiError(401, code));
    expect(await session.restore()).toEqual({ status: 'signedOut', expired: true });
    expect(store.value).toBeNull();
  });

  it('when the server cannot be reached: keeps the token', async () => {
    const store = memoryStore(TOKEN);
    const api = createApiClient({ baseUrl: 'http://10.0.2.2:4000', getToken: store.get, fetchImpl: vi.fn().mockRejectedValue(new TypeError('Network request failed')) });
    const result = await createSessionController(api, store).restore();
    expect(result.status).toBe('unreachable');
    expect(store.value).toBe(TOKEN);
  });
});

describe('login, register and logout', () => {
  it('login stores the token from the response body', async () => {
    const { session, store, requests } = setup(null, json(200, { user: USER, token: 'new.jwt.token', expiresAt: '2026-10-15T00:00:00.000Z' }));
    expect(await session.login({ email: USER.email, password: 'correct-horse-battery' })).toEqual(USER);
    expect(store.value).toBe('new.jwt.token');
    expect(requests[0]).toMatchObject({ method: 'POST', body: { email: USER.email, password: 'correct-horse-battery' } });
    expect(requests[0]!.headers['X-Client-Type']).toBe('mobile');
  });

  it('a failed login stores nothing', async () => {
    const { session, store } = setup(null, apiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.'));
    await expect(session.login({ email: USER.email, password: 'wrong' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(store.value).toBeNull();
  });

  it('register stores the token (registration logs in)', async () => {
    const { session, store } = setup(null, json(201, { user: USER, token: 'registered.jwt', expiresAt: '2026-10-15T00:00:00.000Z' }));
    await session.register({ fullName: USER.fullName, email: USER.email, password: 'correct-horse-battery' });
    expect(store.value).toBe('registered.jwt');
  });

  it('logout revokes the token on the server and deletes it locally', async () => {
    const { session, store, requests } = setup(TOKEN, json(204));
    await session.logout();
    expect(requests[0]).toMatchObject({ method: 'POST' });
    expect(requests[0]!.url).toMatch(/\/api\/auth\/logout$/);
    expect(requests[0]!.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(store.value).toBeNull();
  });

  it('logout deletes the token even when the token was already revoked', async () => {
    const { session, store } = setup(TOKEN, apiError(401, 'TOKEN_REVOKED'));
    await session.logout();
    expect(store.value).toBeNull();
  });

  it('logout deletes the token even without a connection', async () => {
    const store = memoryStore(TOKEN);
    const api = createApiClient({ baseUrl: 'http://10.0.2.2:4000', getToken: store.get, fetchImpl: vi.fn().mockRejectedValue(new TypeError('offline')) });
    await createSessionController(api, store).logout();
    expect(store.value).toBeNull();
  });

  it('expire deletes the token', async () => {
    const { session, store } = setup(TOKEN);
    await session.expire();
    expect(store.value).toBeNull();
  });
});

describe('query client', () => {
  it('reports session errors from any query, and nothing else', async () => {
    const onSessionError = vi.fn();
    const client = createQueryClient(onSessionError);
    await client.fetchQuery({ queryKey: ['a'], queryFn: () => Promise.reject(new ApiError(404, 'NOT_FOUND', 'x')) }).catch(() => {});
    expect(onSessionError).not.toHaveBeenCalled();
    await client.fetchQuery({ queryKey: ['b'], queryFn: () => Promise.reject(new ApiError(401, 'TOKEN_EXPIRED', 'x')) }).catch(() => {});
    expect(onSessionError).toHaveBeenCalledTimes(1);
  });
});
