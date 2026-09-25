import { describe, expect, it } from 'vitest'
import { canRequestRefund } from '../donationRefunds'

const now = Date.parse('2026-09-25T12:00:00Z')
const gift = { status: 'completed', paymentMethod: 'mobile_money', date: '2026-09-20T12:00:00Z' }

// I044 / I045: Android offered "Request Refund" for any completed gift, with no
// time limit, including wallet gifts and ones already refunded.
describe('Android refund button rule', () => {
  it('offers it for a recent completed provider-paid gift', () => {
    expect(canRequestRefund(gift, now)).toBe(true)
  })
  it('hides it for refunded, wallet, already-requested and old gifts', () => {
    expect(canRequestRefund({ ...gift, status: 'refunded' }, now)).toBe(false)
    expect(canRequestRefund({ ...gift, status: 'partially_refunded' }, now)).toBe(false)
    expect(canRequestRefund({ ...gift, paymentMethod: 'wallet' }, now)).toBe(false)
    expect(canRequestRefund({ ...gift, refundRequested: true }, now)).toBe(false)
    expect(canRequestRefund({ ...gift, date: '2026-08-01T00:00:00Z' }, now)).toBe(false)
    expect(canRequestRefund({ ...gift, date: undefined }, now)).toBe(false)
  })
})
