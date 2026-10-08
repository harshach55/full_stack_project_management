import type { User } from '@pm/shared';
import type { User as UserRecord } from '@prisma/client';
import { toTimestamp } from '../../lib/dates.js';

/** Public user fields only; passwordHash is never part of a response. */
export function toUserResponse(user: Pick<UserRecord, 'id' | 'fullName' | 'email' | 'createdAt'>): User {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    createdAt: toTimestamp(user.createdAt),
  };
}
