// Runs Prisma migration commands against the production database (ADR-0011).
//
// Connection settings come only from apps/api/.env.production (git-ignored). They are
// passed to Prisma as process variables, which take precedence over anything Prisma
// would load from apps/api/.env, so a local development file can never be used by mistake.
// Connection strings are never printed; only the target host, port and database name are.
//
// TLS is always verified against the Supabase CA (certs/prod-ca-2021.crt, ADR-0007):
// - DIRECT_URL (Prisma migration engine) is forced to sslmode=require, sslaccept=strict and
//   sslcert pointing to the CA. A weaker or different TLS setting in the file is refused.
// - DATABASE_URL (runtime, pg driver) must use sslmode=verify-full. The check command
//   trusts the CA through NODE_EXTRA_CA_CERTS, the same way the deployed API does.
//
// Usage (from apps/api):
//   node scripts/prisma-production.mjs check    connect like the running API and list tables
//   node scripts/prisma-production.mjs status   prisma migrate status
//   node scripts/prisma-production.mjs deploy   prisma migrate deploy
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(apiDir, '.env.production');
const caFile = path.join(apiDir, 'certs', 'prod-ca-2021.crt');
// Prisma resolves sslcert relative to the schema file (apps/api/prisma).
const CA_FOR_PRISMA = '../certs/prod-ca-2021.crt';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function fail(message) {
  console.error(`prisma-production: ${message}`);
  process.exit(1);
}

function readTarget(env, name) {
  const value = env[name];
  if (!value) fail(`${name} is missing in apps/api/.env.production`);
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${name} is not a valid URL`);
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') fail(`${name} must be a PostgreSQL URL`);
  if (LOCAL_HOSTS.has(url.hostname) || url.hostname.startsWith('127.')) {
    fail(`${name} points to a local database; this script is for production only`);
  }
  return { url, label: `${url.hostname}:${url.port || '5432'}${url.pathname}` };
}

/** Checks the TLS-related query parameters of a URL against an allowlist of exact values. */
function checkTlsParams(name, url, allowed) {
  for (const key of new Set(url.searchParams.keys())) {
    const isTlsParam = key.startsWith('ssl') || key === 'uselibpqcompat';
    if (!isTlsParam) continue;
    const values = url.searchParams.getAll(key);
    if (values.length > 1) fail(`${name}: ${key} is set more than once`);
    if (!(key in allowed) || !allowed[key].includes(values[0])) {
      fail(`${name}: ${key}=${values[0]} is not allowed (certificate verification must stay strict)`);
    }
  }
}

/** Runtime URL: the pg driver must verify the certificate and the host name. */
function checkRuntimeUrl(target) {
  checkTlsParams('DATABASE_URL', target.url, { sslmode: ['verify-full'] });
  if (target.url.searchParams.get('sslmode') !== 'verify-full') fail('DATABASE_URL must set sslmode=verify-full');
  return target.url.toString();
}

/** Migration URL: forced to strict verification against the Supabase CA. */
function strictDirectUrl(target) {
  checkTlsParams('DIRECT_URL', target.url, {
    sslmode: ['require'],
    sslaccept: ['strict'],
    sslcert: [CA_FOR_PRISMA],
  });
  const url = new URL(target.url.toString());
  url.searchParams.set('sslmode', 'require');
  url.searchParams.set('sslaccept', 'strict');
  url.searchParams.set('sslcert', CA_FOR_PRISMA);
  return url.toString();
}

const command = process.argv[2];
if (!['check', 'status', 'deploy'].includes(command)) fail('usage: prisma-production.mjs check|status|deploy');
if (!existsSync(envFile)) fail('apps/api/.env.production not found (copy .env.production.example and fill it in)');
if (!existsSync(caFile)) fail('certs/prod-ca-2021.crt not found (Supabase CA certificate, see docs/deployment.md)');

const fileEnv = parseEnv(readFileSync(envFile, 'utf8'));
const runtime = readTarget(fileEnv, 'DATABASE_URL');
const direct = readTarget(fileEnv, 'DIRECT_URL');
const runtimeUrl = checkRuntimeUrl(runtime);
const directUrl = strictDirectUrl(direct);

const require = createRequire(path.join(apiDir, 'package.json'));

if (command === 'check') {
  // NODE_EXTRA_CA_CERTS is read only when Node starts, so restart this script with it set.
  if (process.env.NODE_EXTRA_CA_CERTS !== caFile) {
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), 'check'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_EXTRA_CA_CERTS: caFile },
    });
    process.exit(child.status ?? 1);
  }
  // Same driver path as the running API: Prisma client with the pg adapter on DATABASE_URL.
  console.log(`Runtime connection (DATABASE_URL): ${runtime.label}, TLS: verify-full with the Supabase CA`);
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: runtimeUrl }) });
  try {
    const [info] = await prisma.$queryRaw`SELECT current_database()::text AS db, current_setting('server_version') AS version`;
    console.log(`Connected: database ${info.db}, PostgreSQL ${info.version}`);
    const tables = await prisma.$queryRaw`SELECT table_name::text AS table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
    console.log(`Tables in schema public: ${tables.length === 0 ? '(none)' : tables.map((t) => t.table_name).join(', ')}`);
  } catch (error) {
    fail(`connection failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  } finally {
    await prisma.$disconnect();
  }
  process.exit(0);
}

console.log(`Migration connection (DIRECT_URL): ${direct.label}, TLS: strict with the Supabase CA`);
const prismaCli = require.resolve('prisma/build/index.js');
const result = spawnSync(process.execPath, [prismaCli, 'migrate', command], {
  cwd: apiDir,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: runtimeUrl, DIRECT_URL: directUrl, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
});
process.exit(result.status ?? 1);
