import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { tokenExpired, unauthenticated } from './errors.js';

const ALGORITHM = 'HS256';

export interface IssuedToken {
  token: string;
  jti: string;
  expiresAt: Date;
}

export interface VerifiedToken {
  userId: string;
  jti: string;
  exp: number;
}

/** Issues an access token with a new random jti (ADR-0003). */
export function signAccessToken(userId: string, secret: string, ttlSeconds: number): IssuedToken {
  const jti = randomUUID();
  const issuedAt = Math.floor(Date.now() / 1000);
  const exp = issuedAt + ttlSeconds;
  const token = jwt.sign({ sub: userId, jti, iat: issuedAt, exp }, secret, { algorithm: ALGORITHM });
  return { token, jti, expiresAt: new Date(exp * 1000) };
}

const claimsSchema = z.object({
  sub: z.uuid(),
  jti: z.uuid(),
  exp: z.number().int(),
});

/**
 * Verifies signature, algorithm and expiry. Expiry is only reported after the
 * signature has been verified, so forged tokens never produce TOKEN_EXPIRED.
 */
export function verifyAccessToken(token: string, secret: string): VerifiedToken {
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, secret, { algorithms: [ALGORITHM] });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) throw tokenExpired();
    throw unauthenticated();
  }
  const claims = claimsSchema.safeParse(payload);
  if (!claims.success) throw unauthenticated();
  return { userId: claims.data.sub.toLowerCase(), jti: claims.data.jti.toLowerCase(), exp: claims.data.exp };
}
