import { SubscriptionStatus, SubscriptionTier, type Subscription } from '@ubuntu-fund/types'

type PeriodFields = Pick<Subscription, 'tier' | 'status' | 'currentPeriodEnd'>
type PlanFields = PeriodFields & Pick<Subscription, 'billingEnvironment'>
type StoreFields = PeriodFields & Pick<Subscription, 'billingProvider' | 'cancelAtPeriodEnd'>

/** Apple and Google keep retrying a failed renewal for up to 60 days; the API keeps the store rail that long. */
const STORE_RENEWAL_RETRY_MS = 60 * 86_400_000

/**
 * Whether a paid plan still grants its benefits right now. Web plans are
 * one-time 30-day or 12-month purchases that nothing renews, so the stored
 * status can still read `active` after the period ends; the end date decides.
 * Always false for the Free plan, whose period dates carry no meaning.
 */
export function isPaidPlanInForce(subscription: PeriodFields, now: number = Date.now()): boolean {
  if (subscription.tier === SubscriptionTier.FREE) return false
  if (subscription.status !== SubscriptionStatus.ACTIVE && subscription.status !== SubscriptionStatus.TRIALING) return false
  const end = new Date(subscription.currentPeriodEnd).getTime()
  return Number.isFinite(end) && end > now
}

/**
 * Whether `tier` is the plan the member is actually on. A lapsed paid plan is
 * no longer current — the member is back on Free and can buy that plan again.
 */
export function isCurrentPlanTier(tier: string, subscription: PeriodFields, now: number = Date.now()): boolean {
  const inForce = isPaidPlanInForce(subscription, now)
  if (tier === SubscriptionTier.FREE) return subscription.tier === SubscriptionTier.FREE || !inForce
  return tier === subscription.tier && inForce
}

/**
 * Whether the App Store or Google Play manages this plan, so web checkout is
 * refused: a store plan in force, or a lapsed one the store may still renew
 * (automatic renewal on, ended within the 60-day billing-retry window). The
 * API's billing-rail claim refuses a web purchase in both cases.
 */
export function isStoreManaged(subscription: StoreFields, now: number = Date.now()): boolean {
  if (subscription.billingProvider !== 'apple' && subscription.billingProvider !== 'google') return false
  if (isPaidPlanInForce(subscription, now)) return true
  if (subscription.tier === SubscriptionTier.FREE || subscription.cancelAtPeriodEnd !== false) return false
  const end = new Date(subscription.currentPeriodEnd).getTime()
  return Number.isFinite(end) && end > now - STORE_RENEWAL_RETRY_MS
}

/**
 * The plan whose limits apply now: the member's own plan while it is in force,
 * else the Free plan, which the API applies once a paid plan has ended. A tier
 * missing from the live plans reads as Free.
 */
export function effectivePlan<P>(plans: Record<string, P>, subscription: PeriodFields, now: number = Date.now()): P | undefined {
  const own = plans[subscription.tier] ?? plans[SubscriptionTier.FREE]
  if (subscription.tier === SubscriptionTier.FREE || isPaidPlanInForce(subscription, now)) return own
  return plans[SubscriptionTier.FREE] ?? own
}

/** An App Store sandbox (App Review / TestFlight) purchase: it unlocks features, never money benefits. */
export function isSandboxPlan(subscription: Pick<Subscription, 'billingEnvironment'>): boolean {
  return subscription.billingEnvironment === 'sandbox'
}

/**
 * The plan whose platform fee new campaigns are created with: the plan in
 * effect, except that a sandbox store plan pays the Free plan's fee, as the
 * API charges (PlanLimitsService.platformFeePercent). Its limits still follow
 * the plan; see {@link effectivePlan}.
 */
export function feePlan<P>(plans: Record<string, P>, subscription: PlanFields, now: number = Date.now()): P | undefined {
  if (isSandboxPlan(subscription)) return plans[SubscriptionTier.FREE] ?? effectivePlan(plans, subscription, now)
  return effectivePlan(plans, subscription, now)
}

/**
 * Whether creator profile donations are included now, as the API decides
 * (PlanLimitsService.creatorPolicy): an active paid plan inside its period
 * that is not a sandbox purchase.
 */
export function includesCreatorDonations(
  subscription: PlanFields,
  plan: { tier: string; priceMonthly: number; priceYearly: number },
  now: number = Date.now(),
): boolean {
  if (isSandboxPlan(subscription) || subscription.status !== SubscriptionStatus.ACTIVE) return false
  const end = new Date(subscription.currentPeriodEnd).getTime()
  return Number.isFinite(end) && end > now && plan.tier !== SubscriptionTier.FREE && (plan.priceMonthly > 0 || plan.priceYearly > 0)
}

/**
 * When a lapsed paid plan ended: its period end, or null when that lies in the
 * future. A store refund revokes a plan before its period ends, and the record
 * keeps the period end it would have had, so that date is not when it ended.
 */
export function endedOn(subscription: Pick<Subscription, 'currentPeriodEnd'>, now: number = Date.now()): Date | null {
  const end = new Date(subscription.currentPeriodEnd)
  return Number.isFinite(end.getTime()) && end.getTime() <= now ? end : null
}
