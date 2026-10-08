import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

export const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

let dummyHash: Promise<string> | undefined;

/**
 * Compares the password against a hash of a random value, created once per process.
 * Used when the email is unknown so that a failed login takes about as long as a
 * wrong password, which hides whether the account exists. Always resolves to false.
 */
export async function verifyAgainstDummyHash(password: string): Promise<false> {
  dummyHash ??= bcrypt.hash(randomUUID(), BCRYPT_COST);
  await bcrypt.compare(password, await dummyHash);
  return false;
}
