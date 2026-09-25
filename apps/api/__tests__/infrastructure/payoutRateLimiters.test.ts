import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import {
  donationIntentRateLimiter,
  payoutControlRateLimiter,
  payoutDestinationRateLimiter,
} from '../../src/infrastructure/adapters/inbound/middleware/rateLimiter.js'

type Limiter = (req: Request, res: Response, next: () => void) => void
type FakeRequest = { ip?: string; userId?: string; headers?: Record<string, string> }
function hit(limiter: Limiter, { headers = {}, ...req }: FakeRequest) {
  let status = 200
  const res = { setHeader: vi.fn(), status: vi.fn((code: number) => { status = code; return res }), json: vi.fn(() => res) } as unknown as Response
  let passed = false
  // Limiters key on clientIp(req), which reads headers through req.get() like
  // a real Express request.
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
  const request = { ...req, socket: { remoteAddress: req.ip }, get: (name: string) => lower[name.toLowerCase()] }
  limiter(request as unknown as Request, res, () => { passed = true })
  return passed ? 200 : status
}

describe('payout rate limiters', () => {
  it('keeps admin transfer controls available while donors exhaust the checkout bucket from the same proxy IP', () => {
    for (let i = 0; i < 60; i++) expect(hit(donationIntentRateLimiter, { ip: '10.0.0.1' })).toBe(200)
    expect(hit(donationIntentRateLimiter, { ip: '10.0.0.1' })).toBe(429)
    expect(hit(payoutControlRateLimiter, { ip: '10.0.0.1', userId: 'admin-1' })).toBe(200)
    expect(hit(payoutDestinationRateLimiter, { ip: '10.0.0.1', userId: 'owner-1' })).toBe(200)
    // A different donor behind the same Render proxy has their own checkout bucket.
    expect(hit(donationIntentRateLimiter, { ip: '10.0.0.1', headers: { 'CF-Connecting-IP': '198.51.100.20' } })).toBe(200)
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
