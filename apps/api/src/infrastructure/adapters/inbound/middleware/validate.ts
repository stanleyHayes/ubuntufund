import type { Request, Response, NextFunction } from 'express';
import { type ZodSchema, ZodError } from 'zod';
import { AppError } from './errorHandler.js';

/**
 * Validate the JSON body against `schema`.
 *
 * By default the parsed output is discarded, so zod transforms (`.trim()`,
 * `.toLowerCase()`, defaults) never reach the controller. Pass
 * `{ apply: true }` to replace `req.body` with the parsed output instead. It
 * is opt-in because a non-strict `z.object()` also strips undeclared keys, and
 * some controllers still read fields their schema does not declare — only
 * opt a route in once its schema declares everything its handler reads.
 */
export function validate(schema: ZodSchema, options: { apply?: boolean } = {}) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed: unknown = schema.parse(req.body);
      if (options.apply) req.body = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string[]> = {};
        for (const issue of error.issues) {
          const path = issue.path.join('.');
          if (!errors[path]) {
            errors[path] = [];
          }
          errors[path].push(issue.message);
        }
        throw new AppError('Validation failed', 400, errors);
      }
      next(error);
    }
  };
}
