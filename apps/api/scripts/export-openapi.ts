/*
 * Writes the OpenAPI document served at /api/docs.json to docs/openapi.json.
 *
 *   pnpm --filter @pm/api docs:openapi          write the file
 *   pnpm --filter @pm/api docs:openapi:check    exit 1 if the file differs from the generated document
 *
 * The document comes from buildOpenApiDocument(), the same function the API uses,
 * so no server, database or environment variables are needed. Build the shared
 * package first (pnpm --filter @pm/shared build).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildOpenApiDocument } from '../src/docs/openapi.js';

const outputPath = fileURLToPath(new URL('../../../docs/openapi.json', import.meta.url));
const generated = `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`;

if (process.argv.includes('--check')) {
  let current = '';
  try {
    // Compare with LF line endings so a Windows checkout does not report a difference.
    current = readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    console.error('docs/openapi.json is missing. Run: pnpm --filter @pm/api docs:openapi');
    process.exit(1);
  }
  if (current !== generated) {
    console.error('docs/openapi.json is out of date. Run: pnpm --filter @pm/api docs:openapi');
    process.exit(1);
  }
  console.log('docs/openapi.json matches the generated document.');
} else {
  writeFileSync(outputPath, generated);
  console.log('Wrote docs/openapi.json');
}
