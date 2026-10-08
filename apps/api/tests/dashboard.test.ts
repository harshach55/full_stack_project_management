import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
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

  const a1 = await createProject(ctx.app, alice.token, { status: 'IN_PROGRESS' });
  const a2 = await createProject(ctx.app, alice.token, { status: 'COMPLETED' });
  await createProject(ctx.app, alice.token, { status: 'IN_PROGRESS' });
  await createTask(ctx.app, alice.token, a1.id, { status: 'PENDING' });
  await createTask(ctx.app, alice.token, a1.id, { status: 'PENDING' });
  await createTask(ctx.app, alice.token, a1.id, { status: 'IN_PROGRESS' });
  await createTask(ctx.app, alice.token, a2.id, { status: 'COMPLETED' });

  const b1 = await createProject(ctx.app, bob.token, { status: 'IN_PROGRESS' });
  await createTask(ctx.app, bob.token, b1.id, { status: 'COMPLETED' });
  await createTask(ctx.app, bob.token, b1.id, { status: 'COMPLETED' });
});

describe('GET /api/dashboard', () => {
  it('returns counts for the caller only', async () => {
    const res = await request(ctx.app).get('/api/dashboard').set(bearer(alice.token)).expect(200);
    expect(res.body).toEqual({
      totalProjects: 3,
      projectsInProgress: 2,
      totalTasks: 4,
      completedTasks: 1,
      pendingTasks: 2,
      inProgressTasks: 1,
    });
  });

  it('isolates users from each other', async () => {
    const res = await request(ctx.app).get('/api/dashboard').set(bearer(bob.token)).expect(200);
    expect(res.body).toEqual({
      totalProjects: 1,
      projectsInProgress: 1,
      totalTasks: 2,
      completedTasks: 2,
      pendingTasks: 0,
      inProgressTasks: 0,
    });
  });

  it('returns zeros for a new user', async () => {
    const carol = await registerMobile(ctx.app, 'Carol');
    const res = await request(ctx.app).get('/api/dashboard').set(bearer(carol.token)).expect(200);
    expect(Object.values(res.body)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('pending excludes in-progress tasks and reflects updates', async () => {
    const project = await createProject(ctx.app, bob.token);
    const task = await createTask(ctx.app, bob.token, project.id);
    let res = await request(ctx.app).get('/api/dashboard').set(bearer(bob.token)).expect(200);
    expect(res.body.pendingTasks).toBe(1);

    await request(ctx.app)
      .put(`/api/tasks/${task.id}`)
      .set(bearer(bob.token))
      .send({ name: 'Task', description: null, priority: 'MEDIUM', status: 'IN_PROGRESS', dueDate: null })
      .expect(200);
    res = await request(ctx.app).get('/api/dashboard').set(bearer(bob.token)).expect(200);
    expect(res.body).toMatchObject({ pendingTasks: 0, inProgressTasks: 1 });
  });

  it('requires authentication and rejects query parameters', async () => {
    await request(ctx.app).get('/api/dashboard').expect(401);
    await request(ctx.app).get('/api/dashboard?userId=x').set(bearer(alice.token)).expect(400);
  });
});
