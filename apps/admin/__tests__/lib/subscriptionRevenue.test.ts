import { describe, expect, it } from 'vitest'
import { BillingCycle, SubscriptionStatus, SubscriptionTier, type Subscription } from '@ubuntu-fund/types'
import { isPaidInForce } from '@/lib/subscriptionRevenue'
import { buildPlanMap, summarize } from '@/lib/subscriptionMetrics'
import { LIVE_PLANS } from '../fixtures/livePlans'

const DAY = 86_400_000
const now = Date.parse('2026-09-25T12:00:00Z')
const row = (over: Record<string, unknown> = {}) => ({
  tier: SubscriptionTier.PRO as string, status: SubscriptionStatus.ACTIVE, billingCycle: BillingCycle.MONTHLY,
  currentPeriodEnd: new Date(now + DAY), ...over,
})

describe('admin subscription revenue', () => {
  it('excludes a web plan whose period ended even though the row still says active', () => {
    expect(isPaidInForce(row({ currentPeriodEnd: new Date(now - DAY) }), now)).toBe(false)
    // Priced from the live plans (Pro 29.99/mo, Starter 99/yr), never the code seed.
    const summary = summarize([
      row(),
      row({ currentPeriodEnd: new Date(now - DAY) }),
      row({ status: SubscriptionStatus.EXPIRED }),
      row({ tier: SubscriptionTier.FREE }),
      row({ tier: SubscriptionTier.STARTER, billingCycle: BillingCycle.YEARLY }),
      row({ billingEnvironment: 'sandbox' }),
    ] as Subscription[], buildPlanMap(LIVE_PLANS), new Date(now))
    expect(summary.paid).toBe(2)
    expect(summary.byTier.find((tier) => tier.tier === SubscriptionTier.PRO)).toMatchObject({ count: 1, revenuePesewas: 2999 })
    expect(summary.byTier.find((tier) => tier.tier === SubscriptionTier.STARTER)).toMatchObject({ count: 1, revenuePesewas: 825 })
    expect(summary.estimatedMrrPesewas).toBe(2999 + 825)
  })

  it('never counts an App Review / TestFlight sandbox store purchase as revenue', () => {
    expect(isPaidInForce(row({ billingEnvironment: 'sandbox' }), now)).toBe(false)
    expect(isPaidInForce(row({ billingEnvironment: 'production' }), now)).toBe(true)
  })
})
