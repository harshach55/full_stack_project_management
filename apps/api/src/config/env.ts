import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

function positiveInt(defaultValue: number) {
  return z.coerce.number().int().positive().default(defaultValue);
}

/** Parses "7d", "12h", "30m" or "45s" into seconds. */
function durationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error('invalid duration');
  const amount = Number(match[1]);
  const unit = match[2] as 's' | 'm' | 'h' | 'd';
  const factor = { s: 1, m: 60, h: 3600, d: 86400 }[unit];
  return amount * factor;
}

/** Comma-separated list of exact origins, for example "http://localhost:3000,https://app.example.com". */
const originList = z.string().transform((value, ctx) => {
  const origins = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'must be a comma-separated list of origins' });
      return z.NEVER;
    }
    if (parsed.origin !== origin) {
      ctx.addIssue({ code: 'custom', message: 'origins must be exact (scheme://host[:port], no path or trailing slash)' });
      return z.NEVER;
    }
  }
  if (origins.length === 0) {
    ctx.addIssue({ code: 'custom', message: 'at least one origin is required' });
    return z.NEVER;
  }
  return origins;
});

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: positiveInt(4000),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().refine((value) => Buffer.byteLength(value, 'utf8') >= 32, 'must be at least 32 bytes'),
    JWT_EXPIRES_IN: z
      .string()
      .default('7d')
      .refine((value) => /^\d+[smhd]$/.test(value), 'must look like 7d, 12h, 30m or 45s'),
    CORS_ALLOWED_ORIGINS: originList,
    COOKIE_SECURE: booleanString.default(true),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    RATE_LIMIT_WINDOW_MS: positiveInt(15 * 60 * 1000),
    RATE_LIMIT_LOGIN_ACCOUNT_MAX: positiveInt(5),
    RATE_LIMIT_LOGIN_IP_MAX: positiveInt(50),
    RATE_LIMIT_REGISTER_IP_MAX: positiveInt(10),
    LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) {
      ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'must be true in production' });
    }
  });

export interface Config {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  tokenTtlSeconds: number;
  corsAllowedOrigins: string[];
  cookieSecure: boolean;
  trustProxyHops: number;
  rateLimit: {
    windowMs: number;
    loginAccountMax: number;
    loginIpMax: number;
    registerIpMax: number;
  };
  logLevel: (typeof LOG_LEVELS)[number];
}

export class ConfigError extends Error {}

/**
 * Validates the environment once at startup. Error messages name the
 * variables that are wrong but never include their values.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new ConfigError(`Invalid environment configuration:\n  ${problems.join('\n  ')}`);
  }
  const e = result.data;
  const defaultLogLevel = e.NODE_ENV === 'production' ? 'info' : e.NODE_ENV === 'test' ? 'silent' : 'debug';
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    jwtSecret: e.JWT_SECRET,
    tokenTtlSeconds: durationToSeconds(e.JWT_EXPIRES_IN),
    corsAllowedOrigins: e.CORS_ALLOWED_ORIGINS,
    cookieSecure: e.COOKIE_SECURE,
    trustProxyHops: e.TRUST_PROXY_HOPS,
    rateLimit: {
      windowMs: e.RATE_LIMIT_WINDOW_MS,
      loginAccountMax: e.RATE_LIMIT_LOGIN_ACCOUNT_MAX,
      loginIpMax: e.RATE_LIMIT_LOGIN_IP_MAX,
      registerIpMax: e.RATE_LIMIT_REGISTER_IP_MAX,
    },
    logLevel: e.LOG_LEVEL ?? defaultLogLevel,
  };
}
