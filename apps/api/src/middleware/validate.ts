import type { ErrorDetail } from '@pm/shared';
import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { validationError } from '../lib/errors.js';

type Location = 'body' | 'query' | 'params';

interface Schemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

interface Options {
  /** Custom messages for fields that are not allowed, for example projectId on task update. */
  forbiddenFieldMessages?: Record<string, string>;
}

function toDetails(location: Location, error: z.ZodError, options: Options): ErrorDetail[] {
  const details: ErrorDetail[] = [];
  for (const issue of error.issues) {
    const basePath = issue.path.map(String).join('.');
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        const path = basePath ? `${basePath}.${key}` : key;
        details.push({ location, path, message: options.forbiddenFieldMessages?.[key] ?? `Field "${key}" is not allowed.` });
      }
    } else {
      details.push({ location, path: basePath, message: issue.message });
    }
  }
  return details;
}

/**
 * Validates request parts with the shared Zod schemas. All problems from all parts are
 * returned together as one VALIDATION_ERROR. Parsed (trimmed, normalized) values are
 * stored in req.valid; controllers read only those.
 */
export function validate(schemas: Schemas, options: Options = {}): RequestHandler {
  return (req, _res, next) => {
    const details: ErrorDetail[] = [];
    req.valid ??= {};

    const parts: [Location, z.ZodType | undefined, unknown][] = [
      ['params', schemas.params, req.params],
      ['query', schemas.query, req.query],
      // An empty body is treated as {} so that missing fields are reported one by one.
      ['body', schemas.body, req.body ?? {}],
    ];

    for (const [location, schema, input] of parts) {
      if (!schema) continue;
      const result = schema.safeParse(input);
      if (result.success) {
        req.valid[location] = result.data;
      } else {
        details.push(...toDetails(location, result.error, options));
      }
    }

    if (details.length > 0) return next(validationError(details));
    next();
  };
}
