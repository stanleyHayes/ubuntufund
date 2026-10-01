import { BillingCycle, SubscriptionStatus, SubscriptionTier, yearlyPricePerMonth } from '@ubuntu-fund/types'
import { formatPlanPrice } from './money'

interface PeriodFields {
  tier: string
  status: SubscriptionStatus
  currentPeriodEnd?: string | Date
}

interface BillingFields extends PeriodFields {
  billingProvider?: 'web' | 'apple' | 'google'
  /** Store plans only: 'sandbox' for App Review / TestFlight purchases. */
  billingEnvironment?: 'production' | 'sandbox'
  /** Store plans: automatic renewal is off. */
  cancelAtPeriodEnd?: boolean
}

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
 * Whether the App Store or Google Play manages this plan, so web checkout is
 * refused: a store plan in force, or a lapsed one the store may still renew
 * (automatic renewal on, ended within the 60-day billing-retry window). The
 * API's billing-rail claim refuses a web purchase in both cases.
 */
export function isStoreManaged(subscription: BillingFields, now: number = Date.now()): boolean {
  if (subscription.billingProvider !== 'apple' && subscription.billingProvider !== 'google') return false
  if (isPaidPlanInForce(subscription, now)) return true
  if (subscription.tier === SubscriptionTier.FREE || subscription.cancelAtPeriodEnd !== false || !subscription.currentPeriodEnd) return false
  const end = new Date(subscription.currentPeriodEnd).getTime()
  return Number.isFinite(end) && end > now - STORE_RENEWAL_RETRY_MS
}

/**
 * The plan whose limits apply now: the member's own plan while it is in
 * force, else the Free plan, which the API applies once a paid plan has ended.
 * A tier missing from the live plans reads as Free.
 */
export function effectivePlan<P>(plans: Record<string, P>, subscription: PeriodFields, now: number = Date.now()): P | undefined {
  const own = plans[subscription.tier] ?? plans[SubscriptionTier.FREE]
  if (subscription.tier === SubscriptionTier.FREE || isPaidPlanInForce(subscription, now)) return own
  return plans[SubscriptionTier.FREE] ?? own
}

/**
 * The plan whose platform fee new campaigns are created with: the plan in
 * effect, except that a sandbox (App Review / TestFlight) store plan pays the
 * Free plan's fee, as the API charges. Its limits still follow the plan.
 */
export function feePlan<P>(plans: Record<string, P>, subscription: BillingFields, now: number = Date.now()): P | undefined {
  if (subscription.billingEnvironment === 'sandbox') return plans[SubscriptionTier.FREE] ?? effectivePlan(plans, subscription, now)
  return effectivePlan(plans, subscription, now)
}

interface PlanTerms {
  name: string
  platformFeePercent: number
  maxActiveCampaigns: number
}

/**
 * The current-plan card's terms: the fee new campaigns are created with and
 * the active-campaign limit, each from the plan that applies now.
 */
export function planTermsLine(terms: { feePlan: PlanTerms; limitsPlan: PlanTerms; lapsed: boolean }): string {
  const limit = terms.limitsPlan.maxActiveCampaigns
  const campaigns = limit < 0 ? 'Unlimited campaigns' : `${limit} campaign${limit === 1 ? '' : 's'}`
  return `${terms.lapsed ? `${terms.limitsPlan.name} features apply: ` : ''}${terms.feePlan.platformFeePercent}% platform fee on new campaigns | ${campaigns}`
}

/** A campaign keeps the fee locked when it was created; creator withdrawals use the plan in effect. */
export const EXISTING_CAMPAIGN_FEE_NOTE = 'Campaigns you already run keep the fee they were created with; creator withdrawals use your current plan’s fee.'

/** Shown before that note when a sandbox store plan gets the Free plan's fee. */
export function sandboxFeeNote(freePlanName = 'Free'): string {
  return `This plan is a store test purchase, so new campaigns get the ${freePlanName} plan’s fee.`
}

/**
 * The current-plan card's date line: when an in-force plan's access ends, or
 * when a lapsed one ended. A plan revoked before its period ended (a store
 * refund) keeps that future period end on record, so no date is given then.
 */
export function planDateLine(subscription: PeriodFields, now: number = Date.now()): string {
  if (subscription.tier === SubscriptionTier.FREE) return 'No end date'
  const end = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null
  const dated = !!end && Number.isFinite(end.getTime())
  if (isPaidPlanInForce(subscription, now)) return `Access through: ${end!.toLocaleDateString()}`
  return dated && end!.getTime() <= now ? `Ended on ${end!.toLocaleDateString()}` : 'Ended'
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

/**
 * The upgrade call to action, with the plan it opens: for a member on Free or
 * whose plan has lapsed, unless a store still manages the plan (the API would
 * refuse the purchase) or nothing can be bought. Null hides it.
 */
export function upgradeOffer<P extends PlanForSale & { name: string }>(
  plans: P[],
  subscription: BillingFields,
  now: number = Date.now(),
): { plan: P; label: string } | null {
  const onFree = subscription.tier === SubscriptionTier.FREE || !isPaidPlanInForce(subscription, now)
  if (!onFree || isStoreManaged(subscription, now)) return null
  const plan = upgradePlan(plans)
  return plan ? { plan, label: `Upgrade to ${plan.name}` } : null
}

/**
 * What an App Store / Google Play plan card lists under the store price: the
 * plan's platform fee on new campaigns first (the terms promise fees are shown
 * before purchase), then its limits and the features it unlocks.
 */
export function storePlanSummary(plan: {
  platformFeePercent: number
  maxActiveCampaigns: number
  liveStreaming?: boolean
  campaignCollaboration?: boolean
  onBehalfCampaigns?: boolean
}): string {
  const limit = plan.maxActiveCampaigns
  return [
    `${plan.platformFeePercent}% platform fee on new campaigns`,
    limit < 0 ? 'Unlimited active campaigns' : `${limit} active campaign${limit === 1 ? '' : 's'}`,
    plan.liveStreaming ? 'Live streaming' : null,
    plan.campaignCollaboration ? 'Campaign collaboration' : null,
    plan.onBehalfCampaigns ? 'Campaigns on behalf of others' : null,
  ].filter(Boolean).join(' · ')
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

/** One billing-cycle choice in the checkout sheet. */
export interface CycleOptionView {
  title: 'Monthly' | 'Yearly'
  /** 'GH₵299 / 1 year', or 'Not offered' for a cycle priced 0. */
  price: string
  /** '≈ GH₵24.92 / mo' for an offered yearly cycle. */
  perMonth: string | null
  offered: boolean
  accessibilityLabel: string
}

/** A cycle priced 0 is not offered: it is never shown as a GH₵0 price. */
export function cycleOption(cycle: BillingCycle, plan: { priceMonthly: number; priceYearly: number }): CycleOptionView {
  const yearly = cycle === BillingCycle.YEARLY
  const title = yearly ? 'Yearly' : 'Monthly'
  const amount = yearly ? plan.priceYearly : plan.priceMonthly
  if (!(amount > 0)) return { title, price: 'Not offered', perMonth: null, offered: false, accessibilityLabel: `${title}, not offered` }
  const price = `${formatPlanPrice(amount)} / ${yearly ? '1 year' : '30 days'}`
  return {
    title,
    price,
    perMonth: yearly ? `≈ ${formatPlanPrice(yearlyPricePerMonth(amount))} / mo` : null,
    offered: true,
    accessibilityLabel: `${title}, ${price}`,
  }
}

/** A coupon quote as the preview endpoint returns it. */
interface CouponQuote {
  valid: boolean
  baseAmount: number
  discountAmount: number
  finalAmount: number
  reason?: string
}

/** The quote the sheet holds, with the inputs it was priced for; `preview` is null when quoting failed. */
export interface SheetQuote {
  key: string
  preview: CouponQuote | null
}

/** The inputs a coupon quote is priced for. Codes match case-insensitively, as on the server. */
export function couponQuoteKey(tier: string, billingCycle: string, code: string): string {
  return `${tier}|${billingCycle}|${code.trim().toUpperCase()}`
}

export interface SheetPrice {
  /** A code is entered but its quote for this plan and cycle is not in yet. */
  checking: boolean
  /** Quoting the code failed, so what checkout would charge is not known. */
  unchecked: boolean
  /** The quote for exactly the code, plan and cycle on screen. */
  quote: CouponQuote | null
  baseAmount: number
  discountAmount: number
  finalAmount: number
  payLabel: string
  canPay: boolean
}

/**
 * What the checkout sheet shows and lets the member pay. A quote counts only
 * for the code, plan and cycle it was priced for, so the sheet never shows one
 * code's or cycle's total while checkout would charge another's; until the
 * current one is in, Pay waits.
 */
export function checkoutSheetPrice(input: {
  listPrice: number
  tier: string
  billingCycle: string
  couponCode: string
  quote: SheetQuote | null
  switching: boolean
}): SheetPrice {
  const code = input.couponCode.trim()
  const offered = input.listPrice > 0
  const current = code && input.quote?.key === couponQuoteKey(input.tier, input.billingCycle, code) ? input.quote : null
  const checking = !!code && !current
  const unchecked = !!current && current.preview === null
  const valid = current?.preview?.valid ? current.preview : null
  // A coupon quote carries the server's price, which is what checkout charges.
  const baseAmount = valid ? valid.baseAmount : input.listPrice
  const finalAmount = valid ? valid.finalAmount : baseAmount
  const discountAmount = valid ? valid.discountAmount : 0
  const payLabel = !offered ? 'Not offered'
    : checking ? 'Checking coupon…'
      : unchecked ? 'Coupon not checked'
        : finalAmount === 0 ? 'Activate plan'
          : input.switching ? `Replace plan and pay ${formatPlanPrice(finalAmount)}` : `Pay ${formatPlanPrice(finalAmount)}`
  return {
    checking,
    unchecked,
    quote: current?.preview ?? null,
    baseAmount,
    discountAmount,
    finalAmount,
    payLabel,
    canPay: offered && !checking && !unchecked,
  }
}
