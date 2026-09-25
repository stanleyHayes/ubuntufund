import { describe, expect, it } from 'vitest'
import { SubscriptionStatus, SubscriptionTier } from '@ubuntu-fund/types'
import { isCurrentPlanTier, isPaidPlanInForce } from '../subscriptionStatus'

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
