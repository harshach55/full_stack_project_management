import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  bearer,
  createProject,
  createTask,
  createTestContext,
  registerMobile,
  resetDatabase,
  type MobileSession,
  type TestContext,
} from './support/helpers.js';

let ctx: TestContext;
let alice: MobileSession;
let bob: MobileSession;

beforeAll(async () => {
  ctx = createTestContext();
  await resetDatabase(ctx.prisma);
  alice = await registerMobile(ctx.app, 'Alice');
  bob = await registerMobile(ctx.app, 'Bob');
});

beforeEach(async () => {
  await ctx.prisma.project.deleteMany();
});

describe('create and read', () => {
  it('creates a project with defaults', async () => {
    const res = await request(ctx.app).post('/api/projects').set(bearer(alice.token)).send({ name: '  Website  ' }).expect(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      name: 'Website',
      description: null,
      status: 'NOT_STARTED',
      startDate: null,
      endDate: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(res.body.ownerId).toBeUndefined();
    const stored = await ctx.prisma.project.findUnique({ where: { id: res.body.id } });
    expect(stored?.ownerId).toBe(alice.userId);
  });

  it('creates a project with every field and returns date-only values unchanged', async () => {
    const body = { name: 'Launch', description: 'Plan', status: 'IN_PROGRESS', startDate: '2026-12-31', endDate: '2027-01-01' };
    const res = await request(ctx.app).post('/api/projects').set(bearer(alice.token)).send(body).expect(201);
    expect(res.body).toMatchObject(body);
    const fetched = await request(ctx.app).get(`/api/projects/${res.body.id}`).set(bearer(alice.token)).expect(200);
    expect(fetched.body).toEqual(res.body);
  });

  it('lists only the caller\'s projects, newest first', async () => {
    const first = await createProject(ctx.app, alice.token, { name: 'First' });
    const second = await createProject(ctx.app, alice.token, { name: 'Second' });
    await createProject(ctx.app, bob.token, { name: 'Bob project' });
    const res = await request(ctx.app).get('/api/projects').set(bearer(alice.token)).expect(200);
    expect(res.body.map((p: { id: string }) => p.id)).toEqual([second.id, first.id]);
  });

  it('returns an empty array when there are no projects', async () => {
    const res = await request(ctx.app).get('/api/projects').set(bearer(alice.token)).expect(200);
    expect(res.body).toEqual([]);
  });

  it.each([
    ['endDate before startDate', { startDate: '2026-10-10', endDate: '2026-10-09' }, 'endDate'],
    ['impossible date', { startDate: '2026-02-30' }, 'startDate'],
    ['wrong date format', { endDate: '10/09/2026' }, 'endDate'],
    ['invalid status', { status: 'DONE' }, 'status'],
    ['blank name', { name: '   ' }, 'name'],
    ['name over 120 characters', { name: 'a'.repeat(121) }, 'name'],
    ['description over 2000 characters', { description: 'a'.repeat(2001) }, 'description'],
    ['ownerId in body', { ownerId: randomUUID() }, 'ownerId'],
    ['id in body', { id: randomUUID() }, 'id'],
    ['createdAt in body', { createdAt: '2026-01-01T00:00:00.000Z' }, 'createdAt'],
  ])('rejects %s', async (_label, override, path) => {
    const res = await request(ctx.app)
      .post('/api/projects')
      .set(bearer(alice.token))
      .send({ name: 'Valid', ...override })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(path);
  });

  it('rejects a malformed id with 400 and an unknown id with 404', async () => {
    await request(ctx.app).get('/api/projects/123').set(bearer(alice.token)).expect(400);
    const res = await request(ctx.app).get(`/api/projects/${randomUUID()}`).set(bearer(alice.token)).expect(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Project not found.' });
  });
});

describe('search and filter', () => {
  beforeEach(async () => {
    await createProject(ctx.app, alice.token, { name: 'Website Redesign', status: 'IN_PROGRESS' });
    await createProject(ctx.app, alice.token, { name: 'Mobile app', status: 'NOT_STARTED' });
    await createProject(ctx.app, alice.token, { name: 'Budget 100% review', status: 'IN_PROGRESS' });
    await createProject(ctx.app, alice.token, { name: 'web_assets', status: 'COMPLETED' });
    await createProject(ctx.app, bob.token, { name: 'Bob Website', status: 'IN_PROGRESS' });
  });

  const names = async (query: string) => {
    const res = await request(ctx.app).get(`/api/projects?${query}`).set(bearer(alice.token)).expect(200);
    return (res.body as { name: string }[]).map((p) => p.name).sort();
  };

  it('matches partially and case-insensitively', async () => {
    expect(await names('search=WEB')).toEqual(['Website Redesign', 'web_assets']);
    expect(await names('search=des')).toEqual(['Website Redesign']);
  });

  it('treats % and _ literally', async () => {
    expect(await names('search=%25')).toEqual(['Budget 100% review']);
    expect(await names('search=_')).toEqual(['web_assets']);
  });

  it('filters by status and combines with search', async () => {
    expect(await names('status=IN_PROGRESS')).toEqual(['Budget 100% review', 'Website Redesign']);
    expect(await names('status=IN_PROGRESS&search=site')).toEqual(['Website Redesign']);
  });

  it('treats an empty search as no search', async () => {
    expect(await names('search=%20%20')).toHaveLength(4);
  });

  it('rejects invalid, repeated and unknown query parameters', async () => {
    await request(ctx.app).get('/api/projects?status=DONE').set(bearer(alice.token)).expect(400);
    await request(ctx.app).get('/api/projects?status=IN_PROGRESS&status=COMPLETED').set(bearer(alice.token)).expect(400);
    await request(ctx.app).get('/api/projects?sort=name').set(bearer(alice.token)).expect(400);
    await request(ctx.app).get(`/api/projects?search=${'a'.repeat(121)}`).set(bearer(alice.token)).expect(400);
  });
});

describe('update (full replacement)', () => {
  it('replaces every editable field', async () => {
    const project = await createProject(ctx.app, alice.token, { name: 'Old', description: 'old', startDate: '2026-01-01' });
    const body = { name: 'New', description: null, status: 'COMPLETED', startDate: null, endDate: '2026-12-01' };
    const res = await request(ctx.app).put(`/api/projects/${project.id}`).set(bearer(alice.token)).send(body).expect(200);
    expect(res.body).toMatchObject(body);
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(res.body.createdAt).getTime());
  });

  it('rejects a partial body and names every missing field', async () => {
    const project = await createProject(ctx.app, alice.token);
    const res = await request(ctx.app)
      .put(`/api/projects/${project.id}`)
      .set(bearer(alice.token))
      .send({ name: 'Only name' })
      .expect(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'description',
      'endDate',
      'startDate',
      'status',
    ]);
    const unchanged = await ctx.prisma.project.findUnique({ where: { id: project.id } });
    expect(unchanged?.name).toBe('Project');
  });

  it('rejects endDate before startDate', async () => {
    const project = await createProject(ctx.app, alice.token);
    await request(ctx.app)
      .put(`/api/projects/${project.id}`)
      .set(bearer(alice.token))
      .send({ name: 'P', description: null, status: 'NOT_STARTED', startDate: '2026-05-02', endDate: '2026-05-01' })
      .expect(400);
  });

  it.each([
    ['ownerId', { ownerId: randomUUID() }],
    ['id', { id: randomUUID() }],
    ['createdAt', { createdAt: '2026-01-01T00:00:00.000Z' }],
  ])('rejects the server-owned field %s and changes nothing', async (field, extra) => {
    const project = await createProject(ctx.app, alice.token, { name: 'Owned' });
    const before = await ctx.prisma.project.findUnique({ where: { id: project.id } });
    const body = { name: 'Changed', description: null, status: 'COMPLETED', startDate: null, endDate: null, ...extra };
    const res = await request(ctx.app).put(`/api/projects/${project.id}`).set(bearer(alice.token)).send(body).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(field);

    const after = await ctx.prisma.project.findUnique({ where: { id: project.id } });
    expect(after).toEqual(before);
    expect(after?.ownerId).toBe(alice.userId);
  });
});

describe('ownership isolation', () => {
  const fullBody = { name: 'Hijacked', description: null, status: 'COMPLETED', startDate: null, endDate: null };

  it('another user cannot read, update or delete a project (404) and nothing changes', async () => {
    const project = await createProject(ctx.app, alice.token, { name: 'Alice secret' });

    const read = await request(ctx.app).get(`/api/projects/${project.id}`).set(bearer(bob.token)).expect(404);
    expect(read.body.error.code).toBe('NOT_FOUND');
    await request(ctx.app).put(`/api/projects/${project.id}`).set(bearer(bob.token)).send(fullBody).expect(404);
    await request(ctx.app).delete(`/api/projects/${project.id}`).set(bearer(bob.token)).expect(404);

    const stored = await ctx.prisma.project.findUnique({ where: { id: project.id } });
    expect(stored?.name).toBe('Alice secret');
    expect(stored?.ownerId).toBe(alice.userId);
  });

  it('the 404 for another user\'s project is identical to the 404 for a missing one', async () => {
    const project = await createProject(ctx.app, alice.token);
    const foreign = await request(ctx.app).get(`/api/projects/${project.id}`).set(bearer(bob.token)).expect(404);
    const missing = await request(ctx.app).get(`/api/projects/${randomUUID()}`).set(bearer(bob.token)).expect(404);
    expect(foreign.body.error.code).toBe(missing.body.error.code);
    expect(foreign.body.error.message).toBe(missing.body.error.message);
  });
});

describe('delete', () => {
  it('deletes the project and cascades to its tasks', async () => {
    const project = await createProject(ctx.app, alice.token);
    await createTask(ctx.app, alice.token, project.id, { name: 'One' });
    await createTask(ctx.app, alice.token, project.id, { name: 'Two' });
    const otherProject = await createProject(ctx.app, alice.token);
    await createTask(ctx.app, alice.token, otherProject.id);

    await request(ctx.app).delete(`/api/projects/${project.id}`).set(bearer(alice.token)).expect(204);

    expect(await ctx.prisma.task.count({ where: { projectId: project.id } })).toBe(0);
    expect(await ctx.prisma.task.count({ where: { projectId: otherProject.id } })).toBe(1);
    await request(ctx.app).get(`/api/projects/${project.id}`).set(bearer(alice.token)).expect(404);
    await request(ctx.app).delete(`/api/projects/${project.id}`).set(bearer(alice.token)).expect(404);
  });
});

describe('database constraints (enforced even without the API)', () => {
  it('rejects end_date before start_date', async () => {
    await expect(
      ctx.prisma.project.create({
        data: { ownerId: alice.userId, name: 'X', startDate: new Date('2026-02-02'), endDate: new Date('2026-02-01') },
      }),
    ).rejects.toThrow();
  });

  it('rejects blank names', async () => {
    await expect(ctx.prisma.project.create({ data: { ownerId: alice.userId, name: '   ' } })).rejects.toThrow();
  });

  it('rejects uppercase emails and blank full names', async () => {
    await expect(
      ctx.prisma.user.create({ data: { fullName: 'X', email: 'Upper@Example.com', passwordHash: 'x' } }),
    ).rejects.toThrow();
    await expect(
      ctx.prisma.user.create({ data: { fullName: '  ', email: 'blank@example.com', passwordHash: 'x' } }),
    ).rejects.toThrow();
  });

  it('prevents deleting a user who owns projects', async () => {
    await createProject(ctx.app, alice.token);
    await expect(ctx.prisma.user.delete({ where: { id: alice.userId } })).rejects.toThrow();
  });
});
