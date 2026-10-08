import { SESSION_COOKIE_NAME } from '@pm/shared';
import type { PrismaClient } from '@prisma/client';
import type { RequestHandler } from 'express';
import { tokenRevoked, unauthenticated } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/jwt.js';

const BEARER_PATTERN = /^Bearer ([^\s]+)$/i;

/**
 * Resolves the credential (api-contract.md, sections 2.3 and 2.4):
 * an Authorization header, if present, is the only credential considered (no fallback
 * to the cookie); otherwise the session cookie. Then verifies the token and checks revocation.
 */
export function authenticate(prisma: PrismaClient, jwtSecret: string): RequestHandler {
  return async (req, _res, next) => {
    let token: string;
    let method: 'bearer' | 'cookie';

    const authorization = req.get('authorization');
    if (authorization !== undefined) {
      const match = BEARER_PATTERN.exec(authorization);
      if (!match?.[1]) throw unauthenticated();
      token = match[1];
      method = 'bearer';
    } else {
      const cookieValue: unknown = req.cookies?.[SESSION_COOKIE_NAME];
      if (typeof cookieValue !== 'string' || cookieValue.length === 0) throw unauthenticated();
      token = cookieValue;
      method = 'cookie';
    }

    const verified = verifyAccessToken(token, jwtSecret);
    const revoked = await prisma.revokedToken.findUnique({ where: { jti: verified.jti }, select: { jti: true } });
    if (revoked) throw tokenRevoked();

    req.auth = { userId: verified.userId, jti: verified.jti, exp: verified.exp, method };
    next();
  };
}
