import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { createQueryClient } from '@/lib/query-client';

export interface RecordedRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  credentials: RequestCredentials | undefined;
  headers: Record<string, string>;
}

export type Route = (request: RecordedRequest) => { status: number; body?: unknown } | undefined;

export const json = (status: number, body?: unknown) => ({ status, body });

export const apiError = (status: number, code: string, message: string, details?: unknown[]) =>
  json(status, { error: { code, message, ...(details ? { details } : {}), requestId: 'req-test-1' } });

/**
 * Replaces fetch with a small router: each handler may answer a request or return undefined.
 * Every request is recorded so tests can assert method, path, query, body and credentials.
 */
export function mockApi(...routes: Route[]) {
  const requests: RecordedRequest[] = [];
  const fetchMock = vi.fn(async (input: string, init: RequestInit = {}) => {
    const url = new URL(input, 'http://localhost:3000');
    const request: RecordedRequest = {
      method: init.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      credentials: init.credentials,
      headers: (init.headers ?? {}) as Record<string, string>,
    };
    requests.push(request);
    for (const route of routes) {
      const response = route(request);
      if (response) {
        return new Response(response.body === undefined ? null : JSON.stringify(response.body), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    throw new Error(`Unhandled request: ${request.method} ${request.path}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { requests, fetchMock };
}

/** Matches method and path exactly. */
export function on(method: string, path: string, respond: (request: RecordedRequest) => { status: number; body?: unknown }): Route {
  return (request) => (request.method === method && request.path === path ? respond(request) : undefined);
}

export function renderWithClient(ui: ReactElement) {
  const client = createQueryClient();
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

export const USER = {
  id: '11111111-1111-4111-8111-111111111111',
  fullName: 'Alice Example',
  email: 'alice@example.com',
  createdAt: '2026-10-01T10:00:00.000Z',
};

export const PROJECT = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Website Redesign',
  description: 'New landing page',
  status: 'IN_PROGRESS' as const,
  startDate: '2026-10-01',
  endDate: '2026-11-15',
  createdAt: '2026-10-02T09:00:00.000Z',
  updatedAt: '2026-10-02T09:00:00.000Z',
};

export const TASK = {
  id: '33333333-3333-4333-8333-333333333333',
  projectId: PROJECT.id,
  name: 'Draft homepage copy',
  description: 'First version',
  priority: 'MEDIUM' as const,
  status: 'PENDING' as const,
  dueDate: '2026-10-20',
  createdAt: '2026-10-03T09:00:00.000Z',
  updatedAt: '2026-10-03T09:00:00.000Z',
};
