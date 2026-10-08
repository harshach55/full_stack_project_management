import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';

function hasBody(headers: Record<string, string | string[] | undefined>): boolean {
  if (headers['transfer-encoding'] !== undefined) return true;
  const length = headers['content-length'];
  return length !== undefined && length !== '0';
}

/** Requests that send a body must send JSON (415 otherwise). Requests without a body are not affected. */
export function requireJsonContentType(): RequestHandler {
  return (req, _res, next) => {
    if ((req.method === 'POST' || req.method === 'PUT') && hasBody(req.headers) && !req.is('application/json')) {
      return next(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content type must be application/json.'));
    }
    next();
  };
}
