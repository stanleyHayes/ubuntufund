import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../../logging/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](
      {
        method: req.method,
        // Route templates omit user-supplied path/query values. Unknown routes
        // must not turn arbitrary URLs into a persistent data collection path.
        path: typeof req.route?.path === 'string' ? req.route.path : '/[unmatched]',
        status: res.statusCode,
        durationMs: Date.now() - start,
      },
      'request'
    );
  });
  next();
}
