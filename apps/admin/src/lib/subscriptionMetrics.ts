import { BillingCycle, SubscriptionStatus, SubscriptionTier, SUBSCRIPTION_PLANS, type Subscription, type SubscriptionPlan } from '@ubuntu-fund/types'
import { isPaidInForce } from './subscriptionRevenue'

export type PlanMap = Record<string, SubscriptionPlan>

/** Live (database) plans over the code seed, keyed by tier id, so renamed and custom tiers resolve. */
export function buildPlanMap(livePlans: SubscriptionPlan[]): PlanMap {
  const map: PlanMap = { ...(SUBSCRIPTION_PLANS as PlanMap) }
  for (const plan of livePlans) if (plan?.tier) map[plan.tier] = plan
  return map
}

export function planName(tier: string, plans: PlanMap): string {
  return plans[tier]?.name ?? tier
}

/** Every tier to offer in filters: live, seeded and any tier a subscriber is actually on. */
export function knownTiers(plans: PlanMap, subscriptions: Pick<Subscription, 'tier'>[]): string[] {
  return [...new Set([...Object.keys(plans), ...subscriptions.map(subscription => subscription.tier)])]
}

const isStoreBilled = (subscription: Pick<Subscription, 'billingProvider'>) =>
  subscription.billingProvider === 'apple' || subscription.billingProvider === 'google'

/**
 * Currently paying: a paid tier whose status is active AND whose period has not
 * ended. Nothing marks lapsed web subscriptions expired, so status alone overcounts.
 */
/** Paid, active, inside its period, and not an App Review / TestFlight sandbox purchase. */
export function isCurrentlyPaid(subscription: Pick<Subscription, 'tier' | 'status' | 'billingCycle' | 'currentPeriodEnd' | 'billingEnvironment'>, now: Date): boolean {
  return isPaidInForce(subscription, now.getTime())
}

/** Monthly list price for a web-billed subscription; store billing is priced by the store. */
export function monthlyListPrice(subscription: Pick<Subscription, 'tier' | 'billingCycle'>, plans: PlanMap): number {
  const plan = plans[subscription.tier]
  if (!plan) return 0
  return subscription.billingCycle === BillingCycle.MONTHLY ? plan.priceMonthly : plan.priceYearly / 12
}

export interface TierRevenue { tier: string; name: string; count: number; revenue: number }
export interface SubscriptionSummary {
  total: number
  paid: number
  free: number
  /** Estimated from web-billed list prices; not money actually collected. */
  estimatedMrr: number
  /** Paying through the App Store or Google Play: counted, never priced here. */
  storeBilledPaid: number
  byTier: TierRevenue[]
}

export function summarize(subscriptions: Subscription[], plans: PlanMap, now = new Date()): SubscriptionSummary {
  const paying = subscriptions.filter(subscription => isCurrentlyPaid(subscription, now))
  const webPaying = paying.filter(subscription => !isStoreBilled(subscription))
  const tiers = knownTiers(plans, subscriptions).filter(tier => tier !== SubscriptionTier.FREE)
  const byTier = tiers.map(tier => {
    const rows = paying.filter(subscription => subscription.tier === tier)
    return {
      tier, name: planName(tier, plans), count: rows.length,
      revenue: rows.filter(subscription => !isStoreBilled(subscription)).reduce((sum, subscription) => sum + monthlyListPrice(subscription, plans), 0),
    }
  }).filter(row => row.count > 0 || plans[row.tier]?.active !== false)
  return {
    total: subscriptions.length,
    paid: paying.length,
    free: subscriptions.length - paying.length,
    estimatedMrr: webPaying.reduce((sum, subscription) => sum + monthlyListPrice(subscription, plans), 0),
    storeBilledPaid: paying.length - webPaying.length,
    byTier,
  }
}
