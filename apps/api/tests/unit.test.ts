import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config/env.js';
import { fromDbDate, toDbDate } from '../src/lib/dates.js';
import { signAccessToken, verifyAccessToken } from '../src/lib/jwt.js';
import { escapeLikePattern } from '../src/lib/search.js';

// Configuration parsing only checks that DATABASE_URL is present; no connection is made.
const baseEnv = {
  DATABASE_URL: 'database-url-placeholder',
  JWT_SECRET: randomBytes(32).toString('hex'),
  CORS_ALLOWED_ORIGINS: 'http://localhost:3000, https://app.example.com',
};

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig(baseEnv);
    expect(config).toMatchObject({
      nodeEnv: 'development',
      port: 4000,
      tokenTtlSeconds: 7 * 24 * 3600,
      corsAllowedOrigins: ['http://localhost:3000', 'https://app.example.com'],
      cookieSecure: true,
      trustProxyHops: 0,
      rateLimit: { windowMs: 900_000, loginAccountMax: 5, loginIpMax: 50, registerIpMax: 10 },
    });
  });

  it('names invalid variables without printing their values', () => {
    const secret = randomBytes(8).toString('hex'); // 16 bytes: too short
    try {
      loadConfig({ ...baseEnv, JWT_SECRET: secret });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as Error).message).toContain('JWT_SECRET');
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it('requires exact origins and a database URL', () => {
    expect(() => loadConfig({ ...baseEnv, CORS_ALLOWED_ORIGINS: 'http://localhost:3000/' })).toThrow(ConfigError);
    expect(() => loadConfig({ ...baseEnv, CORS_ALLOWED_ORIGINS: '*' })).toThrow(ConfigError);
    expect(() => loadConfig({ ...baseEnv, DATABASE_URL: undefined })).toThrow(ConfigError);
  });

  it('refuses insecure cookies in production', () => {
    expect(() => loadConfig({ ...baseEnv, NODE_ENV: 'production', COOKIE_SECURE: 'false' })).toThrow(ConfigError);
    expect(loadConfig({ ...baseEnv, NODE_ENV: 'development', COOKIE_SECURE: 'false' }).cookieSecure).toBe(false);
  });
});

describe('date conversion', () => {
  it('round-trips date-only values without shifting the day', () => {
    for (const value of ['2026-01-01', '2026-12-31', '2024-02-29']) {
      expect(fromDbDate(toDbDate(value))).toBe(value);
    }
    expect(toDbDate(null)).toBeNull();
    expect(fromDbDate(null)).toBeNull();
  });
});

describe('escapeLikePattern', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(escapeLikePattern('100%_done\\')).toBe('100\\%\\_done\\\\');
    expect(escapeLikePattern('plain text')).toBe('plain text');
  });
});

describe('access tokens', () => {
  const secret = randomBytes(32).toString('hex');

  it('issues a 7-day token with a unique jti', () => {
    const userId = '3f1c2a9e-7b4d-4c1e-9a2f-5d6e7f8a9b0c';
    const first = signAccessToken(userId, secret, 7 * 24 * 3600);
    const second = signAccessToken(userId, secret, 7 * 24 * 3600);
    expect(first.jti).not.toBe(second.jti);
    const verified = verifyAccessToken(first.token, secret);
    expect(verified.userId).toBe(userId);
    expect(verified.exp * 1000).toBe(first.expiresAt.getTime());
    expect(first.expiresAt.getTime() - Date.now()).toBeGreaterThan(7 * 24 * 3600 * 1000 - 5000);
  });
});
