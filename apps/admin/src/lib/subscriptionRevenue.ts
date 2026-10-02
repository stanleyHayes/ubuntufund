import {
  SubscriptionStatus,
  SubscriptionTier,
  type Subscription,
} from '@ubuntu-fund/types'

type RevenueRow = Pick<Subscription, 'tier' | 'status' | 'billingCycle' | 'currentPeriodEnd' | 'billingEnvironment'>

/**
 * Whether a subscription is paid revenue right now. Web plans are one-time
 * purchases that nothing marks expired, so a row can still say `active` after
 * its period ended — the end date decides, not the stored status. App Review /
 * TestFlight sandbox store purchases grant the plan but were never paid.
 */
export function isPaidInForce(subscription: RevenueRow, now: number = Date.now()): boolean {
  if (subscription.tier === SubscriptionTier.FREE) return false
  if (subscription.billingEnvironment === 'sandbox') return false
  if (subscription.status !== SubscriptionStatus.ACTIVE) return false
  const end = new Date(subscription.currentPeriodEnd).getTime()
  return Number.isFinite(end) && end > now
}
