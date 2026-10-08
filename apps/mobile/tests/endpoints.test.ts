import { describe, expect, it } from 'vitest';
import { createApiClient } from '@/lib/api-client';
import { formatDate, formatTimestamp } from '@/lib/dates';
import { dateTextToValue, validateForm } from '@/lib/form';
import * as endpoints from '@/features/api';
import { toTaskUpdateBody } from '@/features/tasks/task-body';
import { taskUpdateBodySchema } from '@pm/shared';
import { fakeFetch, json, TASK } from './support';

const EDITABLE = ['description', 'dueDate', 'name', 'priority', 'status'];

function api(...responders: Parameters<typeof fakeFetch>) {
  const fetch = fakeFetch(...responders);
  return { client: createApiClient({ baseUrl: 'http://10.0.2.2:4000', getToken: async () => 'jwt', fetchImpl: fetch.impl }), requests: fetch.requests };
}

describe('task full PUT', () => {
  it('quick actions build exactly the five editable fields with one change', () => {
    const body = toTaskUpdateBody(TASK, { status: 'COMPLETED' });
    expect(body).toEqual({ name: TASK.name, description: TASK.description, priority: 'MEDIUM', status: 'COMPLETED', dueDate: '2026-10-20' });
    expect(Object.keys(body).sort()).toEqual(EDITABLE);
    expect(toTaskUpdateBody(TASK, { priority: 'HIGH' })).toMatchObject({ priority: 'HIGH', status: 'PENDING' });
    expect(toTaskUpdateBody(TASK, { dueDate: null }).dueDate).toBeNull();
  });

  it('the body passes the shared update schema (no partial PUT)', () => {
    expect(taskUpdateBodySchema.safeParse(toTaskUpdateBody(TASK, { status: 'IN_PROGRESS' })).success).toBe(true);
  });

  it('updateTask sends only the five fields, never projectId, even if extra fields are passed', async () => {
    const { client, requests } = api(json(200, TASK));
    const withExtras = { ...toTaskUpdateBody(TASK), projectId: 'other', id: 'x' } as Parameters<typeof endpoints.updateTask>[2];
    await endpoints.updateTask(client, TASK.id, withExtras);
    expect(requests[0]).toMatchObject({ method: 'PUT', url: `http://10.0.2.2:4000/api/tasks/${TASK.id}` });
    expect(Object.keys(requests[0]!.body as object).sort()).toEqual(EDITABLE);
  });
});

describe('endpoint paths and query parameters', () => {
  it('lists tasks with the contract query parameters only', async () => {
    const { client, requests } = api(json(200, []));
    await endpoints.listTasks(client, { search: 'copy', status: 'PENDING', priority: 'HIGH', projectId: TASK.projectId });
    const url = new URL(requests[0]!.url);
    expect(url.pathname).toBe('/api/tasks');
    expect(Object.fromEntries(url.searchParams)).toEqual({ projectId: TASK.projectId, search: 'copy', status: 'PENDING', priority: 'HIGH' });
  });

  it('lists projects with search and status', async () => {
    const { client, requests } = api(json(200, []));
    await endpoints.listProjects(client, { search: 'web', status: 'IN_PROGRESS' });
    expect(Object.fromEntries(new URL(requests[0]!.url).searchParams)).toEqual({ search: 'web', status: 'IN_PROGRESS' });
  });

  it('uses the required endpoints and methods', async () => {
    const { client, requests } = api(json(200, {}), json(201, {}), json(204), json(200, {}));
    await endpoints.getDashboard(client);
    await endpoints.createProject(client, { name: 'P' });
    await endpoints.deleteProject(client, 'p1');
    await endpoints.createTask(client, { projectId: TASK.projectId, name: 'T' });
    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual([
      'GET /api/dashboard',
      'POST /api/projects',
      'DELETE /api/projects/p1',
      'POST /api/tasks',
    ]);
  });
});

describe('form helpers and dates', () => {
  it('turns an empty date field into null and validates with the shared rules', () => {
    expect(dateTextToValue('  ')).toBeNull();
    expect(dateTextToValue('2026-10-20')).toBe('2026-10-20');
    const result = validateForm(taskUpdateBodySchema, { name: '', description: null, priority: 'LOW', status: 'PENDING', dueDate: '2026-02-30' });
    expect(result.success).toBe(false);
    if (!result.success) expect(Object.keys(result.errors).sort()).toEqual(['dueDate', 'name']);
  });

  it('formats date-only values without timezone shifts', () => {
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026');
    expect(formatDate('2026-12-31')).toBe('Dec 31, 2026');
    expect(formatDate(null)).toBe('');
    expect(formatTimestamp('2026-10-03T23:30:00.000Z')).toBe('Oct 3, 2026');
  });
});
