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

/**
 * The plan whose fee and limits apply now: the member's own plan while it is in
 * force, else the Free plan, which the API applies once a paid plan has ended.
 * A tier missing from the live plans reads as Free.
 */
export function effectivePlan<P>(plans: Record<string, P>, subscription: PeriodFields, now: number = Date.now()): P | undefined {
  const own = plans[subscription.tier] ?? plans[SubscriptionTier.FREE]
  if (subscription.tier === SubscriptionTier.FREE || isPaidPlanInForce(subscription, now)) return own
  return plans[SubscriptionTier.FREE] ?? own
}

interface PlanForSale {
  tier: string
  priceMonthly: number
  priceYearly: number
  sortOrder: number
  popular?: boolean
  active?: boolean
  isPublic?: boolean
}

/** Sold at checkout: active, public, neither Free nor the sales-led Enterprise, with a price on some cycle. */
function isForSale(plan: PlanForSale): boolean {
  return plan.active !== false && plan.isPublic !== false && plan.tier !== SubscriptionTier.FREE &&
    plan.tier !== SubscriptionTier.ENTERPRISE && planCardPrice(plan) !== null
}

/** Per month, so a plan sold only yearly compares with monthly ones. */
const perMonth = (plan: PlanForSale) => (plan.priceMonthly > 0 ? plan.priceMonthly : plan.priceYearly / 12)

/**
 * The plan the upgrade call to action offers: the one an admin marks Popular,
 * else the cheapest one for sale. Null when nothing can be bought, so the call
 * to action is hidden rather than naming a plan checkout would refuse.
 */
export function upgradePlan<P extends PlanForSale>(plans: P[]): P | null {
  const forSale = plans.filter(isForSale)
  return forSale.find((plan) => plan.popular === true) ??
    [...forSale].sort((a, b) => perMonth(a) - perMonth(b) || a.sortOrder - b.sortOrder || a.tier.localeCompare(b.tier))[0] ??
    null
}

/** What a plan card shows as the price: an amount and the period it buys. */
export interface PlanPriceTag {
  amount: number
  per: 'month' | '30 days' | '1 year'
}

/**
 * The price a plan card shows. Free is decided by tier, not by a zero price: a
 * zero price on a paid plan means that billing cycle is not offered, so a plan
 * sold only yearly shows its yearly price. Null when a paid plan is sold on
 * neither cycle.
 */
export function planCardPrice(plan: { tier: string; priceMonthly: number; priceYearly: number }): PlanPriceTag | null {
  if (plan.tier === SubscriptionTier.FREE) return { amount: 0, per: 'month' }
  if (plan.priceMonthly > 0) return { amount: plan.priceMonthly, per: '30 days' }
  if (plan.priceYearly > 0) return { amount: plan.priceYearly, per: '1 year' }
  return null
}
