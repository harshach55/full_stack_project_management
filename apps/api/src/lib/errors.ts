import type { ErrorCode, ErrorDetail } from '@pm/shared';

/** The only error type application code throws on purpose. The error handler turns it into the API error body. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const unauthenticated = () => new AppError(401, 'UNAUTHENTICATED', 'Authentication required.');
export const tokenExpired = () =>
  new AppError(401, 'TOKEN_EXPIRED', 'Your session has expired. Please log in again.');
export const tokenRevoked = () => new AppError(401, 'TOKEN_REVOKED', 'Your session has ended. Please log in again.');
export const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
export const originNotAllowed = (message = 'Request origin is not allowed.') =>
  new AppError(403, 'ORIGIN_NOT_ALLOWED', message);
export const projectNotFound = () => new AppError(404, 'NOT_FOUND', 'Project not found.');
export const taskNotFound = () => new AppError(404, 'NOT_FOUND', 'Task not found.');
export const routeNotFound = () => new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found.');
export const emailAlreadyExists = () =>
  new AppError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists.');
export const rateLimited = () => new AppError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.');
export const validationError = (details: ErrorDetail[]) =>
  new AppError(400, 'VALIDATION_ERROR', 'Request validation failed.', details);
