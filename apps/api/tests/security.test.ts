import { Writable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { pino } from 'pino';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createPrismaClient } from '../src/lib/prisma.js';
import {
  bearer,
  createProject,
  createTestContext,
  loginWeb,
  PASSWORD,
  registerMobile,
  resetDatabase,
  TEST_JWT_SECRET,
  testConfig,
  uniqueEmail,
  WEB_ORIGIN,
  type MobileSession,
  type TestContext,
} from './support/helpers.js';
import { unreachableTestDatabaseUrl } from './support/test-database.js';

let ctx: TestContext;
let alice: MobileSession;

beforeAll(async () => {
  ctx = createTestContext();
  await resetDatabase(ctx.prisma);
  alice = await registerMobile(ctx.app, 'Alice');
});

describe('protected routes', () => {
  it.each([
    ['get', '/api/auth/me'],
    ['post', '/api/auth/logout'],
    ['get', '/api/projects'],
    ['post', '/api/projects'],
    ['get', `/api/projects/${randomUUID()}`],
    ['put', `/api/projects/${randomUUID()}`],
    ['delete', `/api/projects/${randomUUID()}`],
    ['get', '/api/tasks'],
    ['post', '/api/tasks'],
    ['get', `/api/tasks/${randomUUID()}`],
    ['put', `/api/tasks/${randomUUID()}`],
    ['delete', `/api/tasks/${randomUUID()}`],
    ['get', '/api/dashboard'],
  ] as const)('%s %s requires authentication', async (method, path) => {
    const res = await request(ctx.app)[method](path).expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('origin check (CSRF) and CORS', () => {
  it('rejects a cookie request from a foreign origin', async () => {
    const cookie = await loginWeb(ctx.app, alice.email);
    const res = await request(ctx.app)
      .post('/api/projects')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example.com')
      .send({ name: 'CSRF' })
      .expect(403);
    expect(res.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('rejects a cookie request without an Origin header', async () => {
    const cookie = await loginWeb(ctx.app, alice.email);
    await request(ctx.app).post('/api/projects').set('Cookie', cookie).send({ name: 'No origin' }).expect(403);
    await request(ctx.app).post('/api/projects').set('Cookie', cookie).set('Origin', 'null').send({ name: 'x' }).expect(403);
  });

  it('accepts a cookie request from the allowed origin', async () => {
    const cookie = await loginWeb(ctx.app, alice.email);
    await request(ctx.app)
      .post('/api/projects')
      .set('Cookie', cookie)
      .set('Origin', WEB_ORIGIN)
      .send({ name: 'Allowed' })
      .expect(201);
  });

  it('accepts a bearer request without an Origin header (mobile)', async () => {
    await request(ctx.app).post('/api/projects').set(bearer(alice.token)).send({ name: 'Mobile' }).expect(201);
  });

  it('rejects login from a foreign origin (login CSRF)', async () => {
    await request(ctx.app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example.com')
      .send({ email: alice.email, password: PASSWORD })
      .expect(403);
  });

  it('sends CORS headers only to allowed origins and never "*"', async () => {
    const allowed = await request(ctx.app)
      .options('/api/projects')
      .set('Origin', WEB_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(allowed.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const denied = await request(ctx.app)
      .options('/api/projects')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();

    const simple = await request(ctx.app).get('/api/health').set('Origin', 'https://evil.example.com');
    expect(simple.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('input handling', () => {
  it('returns INVALID_JSON for a malformed body', async () => {
    const res = await request(ctx.app)
      .post('/api/projects')
      .set(bearer(alice.token))
      .set('Content-Type', 'application/json')
      .send('{"name": ')
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('returns 415 for a non-JSON body', async () => {
    const res = await request(ctx.app)
      .post('/api/projects')
      .set(bearer(alice.token))
      .set('Content-Type', 'text/plain')
      .send('name=x')
      .expect(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('returns 413 for a body over 100 kb', async () => {
    const res = await request(ctx.app)
      .post('/api/projects')
      .set(bearer(alice.token))
      .send({ name: 'Big', description: 'a'.repeat(110 * 1024) })
      .expect(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('treats SQL-like input as plain data', async () => {
    const name = "Robert'); DROP TABLE projects; --";
    const created = await createProject(ctx.app, alice.token, { name });
    expect(created.name).toBe(name);

    const res = await request(ctx.app)
      .get(`/api/projects?search=${encodeURIComponent("' OR 1=1 --")}`)
      .set(bearer(alice.token))
      .expect(200);
    expect(res.body).toEqual([]);
    expect(await ctx.prisma.project.count()).toBeGreaterThan(0);
  });

  it('returns ROUTE_NOT_FOUND for unknown routes, with the request id', async () => {
    const res = await request(ctx.app).get('/api/unknown').set('X-Request-Id', 'abc-123').expect(404);
    expect(res.body.error).toEqual({ code: 'ROUTE_NOT_FOUND', message: 'Route not found.', requestId: 'abc-123' });
    expect(res.headers['x-request-id']).toBe('abc-123');
  });

  it('replaces an unsafe X-Request-Id with a generated one', async () => {
    const res = await request(ctx.app).get('/api/health').set('X-Request-Id', 'bad id with spaces');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('sets security headers', async () => {
    const res = await request(ctx.app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});

describe('rate limiting', () => {
  it('limits failed logins per IP + email, without counting successful logins', async () => {
    const limited = createTestContext({
      rateLimit: { windowMs: 60_000, loginAccountMax: 2, loginIpMax: 100, registerIpMax: 100 },
    });
    const { email } = await registerMobile(limited.app);

    // Successful logins are not counted as failures.
    for (let i = 0; i < 3; i += 1) {
      await request(limited.app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
    }

    await request(limited.app).post('/api/auth/login').send({ email, password: 'wrong-1' }).expect(401);
    await request(limited.app).post('/api/auth/login').send({ email, password: 'wrong-2' }).expect(401);
    const blocked = await request(limited.app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

    // Another account from the same IP is not affected by this account's limit.
    await request(limited.app)
      .post('/api/auth/login')
      .send({ email: email.toUpperCase().replace('@EXAMPLE.COM', '@other.example.com'), password: 'x' })
      .expect(401);
  });

  it('limits login attempts per IP', async () => {
    const limited = createTestContext({
      rateLimit: { windowMs: 60_000, loginAccountMax: 100, loginIpMax: 3, registerIpMax: 100 },
    });
    for (let i = 0; i < 3; i += 1) {
      await request(limited.app).post('/api/auth/login').send({ email: uniqueEmail(), password: 'x' }).expect(401);
    }
    await request(limited.app).post('/api/auth/login').send({ email: uniqueEmail(), password: 'x' }).expect(429);
  });

  it('limits registrations per IP', async () => {
    const limited = createTestContext({
      rateLimit: { windowMs: 60_000, loginAccountMax: 100, loginIpMax: 100, registerIpMax: 2 },
    });
    await registerMobile(limited.app);
    await registerMobile(limited.app);
    const res = await request(limited.app)
      .post('/api/auth/register')
      .send({ fullName: 'Third', email: uniqueEmail(), password: PASSWORD })
      .expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('no sensitive data leaks', () => {
  it('never returns password hashes', async () => {
    const email = uniqueEmail();
    const register = await request(ctx.app)
      .post('/api/auth/register')
      .set('X-Client-Type', 'mobile')
      .send({ fullName: 'Leak Check', email, password: PASSWORD })
      .expect(201);
    const me = await request(ctx.app).get('/api/auth/me').set(bearer(register.body.token)).expect(200);
    for (const body of [register.body, me.body]) {
      expect(JSON.stringify(body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    }
  });

  it('returns a generic 500 without internal details when the database is down', async () => {
    // Same test database settings, but a port where nothing listens (built at runtime).
    const brokenPrisma = createPrismaClient(unreachableTestDatabaseUrl());
    const app = createApp({ config: testConfig(), prisma: brokenPrisma, logger: pino({ level: 'silent' }) });
    const token = jwt.sign({ sub: randomUUID(), jti: randomUUID() }, TEST_JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '1h',
    });

    const res = await request(app).get('/api/dashboard').set(bearer(token)).expect(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', requestId: expect.any(String) },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|ECONNREFUSED|stack|127\.0\.0\.1|pm_test/i);

    const health = await request(app).get('/api/health').expect(503);
    expect(health.body).toEqual({ status: 'error', database: 'unavailable' });
    await brokenPrisma.$disconnect();
  });

  it('keeps tokens, cookies and passwords out of the logs', async () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(String(chunk));
        callback();
      },
    });
    const logged = createTestContext({}, pino({ level: 'trace' }, sink));
    const email = uniqueEmail();
    const register = await request(logged.app)
      .post('/api/auth/register')
      .set('X-Client-Type', 'mobile')
      .send({ fullName: 'Log Check', email, password: PASSWORD })
      .expect(201);
    const token = register.body.token as string;
    const cookie = await loginWeb(logged.app, email);
    await request(logged.app).get('/api/auth/me').set(bearer(token)).expect(200);
    await request(logged.app).get('/api/auth/me').set('Cookie', cookie).expect(200);
    await request(logged.app).post('/api/auth/login').send({ email, password: 'wrong-password' }).expect(401);

    const output = lines.join('\n');
    expect(lines.length).toBeGreaterThan(0);
    expect(output).not.toContain(token);
    expect(output).not.toContain(cookie.split('=')[1]!);
    expect(output).not.toContain(PASSWORD);
    expect(output).not.toContain('wrong-password');
    expect(output).not.toContain(email);
  });
});

describe('health and documentation', () => {
  it('GET /api/health reports the database', async () => {
    const res = await request(ctx.app).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'ok' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('documents exactly the implemented endpoints', async () => {
    const res = await request(ctx.app).get('/api/docs.json').expect(200);
    const operations = Object.entries(res.body.paths as Record<string, Record<string, unknown>>)
      .flatMap(([path, methods]) => Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`))
      .sort();
    expect(operations).toEqual(
      [
        'POST /api/auth/register',
        'POST /api/auth/login',
        'POST /api/auth/logout',
        'GET /api/auth/me',
        'GET /api/projects',
        'POST /api/projects',
        'GET /api/projects/{id}',
        'PUT /api/projects/{id}',
        'DELETE /api/projects/{id}',
        'GET /api/tasks',
        'POST /api/tasks',
        'GET /api/tasks/{id}',
        'PUT /api/tasks/{id}',
        'DELETE /api/tasks/{id}',
        'GET /api/dashboard',
        'GET /api/health',
      ].sort(),
    );
    expect(Object.keys(res.body.components.securitySchemes).sort()).toEqual(['bearerAuth', 'cookieAuth']);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|JWT_SECRET|DATABASE_URL/);
  });

  it('serves Swagger UI at /api/docs', async () => {
    const res = await request(ctx.app).get('/api/docs/').expect(200);
    expect(res.text).toContain('swagger-ui');
  });
});
