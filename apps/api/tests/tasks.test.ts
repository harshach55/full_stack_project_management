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
let aliceProject: { id: string };
let bobProject: { id: string };

beforeAll(async () => {
  ctx = createTestContext();
  await resetDatabase(ctx.prisma);
  alice = await registerMobile(ctx.app, 'Alice');
  bob = await registerMobile(ctx.app, 'Bob');
});

beforeEach(async () => {
  await ctx.prisma.project.deleteMany();
  aliceProject = await createProject(ctx.app, alice.token, { name: 'Alice project' });
  bobProject = await createProject(ctx.app, bob.token, { name: 'Bob project' });
});

const fullTask = { name: 'Task', description: null, priority: 'MEDIUM', status: 'PENDING', dueDate: null };

describe('create and read', () => {
  it('creates a task with defaults', async () => {
    const res = await request(ctx.app)
      .post('/api/tasks')
      .set(bearer(alice.token))
      .send({ projectId: aliceProject.id, name: ' Draft copy ' })
      .expect(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      projectId: aliceProject.id,
      name: 'Draft copy',
      description: null,
      priority: 'MEDIUM',
      status: 'PENDING',
      dueDate: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(res.body.ownerId).toBeUndefined();
  });

  it('accepts a past due date outside the project dates', async () => {
    const project = await createProject(ctx.app, alice.token, { startDate: '2026-10-01', endDate: '2026-10-31' });
    const task = await createTask(ctx.app, alice.token, project.id, { dueDate: '2020-01-15' });
    expect(task).toMatchObject({ dueDate: '2020-01-15' });
  });

  it('returns 404 for another user\'s project or an unknown project', async () => {
    const foreign = await request(ctx.app)
      .post('/api/tasks')
      .set(bearer(alice.token))
      .send({ projectId: bobProject.id, name: 'Sneaky' })
      .expect(404);
    expect(foreign.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Project not found.' });
    await request(ctx.app).post('/api/tasks').set(bearer(alice.token)).send({ projectId: randomUUID(), name: 'X' }).expect(404);
    expect(await ctx.prisma.task.count({ where: { projectId: bobProject.id } })).toBe(0);
  });

  it.each([
    ['missing projectId', { projectId: undefined }],
    ['invalid projectId', { projectId: 'abc' }],
    ['blank name', { name: ' ' }],
    ['invalid priority', { priority: 'URGENT' }],
    ['invalid status', { status: 'DONE' }],
    ['impossible due date', { dueDate: '2026-02-29' }],
    ['ownerId in body', { ownerId: randomUUID() }],
  ])('rejects %s', async (_label, override) => {
    const res = await request(ctx.app)
      .post('/api/tasks')
      .set(bearer(alice.token))
      .send({ projectId: aliceProject.id, name: 'T', ...override })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('gets a task and hides other users\' tasks', async () => {
    const task = await createTask(ctx.app, alice.token, aliceProject.id);
    await request(ctx.app).get(`/api/tasks/${task.id}`).set(bearer(alice.token)).expect(200);
    const res = await request(ctx.app).get(`/api/tasks/${task.id}`).set(bearer(bob.token)).expect(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Task not found.' });
    await request(ctx.app).get('/api/tasks/not-a-uuid').set(bearer(alice.token)).expect(400);
  });
});

describe('list, search and filter', () => {
  beforeEach(async () => {
    const second = await createProject(ctx.app, alice.token, { name: 'Second' });
    await createTask(ctx.app, alice.token, aliceProject.id, { name: 'Write homepage copy', priority: 'HIGH', status: 'IN_PROGRESS' });
    await createTask(ctx.app, alice.token, aliceProject.id, { name: 'Review copy', priority: 'LOW', status: 'COMPLETED' });
    await createTask(ctx.app, alice.token, second.id, { name: 'Set up CI', priority: 'HIGH', status: 'PENDING' });
    await createTask(ctx.app, bob.token, bobProject.id, { name: 'Bob copy', priority: 'HIGH' });
  });

  const names = async (query: string) => {
    const res = await request(ctx.app).get(`/api/tasks?${query}`).set(bearer(alice.token)).expect(200);
    return (res.body as { name: string }[]).map((t) => t.name);
  };

  it('without projectId returns all of the caller\'s tasks, newest first', async () => {
    expect(await names('')).toEqual(['Set up CI', 'Review copy', 'Write homepage copy']);
  });

  it('with projectId returns only that project\'s tasks', async () => {
    expect(await names(`projectId=${aliceProject.id}`)).toEqual(['Review copy', 'Write homepage copy']);
  });

  it('returns 404 for another user\'s projectId or an unknown projectId', async () => {
    const res = await request(ctx.app).get(`/api/tasks?projectId=${bobProject.id}`).set(bearer(alice.token)).expect(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Project not found.' });
    await request(ctx.app).get(`/api/tasks?projectId=${randomUUID()}`).set(bearer(alice.token)).expect(404);
  });

  it('returns [] for an own project without tasks and for a user without tasks', async () => {
    const empty = await createProject(ctx.app, alice.token, { name: 'Empty' });
    expect(await names(`projectId=${empty.id}`)).toEqual([]);
    const carol = await registerMobile(ctx.app, 'Carol');
    const res = await request(ctx.app).get('/api/tasks').set(bearer(carol.token)).expect(200);
    expect(res.body).toEqual([]);
  });

  it('searches case-insensitively and partially, never across users', async () => {
    expect(await names('search=COPY')).toEqual(['Review copy', 'Write homepage copy']);
  });

  it('filters by status, priority and combinations', async () => {
    expect(await names('status=COMPLETED')).toEqual(['Review copy']);
    expect(await names('priority=HIGH')).toEqual(['Set up CI', 'Write homepage copy']);
    expect(await names(`priority=HIGH&projectId=${aliceProject.id}`)).toEqual(['Write homepage copy']);
    expect(await names('priority=HIGH&status=PENDING&search=ci')).toEqual(['Set up CI']);
  });

  it('rejects invalid filters', async () => {
    await request(ctx.app).get('/api/tasks?priority=URGENT').set(bearer(alice.token)).expect(400);
    await request(ctx.app).get('/api/tasks?projectId=abc').set(bearer(alice.token)).expect(400);
    await request(ctx.app).get('/api/tasks?ownerId=x').set(bearer(alice.token)).expect(400);
  });
});

describe('update (full replacement of five fields)', () => {
  it('replaces all editable fields and keeps the project', async () => {
    const task = await createTask(ctx.app, alice.token, aliceProject.id, { description: 'Old', dueDate: '2026-10-20' });
    const body = { name: 'Renamed', description: null, priority: 'HIGH', status: 'COMPLETED', dueDate: null };
    const res = await request(ctx.app).put(`/api/tasks/${task.id}`).set(bearer(alice.token)).send(body).expect(200);
    expect(res.body).toMatchObject({ ...body, projectId: aliceProject.id });
  });

  it('supports a quick action built from the current task (mark completed)', async () => {
    const task = await createTask(ctx.app, alice.token, aliceProject.id, { priority: 'LOW', dueDate: '2026-11-01' });
    const current = (await request(ctx.app).get(`/api/tasks/${task.id}`).set(bearer(alice.token)).expect(200)).body;
    const body = {
      name: current.name,
      description: current.description,
      priority: current.priority,
      status: 'COMPLETED',
      dueDate: current.dueDate,
    };
    const res = await request(ctx.app).put(`/api/tasks/${task.id}`).set(bearer(alice.token)).send(body).expect(200);
    expect(res.body).toMatchObject({ status: 'COMPLETED', priority: 'LOW', dueDate: '2026-11-01' });
  });

  it('rejects a partial body and changes nothing', async () => {
    const task = await createTask(ctx.app, alice.token, aliceProject.id);
    const res = await request(ctx.app)
      .put(`/api/tasks/${task.id}`)
      .set(bearer(alice.token))
      .send({ status: 'COMPLETED' })
      .expect(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
      'description',
      'dueDate',
      'name',
      'priority',
    ]);
    expect((await ctx.prisma.task.findUnique({ where: { id: task.id } }))?.status).toBe('PENDING');
  });

  it('rejects projectId in the body, even with the current value', async () => {
    const task = await createTask(ctx.app, alice.token, aliceProject.id);
    for (const projectId of [aliceProject.id, bobProject.id]) {
      const res = await request(ctx.app)
        .put(`/api/tasks/${task.id}`)
        .set(bearer(alice.token))
        .send({ ...fullTask, projectId })
        .expect(400);
      expect(res.body.error.details).toContainEqual({
        location: 'body',
        path: 'projectId',
        message: 'Project cannot be changed.',
      });
    }
    expect((await ctx.prisma.task.findUnique({ where: { id: task.id } }))?.projectId).toBe(aliceProject.id);
  });

  it('rejects server-owned fields', async () => {
    const task = await createTask(ctx.app, alice.token, aliceProject.id);
    for (const extra of [{ id: randomUUID() }, { createdAt: '2026-01-01T00:00:00.000Z' }, { ownerId: randomUUID() }]) {
      await request(ctx.app).put(`/api/tasks/${task.id}`).set(bearer(alice.token)).send({ ...fullTask, ...extra }).expect(400);
    }
  });

  it('clears the due date with null', async () => {
    const task = await createTask(ctx.app, alice.token, aliceProject.id, { dueDate: '2026-10-20' });
    const res = await request(ctx.app).put(`/api/tasks/${task.id}`).set(bearer(alice.token)).send(fullTask).expect(200);
    expect(res.body.dueDate).toBeNull();
  });
});

describe('ownership isolation and delete', () => {
  it('another user cannot update or delete a task (404) and nothing changes', async () => {
    const task = await createTask(ctx.app, alice.token, aliceProject.id, { name: 'Alice task' });
    await request(ctx.app)
      .put(`/api/tasks/${task.id}`)
      .set(bearer(bob.token))
      .send({ ...fullTask, name: 'Hijacked' })
      .expect(404);
    await request(ctx.app).delete(`/api/tasks/${task.id}`).set(bearer(bob.token)).expect(404);
    expect((await ctx.prisma.task.findUnique({ where: { id: task.id } }))?.name).toBe('Alice task');
  });

  it('deletes a task', async () => {
    const task = await createTask(ctx.app, alice.token, aliceProject.id);
    await request(ctx.app).delete(`/api/tasks/${task.id}`).set(bearer(alice.token)).expect(204);
    await request(ctx.app).get(`/api/tasks/${task.id}`).set(bearer(alice.token)).expect(404);
  });

  it('tasks disappear with their project (cascade)', async () => {
    const task = await createTask(ctx.app, alice.token, aliceProject.id);
    await request(ctx.app).delete(`/api/projects/${aliceProject.id}`).set(bearer(alice.token)).expect(204);
    await request(ctx.app).get(`/api/tasks/${task.id}`).set(bearer(alice.token)).expect(404);
  });
});
