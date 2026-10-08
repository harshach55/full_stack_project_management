import type { LoginInput, MobileAuthResponse, RegisterInput, AuthResponse, MeResponse } from '@pm/shared';
import type { PrismaClient } from '@prisma/client';
import type { Request, RequestHandler, Response } from 'express';
import type { Config } from '../../config/env.js';
import { setSessionCookie } from './auth.cookies.js';
import * as authService from './auth.service.js';
import type { Session } from './auth.service.js';

/** Web mode: token only in the httpOnly cookie. Mobile mode: token in the body, no cookie. */
function sendSession(req: Request, res: Response, status: number, session: Session, config: Config): void {
  if (req.clientMode === 'mobile') {
    const body: MobileAuthResponse = {
      user: session.user,
      token: session.issued.token,
      expiresAt: session.issued.expiresAt.toISOString(),
    };
    res.status(status).json(body);
    return;
  }
  setSessionCookie(res, session.issued.token, config.tokenTtlSeconds, config.cookieSecure);
  const body: AuthResponse = { user: session.user };
  res.status(status).json(body);
}

export function createAuthController(prisma: PrismaClient, config: Config) {
  const settings = { jwtSecret: config.jwtSecret, tokenTtlSeconds: config.tokenTtlSeconds };

  const register: RequestHandler = async (req, res) => {
    const session = await authService.register(prisma, settings, req.valid.body as RegisterInput);
    sendSession(req, res, 201, session, config);
  };

  const login: RequestHandler = async (req, res) => {
    const session = await authService.login(prisma, settings, req.valid.body as LoginInput);
    sendSession(req, res, 200, session, config);
  };

  const logout: RequestHandler = async (req, res) => {
    await authService.logout(prisma, req.auth!);
    res.status(204).end();
  };

  const me: RequestHandler = async (req, res) => {
    const body: MeResponse = { user: await authService.getCurrentUser(prisma, req.auth!.userId) };
    res.json(body);
  };

  return { register, login, logout, me };
}
