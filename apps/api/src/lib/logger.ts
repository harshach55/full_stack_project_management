import { pino, type Logger } from 'pino';
import type { Config } from '../config/env.js';

/** Paths removed from every log line, in addition to bodies and headers never being logged. */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.jwtSecret',
  '*.databaseUrl',
];

export function createLogger(config: Pick<Config, 'logLevel' | 'nodeEnv'>): Logger {
  return pino({
    level: config.logLevel,
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    ...(config.nodeEnv === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } } }
      : {}),
  });
}
