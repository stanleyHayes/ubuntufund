import { describe, expect, it } from 'vitest'
import { SUBSCRIPTION_PLANS, SubscriptionStatus, SubscriptionTier, type SubscriptionPlan } from '@ubuntu-fund/types'
import { effectivePlan, isCurrentPlanTier, isPaidPlanInForce, planCardPrice, upgradePlan } from '../subscriptionStatus'

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

/** The live price book: Free 5%, Starter 9.99 (3.5%), Pro 29.99 (2%), Organization 399 (2%), Enterprise sales-only. */
const LIVE = Object.fromEntries(Object.values(SUBSCRIPTION_PLANS).map((plan) => [plan.tier, { ...plan, popular: false }])) as Record<string, SubscriptionPlan>
const ordered = Object.values(LIVE)

describe('the plan that applies now', () => {
  it('applies the Free plan once a paid plan has ended, and the plan itself while it runs', () => {
    expect(effectivePlan(LIVE, pro(now - 1), now)).toMatchObject({ tier: 'free', platformFeePercent: 5, maxActiveCampaigns: 1 })
    expect(effectivePlan(LIVE, pro(now + 1, SubscriptionStatus.CANCELLED), now)?.tier).toBe('free')
    expect(effectivePlan(LIVE, pro(now + 86_400_000), now)).toMatchObject({ tier: 'pro', platformFeePercent: 2, maxActiveCampaigns: 10 })
    expect(effectivePlan(LIVE, { tier: SubscriptionTier.FREE, status: SubscriptionStatus.ACTIVE }, now)?.tier).toBe('free')
    expect(effectivePlan(LIVE, { tier: 'retired-tier', status: SubscriptionStatus.ACTIVE, currentPeriodEnd: new Date(now + 1).toISOString() }, now)?.tier).toBe('free')
  })
})

describe('the plan the upgrade call to action offers', () => {
  it('follows the admin Popular switch', () => {
    expect(upgradePlan(ordered.map((plan) => (plan.tier === 'organization' ? { ...plan, popular: true } : plan)))?.tier).toBe('organization')
  })

  it('falls back to the cheapest plan for sale, never Free or the sales-led Enterprise', () => {
    expect(upgradePlan(ordered)?.tier).toBe('starter')
    expect(upgradePlan(ordered.map((plan) => (plan.tier === 'enterprise' ? { ...plan, popular: true } : plan)))?.tier).toBe('starter')
    // A plan sold only yearly compares per month: 60 a year is 5 a month, under Starter's 9.99.
    expect(upgradePlan([...ordered, { ...LIVE.starter, tier: 'yearly-only', priceMonthly: 0, priceYearly: 60 }])?.tier).toBe('yearly-only')
  })

  it('passes over plans that cannot be bought, and offers none when nothing can', () => {
    const unsellable = ordered.map((plan) => (plan.tier === 'starter' ? { ...plan, isPublic: false } : plan.tier === 'pro' ? { ...plan, priceMonthly: 0, priceYearly: 0, popular: true } : plan))
    expect(upgradePlan(unsellable)?.tier).toBe('organization')
    expect(upgradePlan([LIVE.free, LIVE.enterprise])).toBeNull()
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
