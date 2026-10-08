import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { defineConfig } from 'vitest/config';

// Optional local test settings (TEST_DATABASE_URL, ...) from apps/api/.env.test, which is
// git-ignored. Variables already set in the shell take precedence.
const envTestFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env.test');
if (existsSync(envTestFile)) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(envTestFile, 'utf8')))) {
    if (process.env[key] === undefined && value !== undefined && value !== '') process.env[key] = value;
  }
}

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/support/global-setup.ts'],
    // Test files share one database and truncate it, so they run one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/types/**'],
      reporter: ['text-summary', 'text'],
    },
  },
});
