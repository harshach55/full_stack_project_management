import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

// Unit tests for the platform-independent modules (API client, session rules, request
// bodies). They run in Node; they are not device tests.
export default defineConfig({
  resolve: { alias: { '@': path.join(root, 'src') } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
