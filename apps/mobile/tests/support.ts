import { vi } from 'vitest';
import type { TokenStore } from '@/lib/session-controller';

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  credentials: RequestCredentials | undefined;
}

export const json = (status: number, body?: unknown) => () =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const apiError = (status: number, code: string, message = 'API message.', details?: unknown[]) =>
  json(status, { error: { code, message, ...(details ? { details } : {}), requestId: 'req-1' } });

/** fetch replacement that answers with the given responders in order and records every request. */
export function fakeFetch(...responders: (() => Response | Promise<Response>)[]) {
  const requests: RecordedRequest[] = [];
  const impl = vi.fn(async (url: string, init: RequestInit = {}) => {
    requests.push({
      url,
      method: init.method ?? 'GET',
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      credentials: init.credentials,
    });
    const responder = responders[requests.length - 1] ?? responders[responders.length - 1];
    if (!responder) throw new Error('No response configured');
    return responder();
  });
  return { impl: impl as unknown as typeof fetch, requests };
}

/** In-memory token store standing in for SecureStore. */
export function memoryStore(initial: string | null = null): TokenStore & { value: string | null } {
  const store = {
    value: initial,
    get: async () => store.value,
    set: async (token: string) => {
      store.value = token;
    },
    remove: async () => {
      store.value = null;
    },
  };
  return store;
}

export const USER = { id: '11111111-1111-4111-8111-111111111111', fullName: 'Alice Example', email: 'alice@example.com', createdAt: '2026-10-01T10:00:00.000Z' };

export const TASK = {
  id: '33333333-3333-4333-8333-333333333333',
  projectId: '22222222-2222-4222-8222-222222222222',
  name: 'Draft homepage copy',
  description: 'First version',
  priority: 'MEDIUM' as const,
  status: 'PENDING' as const,
  dueDate: '2026-10-20',
  createdAt: '2026-10-03T09:00:00.000Z',
  updatedAt: '2026-10-03T09:00:00.000Z',
};
