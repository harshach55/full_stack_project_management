import { CLIENT_TYPE_HEADER, MOBILE_CLIENT_TYPE } from '@pm/shared';
import type { RequestHandler } from 'express';
import { originNotAllowed, validationError } from '../lib/errors.js';

/**
 * Decides the login/register response mode (api-contract.md, section 2.5).
 * The token is returned in the body only for X-Client-Type: mobile without an Origin
 * header. Browsers always send Origin on POST, so browser code cannot obtain a token
 * in a response body by sending the header.
 */
export function resolveClientType(): RequestHandler {
  return (req, _res, next) => {
    const value = req.get(CLIENT_TYPE_HEADER);
    if (value === undefined) {
      req.clientMode = 'web';
      return next();
    }
    if (value.toLowerCase() !== MOBILE_CLIENT_TYPE) {
      return next(
        validationError([
          { location: 'headers', path: CLIENT_TYPE_HEADER, message: `${CLIENT_TYPE_HEADER} must be "mobile" when present.` },
        ]),
      );
    }
    if (req.get('origin') !== undefined) {
      return next(originNotAllowed('Token responses are not available to browser requests.'));
    }
    req.clientMode = 'mobile';
    next();
  };
}
