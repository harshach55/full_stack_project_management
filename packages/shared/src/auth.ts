import { z } from 'zod';
import { LIMITS } from './limits.js';
import { emailSchema, fullNameSchema, utf8ByteLength } from './validators.js';

const passwordType = z.string({
  error: (issue) => (issue.input === undefined ? 'Password is required.' : 'Password must be a string.'),
});

/** Registration password: 8 to 72 bytes in UTF-8 (bcrypt uses at most 72 bytes). Not trimmed. */
export const newPasswordSchema = passwordType.refine(
  (value) => {
    const bytes = utf8ByteLength(value);
    return bytes >= LIMITS.passwordMinBytes && bytes <= LIMITS.passwordMaxBytes;
  },
  { error: `Password must be ${LIMITS.passwordMinBytes} to ${LIMITS.passwordMaxBytes} bytes long.` },
);

/** Login password: only presence and the bcrypt byte limit are checked. */
export const loginPasswordSchema = passwordType
  .refine((value) => value.length > 0, { error: 'Password is required.' })
  .refine((value) => utf8ByteLength(value) <= LIMITS.passwordMaxBytes, {
    error: `Password must be at most ${LIMITS.passwordMaxBytes} bytes long.`,
  });

export const registerBodySchema = z.strictObject({
  fullName: fullNameSchema,
  email: emailSchema,
  password: newPasswordSchema,
});

export const loginBodySchema = z.strictObject({
  email: emailSchema,
  password: loginPasswordSchema,
});

export const userSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
  createdAt: z.string(),
});

/** Web login/register response: the token is only in the httpOnly cookie. */
export const authResponseSchema = z.object({
  user: userSchema,
});

/** Mobile login/register response (X-Client-Type: mobile, no Origin header). */
export const mobileAuthResponseSchema = z.object({
  user: userSchema,
  token: z.string(),
  expiresAt: z.string(),
});

export const meResponseSchema = z.object({
  user: userSchema,
});

export type RegisterInput = z.infer<typeof registerBodySchema>;
export type LoginInput = z.infer<typeof loginBodySchema>;
export type User = z.infer<typeof userSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type MobileAuthResponse = z.infer<typeof mobileAuthResponseSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
