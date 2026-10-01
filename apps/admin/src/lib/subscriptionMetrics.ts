import { BillingCycle, SubscriptionTier, type Subscription, type SubscriptionPlan } from '@ubuntu-fund/types'
import { isPaidInForce } from './subscriptionRevenue'
import { toPesewas, yearlyPerMonthPesewas } from './money'
import { comparePlans } from './plans'

export type PlanMap = Record<string, SubscriptionPlan>

/**
 * Live (database) plans keyed by tier id, so renamed and custom tiers resolve.
 * Never the code seed: its prices and names are not what production charges.
 */
export function buildPlanMap(livePlans: SubscriptionPlan[]): PlanMap {
  const map: PlanMap = {}
  for (const plan of livePlans) if (plan?.tier) map[plan.tier] = plan
  return map
}

export function planName(tier: string, plans: PlanMap): string {
  return plans[tier]?.name ?? tier
}

/**
 * Every tier to offer in filters and cards: live plans in the admin-set order
 * (sortOrder, price, tier id), then any other tier a subscriber is on, by id.
 */
export function knownTiers(plans: PlanMap, subscriptions: Pick<Subscription, 'tier'>[]): string[] {
  const live = Object.values(plans).sort(comparePlans).map(plan => plan.tier)
  const other = [...new Set(subscriptions.map(subscription => subscription.tier))].filter(tier => !plans[tier]).sort((a, b) => a.localeCompare(b))
  return [...live, ...other]
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

/** Monthly list price for a web-billed subscription, in whole pesewas; store billing is priced by the store. */
export function monthlyListPesewas(subscription: Pick<Subscription, 'tier' | 'billingCycle'>, plans: PlanMap): number {
  const plan = plans[subscription.tier]
  if (!plan) return 0
  return subscription.billingCycle === BillingCycle.MONTHLY ? toPesewas(plan.priceMonthly) : yearlyPerMonthPesewas(plan.priceYearly)
}

/**
 * Sold only by the sales team at a negotiated price, never at web checkout:
 * Enterprise. Its list price is only a reference, so its subscribers are
 * counted but never priced. A plan an admin took off public sale is different:
 * members bought it at checkout at its list price before it was hidden.
 */
function isNegotiatedTier(tier: string): boolean {
  return tier === SubscriptionTier.ENTERPRISE
}

export interface TierRevenue {
  tier: string
  name: string
  count: number
  revenuePesewas: number
  /** Enterprise ({@link isNegotiatedTier}): counted but never priced (revenuePesewas 0). */
  negotiated: boolean
  /** Hidden from public sale. Its members bought it at checkout, so it is still priced at list. */
  notOnPublicSale: boolean
}
export interface SubscriptionSummary {
  total: number
  paid: number
  free: number
  /** Estimated from web-billed list prices of self-serve plans, in whole pesewas; not money actually collected. The sum of byTier. */
  estimatedMrrPesewas: number
  /** Paying through the App Store or Google Play: counted, never priced here. */
  storeBilledPaid: number
  /** Paying on the web on a plan not sold at web checkout (Enterprise): counted, never priced here. */
  negotiatedPaid: number
  byTier: TierRevenue[]
}

export function summarize(subscriptions: Subscription[], plans: PlanMap, now = new Date()): SubscriptionSummary {
  const paying = subscriptions.filter(subscription => isCurrentlyPaid(subscription, now))
  const webPaying = paying.filter(subscription => !isStoreBilled(subscription))
  const negotiated = (tier: string) => !!plans[tier] && isNegotiatedTier(tier)
  const tiers = knownTiers(plans, subscriptions).filter(tier => tier !== SubscriptionTier.FREE)
  const byTier = tiers.map(tier => {
    const rows = paying.filter(subscription => subscription.tier === tier)
    const salesOnly = negotiated(tier)
    return {
      tier, name: planName(tier, plans), count: rows.length, negotiated: salesOnly,
      notOnPublicSale: !salesOnly && plans[tier]?.isPublic === false,
      revenuePesewas: salesOnly ? 0 : rows.filter(subscription => !isStoreBilled(subscription)).reduce((sum, subscription) => sum + monthlyListPesewas(subscription, plans), 0),
    }
  }).filter(row => row.count > 0 || plans[row.tier]?.active !== false)
  return {
    total: subscriptions.length,
    paid: paying.length,
    free: subscriptions.length - paying.length,
    // Summed from the cards, so the header always equals them.
    estimatedMrrPesewas: byTier.reduce((sum, row) => sum + row.revenuePesewas, 0),
    storeBilledPaid: paying.length - webPaying.length,
    negotiatedPaid: webPaying.filter(subscription => negotiated(subscription.tier)).length,
    byTier,
  }
}
