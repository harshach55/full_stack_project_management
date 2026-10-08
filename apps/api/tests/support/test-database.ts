/**
 * Test database location, supplied by the developer (never stored in the repository).
 *
 * TEST_DATABASE_URL is read from the shell or from apps/api/.env.test (git-ignored;
 * see apps/api/.env.test.example and apps/api/README.md).
 *
 * Safety rule: tests refuse to run unless the URL points to a local host and a database
 * whose name ends in "_test", so they can never touch a deployed database.
 */

const SETUP_HELP =
  'Set TEST_DATABASE_URL to the connection URL of the local test database (pm_test in the Docker ' +
  'PostgreSQL), either in your shell or in apps/api/.env.test. See apps/api/README.md, section "Tests".';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function assertSafeTestDatabase(url: string, variableName = 'TEST_DATABASE_URL'): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${variableName} is not a valid URL. ${SETUP_HELP}`);
  }
  const databaseName = parsed.pathname.replace(/^\//, '');
  if (!LOCAL_HOSTS.has(parsed.hostname) || !databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests: ${variableName} must point to a local database whose name ends in "_test" ` +
        `(got host "${parsed.hostname}", database "${databaseName}").`,
    );
  }
}

/** Runtime database connection for tests (may point at a pooler). Fails clearly when not configured. */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error(`TEST_DATABASE_URL is not set. ${SETUP_HELP}`);
  assertSafeTestDatabase(url);
  return url;
}

/** Direct (non-pooled) connection used for migrations; defaults to TEST_DATABASE_URL. */
export function testDirectDatabaseUrl(): string {
  const url = process.env.TEST_DIRECT_DATABASE_URL || testDatabaseUrl();
  assertSafeTestDatabase(url, 'TEST_DIRECT_DATABASE_URL');
  return url;
}

/**
 * A URL for the same test database on a port where nothing listens, built at runtime from
 * TEST_DATABASE_URL. Used to simulate a database outage.
 */
export function unreachableTestDatabaseUrl(): string {
  const url = new URL(testDatabaseUrl());
  url.hostname = '127.0.0.1';
  url.port = '1';
  return url.toString();
}
