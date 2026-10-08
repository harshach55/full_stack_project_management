import type { ErrorResponse } from '@pm/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError, routeNotFound } from '../lib/errors.js';

/** Errors raised by the JSON body parser carry a "type" property. */
function fromBodyParser(error: unknown): AppError | undefined {
  if (typeof error !== 'object' || error === null || !('type' in error)) return undefined;
  switch ((error as { type: unknown }).type) {
    case 'entity.parse.failed':
      return new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON.');
    case 'entity.too.large':
      return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
    case 'charset.unsupported':
    case 'encoding.unsupported':
      return new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content type must be application/json.');
    default:
      return undefined;
  }
}

export function notFoundHandler(): RequestHandler {
  return (_req, _res, next) => next(routeNotFound());
}

/**
 * The single place that decides what an error response contains (ADR-0009, ADR-0014).
 * Unexpected errors become a generic 500; their details only go to the server log.
 */
export function errorHandler(): ErrorRequestHandler {
  return (error, req, res, next) => {
    if (res.headersSent) return next(error);

    const known = error instanceof AppError ? error : fromBodyParser(error);
    const appError = known ?? new AppError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');

    if (appError.status >= 500) {
      req.log.error({ err: error }, 'request failed');
    } else if (appError.status === 400) {
      req.log.debug({ code: appError.code }, 'request rejected');
    } else {
      req.log.info({ code: appError.code }, 'request rejected');
    }

    const body: ErrorResponse = {
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details ? { details: appError.details } : {}),
        requestId: String(req.id),
      },
    };
    res.status(appError.status).json(body);
  };
}
