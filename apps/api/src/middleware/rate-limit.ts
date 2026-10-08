import type { RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit, type Options, type RateLimitInfo } from 'express-rate-limit';
import type { Config } from '../config/env.js';
import { rateLimited } from '../lib/errors.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

/** Email normalized the same way as validation (trim, lowercase); undefined if absent. */
function normalizedEmail(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const email = (body as { email?: unknown }).email;
  return typeof email === 'string' ? email.trim().toLowerCase() : undefined;
}

const sendThroughErrorHandler: Options['handler'] = (req, res, next) => {
  const resetTime = (req as typeof req & { rateLimit?: RateLimitInfo }).rateLimit?.resetTime;
  if (resetTime) {
    const seconds = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
    res.setHeader('Retry-After', String(seconds));
  }
  next(rateLimited());
};

const common: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: sendThroughErrorHandler,
};

export interface RateLimiters {
  loginAccount: RequestHandler;
  loginIp: RequestHandler;
  registerIp: RequestHandler;
}

/**
 * Limits from api-contract.md, section 10. The per-account login limiter counts only
 * failed attempts and is keyed by IP + email, so web users behind the shared Vercel
 * proxy address are not throttled together (ADR-0010).
 */
export function createRateLimiters(config: Config['rateLimit']): RateLimiters {
  return {
    loginAccount: rateLimit({
      ...common,
      windowMs: config.windowMs,
      limit: config.loginAccountMax,
      skipSuccessfulRequests: true,
      // ipKeyGenerator groups IPv6 addresses by subnet so a client cannot rotate addresses inside it.
      keyGenerator: (req) => {
        const ip = ipKeyGenerator(req.ip ?? '');
        const email = normalizedEmail(req.body);
        return email ? `${ip}|${email}` : ip;
      },
    }),
    loginIp: rateLimit({
      ...common,
      windowMs: config.windowMs,
      limit: config.loginIpMax,
      keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
    }),
    registerIp: rateLimit({
      ...common,
      windowMs: ONE_HOUR_MS,
      limit: config.registerIpMax,
      keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
    }),
  };
}
