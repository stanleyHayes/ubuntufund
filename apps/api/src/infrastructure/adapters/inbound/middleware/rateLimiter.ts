import type { Request, Response, NextFunction } from 'express';

interface WindowState {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window in-memory rate limiter. Per-process only — swap the Map for a
 * Redis store when running more than one API instance.
 */
/** Every limiter's window map, so tests can clear them between cases. */
const allWindows: Map<string, WindowState>[] = [];

/**
 * Clear every limiter's counters.
 *
 * These limiters are process-wide singletons keyed by IP, and the whole test
 * suite runs as one process from one address. A long integration file legitimately
 * exceeds 300 requests — and with `retry: 2`, one genuine failure re-runs and
 * triples its share — so later tests in the same file started getting 429s that
 * had nothing to do with what they were asserting. Test-only.
 */
export function resetRateLimiters(): void {
  for (const windows of allWindows) windows.clear();
}

function createRateLimiter(options: { windowMs: number; max: number; scope: string }) {
  const windows = new Map<string, WindowState>();
  allWindows.push(windows);

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

/** Public newsletter signup: 20 requests / 15 min per IP (spam guard). */
export const newsletterRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  scope: 'newsletter',
});

/** Public contact form: 10 submissions / 15 min per IP (spam guard). */
export const contactRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  scope: 'contact',
});

/**
 * Public donation checkout (create intent / record attempt): 60 requests /
 * 15 min per IP. Tighter than the general API limit because it is an
 * unauthenticated, money-changing write — idempotency keys still make honest
 * retries safe under it.
 */
export const donationIntentRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  scope: 'donation-intent',
});
