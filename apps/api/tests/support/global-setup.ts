import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { testDatabaseUrl, testDirectDatabaseUrl } from './test-database.js';

/** Applies all migrations to the local test database before the test run. */
export default function setup(): void {
  // Both calls fail with setup instructions if the variables are missing or not a local test database.
  const databaseUrl = testDatabaseUrl();
  const directUrl = testDirectDatabaseUrl();

  const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');

  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], {
    cwd: apiRoot,
    // Migrations use the direct connection when TEST_DIRECT_DATABASE_URL is set (for runs through a
    // transaction-mode pooler), mirroring DATABASE_URL/DIRECT_URL in production.
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: directUrl },
    stdio: 'pipe',
  });
}
