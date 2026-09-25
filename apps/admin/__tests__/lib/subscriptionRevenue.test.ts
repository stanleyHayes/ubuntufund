import { describe, expect, it } from 'vitest'
import { BillingCycle, SubscriptionStatus, SubscriptionTier } from '@ubuntu-fund/types'
import { isPaidInForce, summarizeRevenue } from '@/lib/subscriptionRevenue'

const DAY = 86_400_000
const now = Date.parse('2026-09-25T12:00:00Z')
const row = (over: Record<string, unknown> = {}) => ({
  tier: SubscriptionTier.PRO as string, status: SubscriptionStatus.ACTIVE, billingCycle: BillingCycle.MONTHLY,
  currentPeriodEnd: new Date(now + DAY), ...over,
})

describe('admin subscription revenue', () => {
  it('excludes a web plan whose period ended even though the row still says active', () => {
    expect(isPaidInForce(row({ currentPeriodEnd: new Date(now - DAY) }), now)).toBe(false)
    const summary = summarizeRevenue([
      row(),
      row({ currentPeriodEnd: new Date(now - DAY) }),
      row({ status: SubscriptionStatus.EXPIRED }),
      row({ tier: SubscriptionTier.FREE }),
      row({ tier: SubscriptionTier.STARTER, billingCycle: BillingCycle.YEARLY }),
    ], now)
    expect(summary.paidUsers).toBe(2)
    expect(summary.byTier(SubscriptionTier.PRO)).toEqual({ count: 1, revenue: 149 })
    expect(summary.monthlyRevenue).toBeCloseTo(149 + 490 / 12)
  })
})
