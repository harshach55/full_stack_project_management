import { SESSION_COOKIE_NAME } from '@pm/shared';
import type { CookieOptions, RequestHandler, Response } from 'express';

function baseOptions(secure: boolean): CookieOptions {
  // Host-only cookie (no Domain attribute) of the web app's domain, reached through the /api rewrite.
  return { httpOnly: true, secure, sameSite: 'lax', path: '/' };
}

export function setSessionCookie(res: Response, token: string, ttlSeconds: number, secure: boolean): void {
  res.cookie(SESSION_COOKIE_NAME, token, { ...baseOptions(secure), maxAge: ttlSeconds * 1000 });
}

export function clearSessionCookie(res: Response, secure: boolean): void {
  res.cookie(SESSION_COOKIE_NAME, '', { ...baseOptions(secure), maxAge: 0 });
}

/**
 * On logout, a cookie session always gets its cookie cleared, including when the
 * token is expired or revoked (the 401 response keeps this Set-Cookie header).
 */
export function clearSessionCookieForCookieRequests(secure: boolean): RequestHandler {
  return (req, res, next) => {
    if (req.get('authorization') === undefined && req.cookies?.[SESSION_COOKIE_NAME] !== undefined) {
      clearSessionCookie(res, secure);
    }
    next();
  };
}
