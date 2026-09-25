import {
  BillingCycle,
  SubscriptionStatus,
  SubscriptionTier,
  SUBSCRIPTION_PLANS,
  type Subscription,
  type SubscriptionPlan,
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

/** Monthly-equivalent list price of one in-force subscription (seed prices). */
export function monthlyValue(subscription: RevenueRow): number {
  const plan = (SUBSCRIPTION_PLANS as Record<string, SubscriptionPlan>)[subscription.tier]
  if (!plan) return 0
  return subscription.billingCycle === BillingCycle.MONTHLY ? plan.priceMonthly : plan.priceYearly / 12
}

export function summarizeRevenue<T extends RevenueRow>(subscriptions: T[], now: number = Date.now()) {
  const paying = subscriptions.filter((subscription) => isPaidInForce(subscription, now))
  const monthlyRevenue = paying.reduce((sum, subscription) => sum + monthlyValue(subscription), 0)
  const byTier = (tier: string) => {
    const rows = paying.filter((subscription) => subscription.tier === tier)
    return { count: rows.length, revenue: rows.reduce((sum, subscription) => sum + monthlyValue(subscription), 0) }
  }
  return { paidUsers: paying.length, monthlyRevenue, byTier }
}
