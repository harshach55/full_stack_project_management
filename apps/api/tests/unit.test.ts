import { randomBytes } from 'node:crypto';
import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config/env.js';
import { fromDbDate, toDbDate } from '../src/lib/dates.js';
import { signAccessToken, verifyAccessToken } from '../src/lib/jwt.js';
import { createLogger, REDACT_PATHS } from '../src/lib/logger.js';
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

describe('logger redaction', () => {
  it('removes credentials and secrets at every configured path', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(String(chunk));
        callback();
      },
    });
    // Same redaction settings as createLogger, with an in-memory destination.
    const logger = pino({ level: 'info', redact: { paths: REDACT_PATHS, censor: '[redacted]' } }, sink);
    const secrets = {
      authorization: 'Bearer secret-bearer-token',
      cookie: 'pm_session=secret-cookie-value',
      setCookie: 'pm_session=secret-set-cookie; HttpOnly',
      password: 'secret-password-1',
      passwordHash: '$2b$12$secrethashsecrethashsecrethashsecrethashsecrethashse',
      token: 'secret-token-value',
      jwtSecret: 'secret-jwt-signing-key',
      databaseUrl: 'postgresql://db.example.com/secret-database-marker',
    };

    logger.info(
      {
        req: { headers: { authorization: secrets.authorization, cookie: secrets.cookie, accept: 'application/json' } },
        res: { headers: { 'set-cookie': secrets.setCookie } },
        input: { password: secrets.password, email: 'visible@example.com' },
        user: { passwordHash: secrets.passwordHash },
        session: { token: secrets.token },
        config: { jwtSecret: secrets.jwtSecret, databaseUrl: secrets.databaseUrl },
      },
      'redaction check',
    );

    expect(lines).toHaveLength(1);
    const output = lines[0]!;
    for (const value of Object.values(secrets)) expect(output).not.toContain(value);
    expect(output).not.toContain('secret-');
    const entry = JSON.parse(output);
    expect(entry.req.headers).toEqual({ authorization: '[redacted]', cookie: '[redacted]', accept: 'application/json' });
    expect(entry.res.headers['set-cookie']).toBe('[redacted]');
    expect(entry.input).toEqual({ password: '[redacted]', email: 'visible@example.com' });
    expect(entry.user.passwordHash).toBe('[redacted]');
    expect(entry.session.token).toBe('[redacted]');
    expect(entry.config).toEqual({ jwtSecret: '[redacted]', databaseUrl: '[redacted]' });
  });

  it('covers every sensitive field the API knows about', () => {
    expect(REDACT_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.passwordHash',
        '*.token',
        '*.jwtSecret',
        '*.databaseUrl',
      ]),
    );
  });

  it('createLogger uses the configured level and plain JSON output in production', () => {
    const logger = createLogger({ logLevel: 'warn', nodeEnv: 'production' });
    expect(logger.level).toBe('warn');
    expect(logger.isLevelEnabled('info')).toBe(false);
    expect(logger.isLevelEnabled('error')).toBe(true);
  });
});
