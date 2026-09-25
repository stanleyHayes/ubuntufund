import { SubscriptionStatus, SubscriptionTier } from '@ubuntu-fund/types'

interface PeriodFields {
  tier: string
  status: SubscriptionStatus
  currentPeriodEnd?: string | Date
}

/**
 * Whether a paid plan still grants its benefits right now. Web plans are
 * one-time 30-day or 12-month purchases that nothing renews, so the stored
 * status can still read `active` after the period ends; the end date decides.
 * Always false for the Free plan, whose period dates carry no meaning.
 */
export function isPaidPlanInForce(subscription: PeriodFields, now: number = Date.now()): boolean {
  if (subscription.tier === SubscriptionTier.FREE) return false
  if (subscription.status !== SubscriptionStatus.ACTIVE && subscription.status !== SubscriptionStatus.TRIALING) return false
  if (!subscription.currentPeriodEnd) return false
  const end = new Date(subscription.currentPeriodEnd).getTime()
  return Number.isFinite(end) && end > now
}

/** A lapsed paid plan is no longer current: the member is back on Free. */
export function isCurrentPlanTier(tier: string, subscription: PeriodFields, now: number = Date.now()): boolean {
  const inForce = isPaidPlanInForce(subscription, now)
  if (tier === SubscriptionTier.FREE) return subscription.tier === SubscriptionTier.FREE || !inForce
  return tier === subscription.tier && inForce
}
