import { z } from 'zod';

/** Stable machine-readable error codes (api-contract.md, section 3). */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_JSON',
  'UNAUTHENTICATED',
  'TOKEN_EXPIRED',
  'TOKEN_REVOKED',
  'INVALID_CREDENTIALS',
  'ORIGIN_NOT_ALLOWED',
  'NOT_FOUND',
  'ROUTE_NOT_FOUND',
  'EMAIL_ALREADY_EXISTS',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorDetailSchema = z.object({
  location: z.enum(['body', 'query', 'params', 'headers']),
  path: z.string(),
  message: z.string(),
});

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.array(errorDetailSchema).optional(),
    requestId: z.string(),
  }),
});

export type ErrorDetail = z.infer<typeof errorDetailSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
