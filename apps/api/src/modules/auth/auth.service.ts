import type { LoginInput, RegisterInput, User } from '@pm/shared';
import type { PrismaClient } from '@prisma/client';
import { emailAlreadyExists, invalidCredentials, unauthenticated } from '../../lib/errors.js';
import { signAccessToken, type IssuedToken } from '../../lib/jwt.js';
import { hashPassword, verifyAgainstDummyHash, verifyPassword } from '../../lib/password.js';
import { isUniqueViolation } from '../../lib/prisma.js';
import { toUserResponse } from './user.mapper.js';

export interface TokenSettings {
  jwtSecret: string;
  tokenTtlSeconds: number;
}

export interface Session {
  user: User;
  issued: IssuedToken;
}

const publicUserFields = { id: true, fullName: true, email: true, createdAt: true } as const;

export async function register(prisma: PrismaClient, settings: TokenSettings, input: RegisterInput): Promise<Session> {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await prisma.user.create({
      data: { fullName: input.fullName, email: input.email, passwordHash },
      select: publicUserFields,
    });
    return { user: toUserResponse(user), issued: signAccessToken(user.id, settings.jwtSecret, settings.tokenTtlSeconds) };
  } catch (error) {
    // The unique index on email is the final uniqueness check (no check-then-insert race).
    if (isUniqueViolation(error)) throw emailAlreadyExists();
    throw error;
  }
}

export async function login(prisma: PrismaClient, settings: TokenSettings, input: LoginInput): Promise<Session> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    // Same work as a wrong password, so response time does not reveal whether the email exists.
    await verifyAgainstDummyHash(input.password);
    throw invalidCredentials();
  }
  const matches = await verifyPassword(input.password, user.passwordHash);
  if (!matches) throw invalidCredentials();
  return { user: toUserResponse(user), issued: signAccessToken(user.id, settings.jwtSecret, settings.tokenTtlSeconds) };
}

/** Revokes only the presented token; other sessions of the same user keep working (PD-18). */
export async function logout(prisma: PrismaClient, auth: Express.AuthContext): Promise<void> {
  await prisma.revokedToken.createMany({
    data: [{ jti: auth.jti, userId: auth.userId, expiresAt: new Date(auth.exp * 1000) }],
    skipDuplicates: true,
  });
}

export async function getCurrentUser(prisma: PrismaClient, userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserFields });
  if (!user) throw unauthenticated();
  return toUserResponse(user);
}
