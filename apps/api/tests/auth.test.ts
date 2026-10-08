import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  bearer,
  createTestContext,
  loginWeb,
  PASSWORD,
  registerMobile,
  resetDatabase,
  sessionCookieFrom,
  TEST_JWT_SECRET,
  uniqueEmail,
  WEB_ORIGIN,
  type TestContext,
} from './support/helpers.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = createTestContext();
  await resetDatabase(ctx.prisma);
});

describe('POST /api/auth/register', () => {
  it('web mode: sets the session cookie and returns only the user', async () => {
    const email = uniqueEmail();
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .set('Origin', WEB_ORIGIN)
      .send({ fullName: '  Alice Example  ', email, password: PASSWORD })
      .expect(201);

    expect(res.body).toEqual({
      user: { id: expect.any(String), fullName: 'Alice Example', email, createdAt: expect.any(String) },
    });
    expect(res.body.token).toBeUndefined();

    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('pm_session='))!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=604800');
    expect(cookie).not.toMatch(/Domain=/i);
  });

  it('mobile mode: returns the token and expiry, sets no cookie', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .set('X-Client-Type', 'mobile')
      .send({ fullName: 'Bob', email: uniqueEmail(), password: PASSWORD })
      .expect(201);

    expect(res.body.token).toEqual(expect.any(String));
    expect(new Date(res.body.expiresAt).getTime() - Date.now()).toBeGreaterThan(6.9 * 24 * 3600 * 1000);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('normalizes the email to lowercase before storing it', async () => {
    const email = uniqueEmail();
    await request(ctx.app)
      .post('/api/auth/register')
      .set('X-Client-Type', 'mobile')
      .send({ fullName: 'Case', email: `  ${email.toUpperCase()} `, password: PASSWORD })
      .expect(201);
    const stored = await ctx.prisma.user.findUnique({ where: { email } });
    expect(stored?.email).toBe(email);
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$12\$/);
    expect(stored?.passwordHash).not.toContain(PASSWORD);
  });

  it('rejects a duplicate email in any letter case with 409', async () => {
    const { email } = await registerMobile(ctx.app);
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .set('X-Client-Type', 'mobile')
      .send({ fullName: 'Dup', email: email.toUpperCase(), password: PASSWORD })
      .expect(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('reports every missing field', async () => {
    const res = await request(ctx.app).post('/api/auth/register').send({}).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d: { path: string }) => d.path).sort();
    expect(paths).toEqual(['email', 'fullName', 'password']);
  });

  it.each([
    ['invalid email', { email: 'not-an-email' }],
    ['short password', { password: 'short' }],
    ['password over 72 bytes', { password: 'a'.repeat(73) }],
    ['multi-byte password over 72 bytes', { password: '\u20ac'.repeat(25) }],
    ['blank full name', { fullName: '   ' }],
    ['full name over 100 characters', { fullName: 'a'.repeat(101) }],
    ['unknown field', { role: 'admin' }],
    ['server-owned field', { passwordHash: 'x' }],
  ])('rejects %s', async (_label, override) => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ fullName: 'Valid Name', email: uniqueEmail(), password: PASSWORD, ...override })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects X-Client-Type: mobile from a browser (Origin present) with 403', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .set('X-Client-Type', 'mobile')
      .set('Origin', WEB_ORIGIN)
      .send({ fullName: 'Browser', email: uniqueEmail(), password: PASSWORD })
      .expect(403);
    expect(res.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('rejects an unsupported X-Client-Type value with 400', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .set('X-Client-Type', 'desktop')
      .send({ fullName: 'Desk', email: uniqueEmail(), password: PASSWORD })
      .expect(400);
    expect(res.body.error.details[0]).toMatchObject({ location: 'headers', path: 'X-Client-Type' });
  });
});

describe('POST /api/auth/login', () => {
  let email: string;

  beforeAll(async () => {
    ({ email } = await registerMobile(ctx.app));
  });

  it('web mode sets the cookie; mobile mode returns a token', async () => {
    const web = await request(ctx.app)
      .post('/api/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({ email, password: PASSWORD })
      .expect(200);
    expect(web.body.token).toBeUndefined();
    expect(sessionCookieFrom(web.headers['set-cookie'])).toMatch(/^pm_session=.+/);

    const mobile = await request(ctx.app)
      .post('/api/auth/login')
      .set('X-Client-Type', 'mobile')
      .send({ email: `  ${email.toUpperCase()}`, password: PASSWORD })
      .expect(200);
    expect(mobile.body.user.email).toBe(email);
    expect(mobile.body.token).toEqual(expect.any(String));
  });

  it('returns the same 401 for a wrong password and an unknown email', async () => {
    const wrongStart = Date.now();
    const wrong = await request(ctx.app).post('/api/auth/login').send({ email, password: 'wrong-password' }).expect(401);
    const wrongMs = Date.now() - wrongStart;

    const unknownStart = Date.now();
    const unknown = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail('nobody'), password: 'wrong-password' })
      .expect(401);
    const unknownMs = Date.now() - unknownStart;

    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
    // The unknown-email path also runs a bcrypt comparison (dummy hash), so it is not much faster.
    expect(unknownMs).toBeGreaterThan(wrongMs * 0.4);
  });

  it('validates the body', async () => {
    const res = await request(ctx.app).post('/api/auth/login').send({ email: 'x' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('authentication of protected routes', () => {
  let session: { token: string; userId: string; email: string };

  beforeAll(async () => {
    session = await registerMobile(ctx.app, 'Me Tester');
  });

  it('GET /api/auth/me works with a bearer token', async () => {
    const res = await request(ctx.app).get('/api/auth/me').set(bearer(session.token)).expect(200);
    expect(res.body).toEqual({
      user: { id: session.userId, fullName: 'Me Tester', email: session.email, createdAt: expect.any(String) },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it('GET /api/auth/me works with the session cookie', async () => {
    const cookie = await loginWeb(ctx.app, session.email);
    const res = await request(ctx.app).get('/api/auth/me').set('Cookie', cookie).expect(200);
    expect(res.body.user.id).toBe(session.userId);
  });

  const expectUnauthenticated = async (headers: Record<string, string>, code: string) => {
    const res = await request(ctx.app).get('/api/auth/me').set(headers).expect(401);
    expect(res.body.error.code).toBe(code);
  };

  it('rejects a missing credential', () => expectUnauthenticated({}, 'UNAUTHENTICATED'));
  it('rejects a malformed Authorization header', () =>
    expectUnauthenticated({ Authorization: 'Token abc' }, 'UNAUTHENTICATED'));
  it('rejects "Bearer" without a token', () => expectUnauthenticated({ Authorization: 'Bearer' }, 'UNAUTHENTICATED'));
  it('rejects a malformed JWT', () => expectUnauthenticated(bearer('not.a.jwt'), 'UNAUTHENTICATED'));

  it('rejects an invalid signature', () => {
    const forged = jwt.sign({ sub: session.userId, jti: randomUUID() }, 'some-other-secret-with-enough-bytes!!', {
      algorithm: 'HS256',
      expiresIn: '1h',
    });
    return expectUnauthenticated(bearer(forged), 'UNAUTHENTICATED');
  });

  it('rejects a different algorithm even with the right secret', () => {
    const hs512 = jwt.sign({ sub: session.userId, jti: randomUUID() }, TEST_JWT_SECRET, {
      algorithm: 'HS512',
      expiresIn: '1h',
    });
    return expectUnauthenticated(bearer(hs512), 'UNAUTHENTICATED');
  });

  it('rejects an unsigned token (alg none)', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: session.userId, jti: randomUUID(), exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString('base64url');
    return expectUnauthenticated(bearer(`${header}.${payload}.`), 'UNAUTHENTICATED');
  });

  it('rejects a token with missing claims', () => {
    const noJti = jwt.sign({ sub: session.userId }, TEST_JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    return expectUnauthenticated(bearer(noJti), 'UNAUTHENTICATED');
  });

  it('reports an expired token as TOKEN_EXPIRED', () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const expired = jwt.sign({ sub: session.userId, jti: randomUUID(), iat: past - 3600, exp: past }, TEST_JWT_SECRET, {
      algorithm: 'HS256',
    });
    return expectUnauthenticated(bearer(expired), 'TOKEN_EXPIRED');
  });

  it('does not fall back to a valid cookie when the bearer token is invalid', async () => {
    const cookie = await loginWeb(ctx.app, session.email);
    const res = await request(ctx.app).get('/api/auth/me').set('Cookie', cookie).set(bearer('invalid')).expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes only the current token; the other session keeps working', async () => {
    const { token: mobileToken, email } = await registerMobile(ctx.app);
    const webCookie = await loginWeb(ctx.app, email);

    await request(ctx.app).post('/api/auth/logout').set(bearer(mobileToken)).expect(204);

    const revoked = await request(ctx.app).get('/api/auth/me').set(bearer(mobileToken)).expect(401);
    expect(revoked.body.error.code).toBe('TOKEN_REVOKED');
    // Mobile logout does not log out the web session.
    await request(ctx.app).get('/api/auth/me').set('Cookie', webCookie).expect(200);
  });

  it('web logout clears the cookie and leaves the mobile token valid', async () => {
    const { token: mobileToken, email } = await registerMobile(ctx.app);
    const webCookie = await loginWeb(ctx.app, email);

    const res = await request(ctx.app)
      .post('/api/auth/logout')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', webCookie)
      .expect(204);
    const cleared = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('pm_session='))!;
    expect(cleared).toMatch(/^pm_session=;/);
    expect(cleared).toContain('Max-Age=0');

    await request(ctx.app).get('/api/auth/me').set('Cookie', webCookie).expect(401);
    await request(ctx.app).get('/api/auth/me').set(bearer(mobileToken)).expect(200);
  });

  it('a repeated logout with the same token returns TOKEN_REVOKED and still clears the cookie', async () => {
    const { email } = await registerMobile(ctx.app);
    const webCookie = await loginWeb(ctx.app, email);
    await request(ctx.app).post('/api/auth/logout').set('Origin', WEB_ORIGIN).set('Cookie', webCookie).expect(204);

    const again = await request(ctx.app)
      .post('/api/auth/logout')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', webCookie)
      .expect(401);
    expect(again.body.error.code).toBe('TOKEN_REVOKED');
    expect(String(again.headers['set-cookie'])).toContain('Max-Age=0');
  });

  it('stores the jti with the token expiry', async () => {
    const { token, userId } = await registerMobile(ctx.app);
    await request(ctx.app).post('/api/auth/logout').set(bearer(token)).expect(204);
    const { jti, exp } = jwt.decode(token) as { jti: string; exp: number };
    const row = await ctx.prisma.revokedToken.findUnique({ where: { jti } });
    expect(row?.userId).toBe(userId);
    expect(row?.expiresAt.getTime()).toBe(exp * 1000);
  });

  it('requires authentication', async () => {
    await request(ctx.app).post('/api/auth/logout').expect(401);
  });
});
