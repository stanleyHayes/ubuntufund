import type { Request, Response, NextFunction } from 'express';
import { rateLimitClientKey } from './clientIp.js';

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

export function createRateLimiter(options: {

  windowMs: number;
  max: number;
  scope: string;
  /** Bucket key; defaults to the client IP. */
  key?: (req: Request) => string | undefined;
}) {
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
    // Keyed on the resolved client address (see clientIp.ts), never req.ip:
    // behind Render's proxy req.ip is the proxy, which made every limiter one
    // bucket shared by the whole platform. A limiter may supply its own key.
    const key = `${options.scope}:${options.key?.(req) ?? rateLimitClientKey(req)}`;

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

/**
 * Read-only live surfaces: 1800 requests / 15 min per IP (2/s sustained).
 *
 * The watch page and the host studio poll every 10 s (~90 requests / 15 min
 * per tab) and SSE clients reconnect on every drop. A room of viewers behind
 * one carrier-NAT or venue Wi-Fi address would exhaust the general 300 budget
 * within minutes — and then be locked out of donating, too. These reads get a
 * separate, larger bucket so they neither hit nor drain the general one.
 */
export const liveReadRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 1800,
  scope: 'live-read',
});

/** Paths (relative to /api/v1) of the read-only live polling and SSE routes. */
const LIVE_READ_PATHS = [
  /^\/campaigns\/[^/]+\/(?:events|active-live|live-sessions\/active)\/?$/,
  /^\/live-sessions\/(?:video\/config|[^/]+\/(?:public|overlay|overlay\/view|events))\/?$/,
];

export function isLiveReadRequest(req: Request): boolean {
  return (req.method === 'GET' || req.method === 'HEAD') && LIVE_READ_PATHS.some((path) => path.test(req.path));
}

/**
 * The /api/v1 router's limiter: live reads go to their own bucket, everything
 * else — including every write on the same resources — to the general one.
 */
export function apiRouterRateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (isLiveReadRequest(req)) liveReadRateLimiter(req, res, next);
  else apiRateLimiter(req, res, next);
}

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

/**
 * Authenticated payout routes get their own buckets, keyed by the signed-in
 * user rather than the IP: sharing the public donation-checkout bucket meant
 * donors checking out (all arriving through the same proxy address) could
 * 429 an admin entering a time-limited Paystack OTP, and vice versa. Mount
 * after the auth middleware so the user id is set.
 */
const byUser = (req: Request) => {
  const userId = (req as Request & { userId?: string }).userId;
  return userId ? `user:${userId}` : undefined;
};

/** Admin transfer controls (OTP authorize / resend / refresh): 30 per 15 min per admin. */
export const payoutControlRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  scope: 'payout-transfer-control',
  key: byUser,
});

/** Registering payout destinations (provider name lookups): 20 per 15 min per user. */
export const payoutDestinationRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  scope: 'payout-destination',
  key: byUser,
});

/** Limits report spam; persisted uniqueness also suppresses duplicate pending reports. */
export const safetyReportRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20, scope: 'safety-reports' });
export const storeBillingRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 40, scope: 'store-billing' });

/**
 * Subscription payment verification (each call may hit Paystack): 120 / 15 min
 * per signed-in member. Its own budget, keyed on the user rather than the IP,
 * so polling a payment confirmation never competes with donations or payouts,
 * and members behind one proxy address never share a bucket. Runs after auth.
 */
export const subscriptionVerifyRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  scope: 'subscription-verify',
  key: (req) => {
    const userId = (req as Request & { userId?: string }).userId;
    return userId ? `user:${userId}` : undefined;
  },
});

export const dataRightsRateLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 20, scope: 'data-rights' });
