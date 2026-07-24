import type { Request, Response, NextFunction } from 'express';

interface WindowState {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window in-memory rate limiter. Per-process only — swap the Map for a
 * Redis store when running more than one API instance.
 */
function createRateLimiter(options: { windowMs: number; max: number; scope: string }) {
  const windows = new Map<string, WindowState>();

  // Drop expired windows so the map cannot grow unbounded.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, state] of windows) {
      if (state.resetAt <= now) windows.delete(key);
    }
  }, options.windowMs);
  sweeper.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${options.scope}:${req.ip ?? 'unknown'}`;
    const now = Date.now();
    let state = windows.get(key);

    if (!state || state.resetAt <= now) {
      state = { count: 0, resetAt: now + options.windowMs };
      windows.set(key, state);
    }

    state.count += 1;
    res.setHeader('X-RateLimit-Limit', options.max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - state.count));

    if (state.count > options.max) {
      res.setHeader('Retry-After', Math.ceil((state.resetAt - now) / 1000));
      res.status(429).json({
        message: 'Too many requests, please try again later',
        status: 429,
      });
      return;
    }

    next();
  };
}

/** General API limit: 300 requests / 15 min per IP. */
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  scope: 'api',
});

/** Strict limit for credential endpoints: 30 requests / 15 min per IP. */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  scope: 'auth',
});
