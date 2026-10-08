import { SESSION_COOKIE_NAME } from '@pm/shared';
import type { RequestHandler } from 'express';
import { originNotAllowed } from '../lib/errors.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'DELETE']);
const SESSION_COOKIE_PATTERN = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=`);

/**
 * CSRF protection for cookie sessions (api-contract.md, section 9).
 * Runs before the cookie parser, so the session cookie is detected in the raw Cookie header.
 *
 * - Origin present: it must be in the allowlist.
 * - Origin absent: rejected only when the request carries the session cookie and no
 *   Authorization header (a browser-style request we cannot attribute to an origin).
 *   Mobile apps and API tools send no Origin and no cookie, and are allowed.
 */
export function originCheck(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (req, _res, next) => {
    if (!STATE_CHANGING_METHODS.has(req.method)) return next();

    const origin = req.get('origin');
    if (origin !== undefined) {
      return allowed.has(origin) ? next() : next(originNotAllowed());
    }

    const hasSessionCookie = SESSION_COOKIE_PATTERN.test(req.get('cookie') ?? '');
    const hasAuthorization = req.get('authorization') !== undefined;
    if (hasSessionCookie && !hasAuthorization) return next(originNotAllowed());
    next();
  };
}
