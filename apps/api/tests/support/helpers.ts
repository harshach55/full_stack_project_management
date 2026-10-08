import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '@pm/shared';
import type { Express } from 'express';
import { pino, type Logger } from 'pino';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import type { Config } from '../../src/config/env.js';
import { createPrismaClient } from '../../src/lib/prisma.js';
import { testDatabaseUrl } from './test-database.js';

export const WEB_ORIGIN = 'http://localhost:3000';
/** Random signing key generated for each test run; no secret is stored in the repository. */
export const TEST_JWT_SECRET = randomBytes(48).toString('base64url');
export const PASSWORD = 'correct-horse-battery';

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    nodeEnv: 'test',
    port: 0,
    databaseUrl: testDatabaseUrl(),
    jwtSecret: TEST_JWT_SECRET,
    tokenTtlSeconds: SESSION_TTL_SECONDS,
    corsAllowedOrigins: [WEB_ORIGIN],
    cookieSecure: true,
    trustProxyHops: 0,
    // High limits so ordinary tests are never throttled; rate-limit tests lower them.
    rateLimit: { windowMs: 15 * 60 * 1000, loginAccountMax: 1000, loginIpMax: 1000, registerIpMax: 1000 },
    logLevel: 'silent',
    ...overrides,
  };
}

export interface TestContext {
  app: Express;
  prisma: PrismaClient;
  config: Config;
}

let sharedPrisma: PrismaClient | undefined;

export function testPrisma(): PrismaClient {
  sharedPrisma ??= createPrismaClient(testDatabaseUrl());
  return sharedPrisma;
}

export function createTestContext(overrides: Partial<Config> = {}, logger?: Logger): TestContext {
  const config = testConfig(overrides);
  const prisma = testPrisma();
  const app = createApp({ config, prisma, logger: logger ?? pino({ level: 'silent' }) });
  return { app, prisma, config };
}

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRaw`TRUNCATE TABLE "tasks", "projects", "revoked_tokens", "users" CASCADE`;
}

let emailCounter = 0;
export function uniqueEmail(prefix = 'user'): string {
  emailCounter += 1;
  return `${prefix}.${Date.now()}.${emailCounter}@example.com`;
}

export interface MobileSession {
  token: string;
  userId: string;
  email: string;
}

/** Registers through the API in mobile mode and returns the bearer token. */
export async function registerMobile(app: Express, fullName = 'Test User'): Promise<MobileSession> {
  const email = uniqueEmail();
  const res = await request(app)
    .post('/api/auth/register')
    .set('X-Client-Type', 'mobile')
    .send({ fullName, email, password: PASSWORD })
    .expect(201);
  return { token: res.body.token as string, userId: res.body.user.id as string, email };
}

/** Logs in through the API in web mode and returns the Cookie header value. */
export async function loginWeb(app: Express, email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/login')
    .set('Origin', WEB_ORIGIN)
    .send({ email, password: PASSWORD })
    .expect(200);
  return sessionCookieFrom(res.headers['set-cookie']);
}

export function sessionCookieFrom(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const session = cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!session) throw new Error('No session cookie in response');
  return session.split(';')[0]!;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function createProject(app: Express, token: string, body: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/projects')
    .set(bearer(token))
    .send({ name: 'Project', ...body })
    .expect(201);
  return res.body as { id: string; name: string; status: string };
}

export async function createTask(app: Express, token: string, projectId: string, body: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/tasks')
    .set(bearer(token))
    .send({ projectId, name: 'Task', ...body })
    .expect(201);
  return res.body as { id: string; projectId: string; name: string; status: string; priority: string };
}
