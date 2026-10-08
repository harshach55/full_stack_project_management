import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * The browser only talks to this app's own origin. Requests to /api/* are forwarded to the
 * Express API, so the session cookie is first-party and the JWT never reaches browser code
 * (ADR-0004). API_ORIGIN is server-side configuration (no NEXT_PUBLIC_ prefix): it is read
 * when the app is built and never sent to the browser.
 */
function apiOrigin(): string {
  const value = process.env.API_ORIGIN;
  if (!value) {
    if (process.env.NODE_ENV !== 'production') return 'http://localhost:4000';
    throw new Error('API_ORIGIN must be set when building the web app (see apps/web/.env.example).');
  }
  const url = new URL(value);
  if (url.origin !== value) {
    throw new Error('API_ORIGIN must be an origin like https://api.example.com (no path or trailing slash).');
  }
  return value;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The workspace root, so Next.js resolves the shared package and the single lockfile.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  turbopack: { root: path.join(__dirname, '../..') },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiOrigin()}/api/:path*` }];
  },
};

export default nextConfig;
