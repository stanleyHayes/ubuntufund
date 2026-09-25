import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import {
  donationIntentRateLimiter,
  payoutControlRateLimiter,
  payoutDestinationRateLimiter,
} from '../../src/infrastructure/adapters/inbound/middleware/rateLimiter.js'

type Limiter = (req: Request, res: Response, next: () => void) => void
function hit(limiter: Limiter, req: Partial<Request> & { userId?: string }) {
  let status = 200
  const res = { setHeader: vi.fn(), status: vi.fn((code: number) => { status = code; return res }), json: vi.fn(() => res) } as unknown as Response
  let passed = false
  limiter(req as Request, res, () => { passed = true })
  return passed ? 200 : status
}

describe('payout rate limiters', () => {
  it('keeps admin transfer controls available while donors exhaust the checkout bucket from the same proxy IP', () => {
    for (let i = 0; i < 60; i++) expect(hit(donationIntentRateLimiter, { ip: '10.0.0.1' })).toBe(200)
    expect(hit(donationIntentRateLimiter, { ip: '10.0.0.1' })).toBe(429)
    expect(hit(payoutControlRateLimiter, { ip: '10.0.0.1', userId: 'admin-1' })).toBe(200)
    expect(hit(payoutDestinationRateLimiter, { ip: '10.0.0.1', userId: 'owner-1' })).toBe(200)
  })

  it('gives each signed-in user their own bucket behind a shared IP', () => {
    for (let i = 0; i < 30; i++) expect(hit(payoutControlRateLimiter, { ip: '10.0.0.2', userId: 'admin-a' })).toBe(200)
    expect(hit(payoutControlRateLimiter, { ip: '10.0.0.2', userId: 'admin-a' })).toBe(429)
    expect(hit(payoutControlRateLimiter, { ip: '10.0.0.2', userId: 'admin-b' })).toBe(200)
  })

  it('still limits destination registration per user', () => {
    for (let i = 0; i < 20; i++) expect(hit(payoutDestinationRateLimiter, { ip: '10.0.0.3', userId: 'owner-x' })).toBe(200)
    expect(hit(payoutDestinationRateLimiter, { ip: '10.0.0.3', userId: 'owner-x' })).toBe(429)
  })
})
