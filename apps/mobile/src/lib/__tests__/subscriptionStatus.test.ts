import { describe, expect, it } from 'vitest'
import { SubscriptionStatus, SubscriptionTier } from '@ubuntu-fund/types'
import { isCurrentPlanTier, isPaidPlanInForce, planCardPrice } from '../subscriptionStatus'

const now = Date.parse('2026-09-25T12:00:00Z')
const pro = (end: number, status = SubscriptionStatus.ACTIVE) => ({ tier: SubscriptionTier.PRO, status, currentPeriodEnd: new Date(end).toISOString() })

describe('subscription status on the plans screen', () => {
  it('treats a Pro row past its period end as lapsed, so Pro can be bought again', () => {
    const lapsed = pro(now - 1)
    expect(isPaidPlanInForce(lapsed, now)).toBe(false)
    expect(isCurrentPlanTier(SubscriptionTier.PRO, lapsed, now)).toBe(false)
    expect(isCurrentPlanTier(SubscriptionTier.FREE, lapsed, now)).toBe(true)
    expect(isCurrentPlanTier(SubscriptionTier.PRO, pro(now + 1, SubscriptionStatus.EXPIRED), now)).toBe(false)
  })

  it('keeps an in-force plan current', () => {
    const active = pro(now + 86_400_000)
    expect(isCurrentPlanTier(SubscriptionTier.PRO, active, now)).toBe(true)
    expect(isCurrentPlanTier(SubscriptionTier.FREE, active, now)).toBe(false)
  })
})

describe('plan card price', () => {
  it('decides Free by tier and treats a zero paid price as a cycle that is not offered', () => {
    expect(planCardPrice({ tier: SubscriptionTier.FREE, priceMonthly: 0, priceYearly: 0 })).toEqual({ amount: 0, per: 'month' })
    expect(planCardPrice({ tier: SubscriptionTier.PRO, priceMonthly: 149, priceYearly: 1490 })).toEqual({ amount: 149, per: '30 days' })
    // A paid plan sold only yearly is not shown as a free GH₵ 0 plan.
    expect(planCardPrice({ tier: SubscriptionTier.PRO, priceMonthly: 0, priceYearly: 1490 })).toEqual({ amount: 1490, per: '1 year' })
    expect(planCardPrice({ tier: SubscriptionTier.PRO, priceMonthly: 0, priceYearly: 0 })).toBeNull()
  })
})
