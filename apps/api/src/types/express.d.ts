import 'express';

declare global {
  namespace Express {
    interface AuthContext {
      userId: string;
      jti: string;
      /** Token expiry, seconds since epoch. */
      exp: number;
      method: 'bearer' | 'cookie';
    }

    interface Request {
      /** Set by the authenticate middleware on protected routes. */
      auth?: AuthContext;
      /**
       * Parsed and normalized input set by the validate middleware.
       * (Express 5 exposes req.query as a read-only getter, so parsed values live here.)
       */
      valid: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
      /** Response mode for login/register, set by the client-type middleware. */
      clientMode?: 'web' | 'mobile';
    }
  }
}

export {};
