import { describe, expect, it } from 'vitest'
import { PaymentMethod } from '@ubuntu-fund/types'
import { isRefundEligible } from '../src/lib/donationRefunds'
import type { UserDonation } from '../src/hooks/useDonations'

const now = new Date('2026-09-25T12:00:00Z')
const gift = (patch: Partial<UserDonation> = {}): UserDonation => ({
  id: 'd1', campaignId: 'c1', campaignName: 'Clinic', amount: 50, currency: 'GHS',
  date: '2026-09-20T12:00:00Z', status: 'completed', paymentMethod: PaymentMethod.MOBILE_MONEY, ...patch,
})

// I044 / I045: only offer "Request Refund" where a refund can actually happen.
describe('refund eligibility in donation history', () => {
  it('offers a refund for a recent completed provider-paid gift', () => {
    expect(isRefundEligible(gift(), now)).toBe(true)
    expect(isRefundEligible(gift({ paymentMethod: PaymentMethod.CARD }), now)).toBe(true)
  })
  it.each(['refunded', 'partially_refunded', 'refund_pending', 'disputed', 'pending'] as const)('hides it for a %s gift', (status) => {
    expect(isRefundEligible(gift({ status }), now)).toBe(false)
  })
  it('hides it for wallet gifts, already-requested refunds and gifts older than 30 days', () => {
    expect(isRefundEligible(gift({ paymentMethod: PaymentMethod.WALLET }), now)).toBe(false)
    expect(isRefundEligible(gift({ refundRequested: true }), now)).toBe(false)
    expect(isRefundEligible(gift({ date: '2026-08-01T00:00:00Z' }), now)).toBe(false)
  })
})
