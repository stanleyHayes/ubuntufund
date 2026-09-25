import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createRateLimiter, subscriptionVerifyRateLimiter } from '../../src/infrastructure/adapters/inbound/middleware/rateLimiter.js';

function call(limiter: ReturnType<typeof createRateLimiter>, req: Partial<Request> & { userId?: string }) {
  const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
  const next = vi.fn();
  limiter(req as Request, res as unknown as Response, next);
  return { passed: next.mock.calls.length === 1, res };
}

describe('subscription verification rate limit', () => {
  it('keys the budget on the signed-in member, so two members behind one address never share it', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, scope: `test-${Math.random()}`,
      key: (req) => (req as Request & { userId?: string }).userId });
    expect(call(limiter, { ip: '10.0.0.1', userId: 'a' }).passed).toBe(true);
    expect(call(limiter, { ip: '10.0.0.1', userId: 'a' }).passed).toBe(true);
    const third = call(limiter, { ip: '10.0.0.1', userId: 'a' });
    expect(third.passed).toBe(false);
    expect(third.res.status).toHaveBeenCalledWith(429);
    expect(third.res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    expect(call(limiter, { ip: '10.0.0.1', userId: 'b' }).passed).toBe(true);
  });

  it('allows a generous verification budget per member', () => {
    for (let i = 0; i < 120; i += 1) expect(call(subscriptionVerifyRateLimiter, { ip: '10.0.0.2', userId: 'poller' }).passed).toBe(true);
    expect(call(subscriptionVerifyRateLimiter, { ip: '10.0.0.2', userId: 'poller' }).passed).toBe(false);
    expect(call(subscriptionVerifyRateLimiter, { ip: '10.0.0.2', userId: 'someone-else' }).passed).toBe(true);
  });
});
