import { SubscriptionTier, type SubscriptionPlan } from '@ubuntu-fund/types'
import { formatPlanPrice, toPesewas, yearlyPerMonthPesewas } from './money'

type Prices = Pick<SubscriptionPlan, 'priceMonthly' | 'priceYearly'>

/** The highest monthly or yearly price the API accepts (apps/api planValidation MAX_PLAN_PRICE). */
export const MAX_PLAN_PRICE = 1_000_000

/** Admin-set plan order: sortOrder, then monthly price, then tier id, so ties never follow API order. */
export function comparePlans(a: SubscriptionPlan, b: SubscriptionPlan): number {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.priceMonthly - b.priceMonthly || a.tier.localeCompare(b.tier)
}

/**
 * Why a sort order does not settle a plan's place: the other plans (all but
 * `exceptTier`, the plan being edited) that use it, since ties fall to
 * monthly price, then tier id. Null when no other plan uses it.
 */
export function sortOrderTie(plans: SubscriptionPlan[], sortOrder: number, exceptTier?: string): string | null {
  const names = plans
    .filter((plan) => plan.tier !== exceptTier && (plan.sortOrder ?? 0) === sortOrder)
    .sort(comparePlans)
    .map((plan) => plan.name || plan.tier)
  if (names.length === 0) return null
  const list = new Intl.ListFormat('en', { type: 'conjunction' }).format(names)
  return `${list} also ${names.length === 1 ? 'uses' : 'use'} ${sortOrder}; ties are ordered by monthly price, then tier id.`
}

/** Charges nothing on either cycle. A paid plan may offer one cycle only: 0 means that cycle is not offered. */
export function isFreePlan(plan: Prices): boolean {
  return !(plan.priceMonthly > 0) && !(plan.priceYearly > 0)
}

/**
 * Whether members can buy the plan themselves at web checkout: active, public,
 * and neither Free (nothing to buy) nor Enterprise (negotiated). Mirrors
 * apps/api PlanService.isSelfServePlan, the rule checkout, the coupon preview
 * and the store routes apply.
 */
export function isSelfServe(plan: Pick<SubscriptionPlan, 'tier' | 'active' | 'isPublic'>): boolean {
  return plan.active !== false && plan.isPublic !== false &&
    plan.tier !== SubscriptionTier.FREE && plan.tier !== SubscriptionTier.ENTERPRISE
}

/**
 * Sold by the sales team, not at web checkout: Enterprise and non-public
 * plans, so their price is only a reference. A retired (inactive) plan is not
 * sold at all; {@link isSelfServe} is the whole checkout rule.
 */
export function isSalesOnly(plan: Pick<SubscriptionPlan, 'tier' | 'isPublic'>): boolean {
  return plan.tier === SubscriptionTier.ENTERPRISE || plan.isPublic === false
}

export const SALES_ONLY_HINT = 'Reference price, not sold at web checkout'

/** One billing cycle's price: 'Free' on a free plan, 'Not offered' for a paid plan's zero cycle. */
export function cyclePrice(amount: number, plan: Prices): string {
  return amount > 0 ? formatPlanPrice(amount) : isFreePlan(plan) ? 'Free' : 'Not offered'
}

/** Checkout charges whole pesewas, so a price must be 0 to {@link MAX_PLAN_PRICE} with at most two decimals, as the API requires. */
export function priceInvalid(amount: number): boolean {
  return !Number.isFinite(amount) || amount < 0 || amount > MAX_PLAN_PRICE || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6
}

export const ON_BEHALF_BLOCKED = 'Switched on, but 0 allowed: nobody on this plan can start one'

/** Campaigns on behalf of others switched on with a limit of 0: the API refuses every attempt. */
export function onBehalfBlocked(plan: Pick<SubscriptionPlan, 'onBehalfCampaigns' | 'maxOnBehalfCampaigns'>): boolean {
  return plan.onBehalfCampaigns === true && plan.maxOnBehalfCampaigns === 0
}

/**
 * The plan with one benefit switched. Rows written before the on-behalf limit
 * existed read 0, so switching the feature on there makes it unlimited (-1, the
 * seed default) instead of leaving it switched on but unusable.
 */
export function withFeature(plan: SubscriptionPlan, key: keyof SubscriptionPlan, on: boolean): SubscriptionPlan {
  const next = { ...plan, [key]: on } as SubscriptionPlan
  if (key === 'onBehalfCampaigns' && on && plan.maxOnBehalfCampaigns === 0) next.maxOnBehalfCampaigns = -1
  return next
}

const percent = (value: number) => `${value.toLocaleString('en-GH', { maximumFractionDigits: 1 })}%`

/** Below this share, one decimal reads '0%', so the amount is stated instead. */
const SMALLEST_PERCENT = 0.05

export interface YearlyNote {
  /** e.g. '≈ GH₵ 833.33/mo · 16.7% below 12 × monthly' */
  text: string
  /** Yearly costs at least as much as twelve monthly payments. */
  warning: boolean
  /** Yearly costs more than twelve monthly payments: the plan dialogs refuse to save it. */
  exceeds: boolean
}

/** The yearly price per month and how it compares with 12 × monthly, computed in pesewas; null when yearly is not offered. */
export function yearlyNote(plan: Prices): YearlyNote | null {
  const yearly = toPesewas(plan.priceYearly)
  if (!(yearly > 0)) return null
  const perMonth = `≈ ${formatPlanPrice(yearlyPerMonthPesewas(plan.priceYearly) / 100)}/mo`
  const twelveMonthly = 12 * toPesewas(plan.priceMonthly)
  if (!(twelveMonthly > 0)) return { text: `${perMonth} · monthly not offered`, warning: false, exceeds: false }
  if (yearly === twelveMonthly) return { text: `${perMonth} · same as 12 × monthly, so yearly saves nothing`, warning: true, exceeds: false }
  const exceeds = yearly > twelveMonthly
  const side = `${exceeds ? 'above' : 'below'} 12 × monthly`
  const gap = Math.abs(yearly - twelveMonthly)
  const share = (gap / twelveMonthly) * 100
  // A gap of a few pesewas would read '0%', so it is stated in cedis beside 12 × monthly.
  const comparison = share < SMALLEST_PERCENT
    ? `${formatPlanPrice(gap / 100)} ${side} (${formatPlanPrice(twelveMonthly / 100)})`
    : `${percent(share)} ${side}`
  return exceeds
    ? { text: `${perMonth} · ${comparison}, so yearly costs more`, warning: true, exceeds: true }
    : { text: `${perMonth} · ${comparison}`, warning: false, exceeds: false }
}

export interface PricingChange {
  kind: 'price' | 'fee'
  label: string
  from: string
  to: string
  /**
   * Relative change, e.g. '+900.1%'; null when the old value was 0. A change
   * one decimal would show as '0%' is the amount instead: '+GH₵ 0.01', or
   * '+0.002 percentage points' for a fee.
   */
  change: string | null
}

const PRICING_FIELDS = [
  { key: 'priceMonthly', label: 'Monthly price', money: true },
  { key: 'priceYearly', label: 'Yearly price', money: true },
  { key: 'platformFeePercent', label: 'Platform fee', money: false },
  { key: 'onBehalfFeePercent', label: 'Extra fee on campaigns on behalf of others', money: false },
] as const

/** Every price and fee an edit changes, old → new with the % change, for the confirm step before saving. */
export function pricingChanges(before: SubscriptionPlan, after: SubscriptionPlan): PricingChange[] {
  return PRICING_FIELDS.flatMap(({ key, label, money }): PricingChange[] => {
    const [oldValue, newValue] = [before[key] ?? 0, after[key] ?? 0]
    // Prices compare in the pesewas checkout charges; fees as entered.
    const [from, to] = money ? [toPesewas(oldValue), toPesewas(newValue)] : [oldValue, newValue]
    if (from === to) return []
    const show = (value: number, plan: SubscriptionPlan) => (money ? cyclePrice(value, plan) : `${value}%`)
    return [{
      kind: money ? 'price' : 'fee',
      label,
      from: show(oldValue, before),
      to: show(newValue, after),
      change: changeLabel(from, to, money),
    }]
  })
}

/** The change from → to (pesewas for a price, as entered for a fee), as described on {@link PricingChange}. */
function changeLabel(from: number, to: number, money: boolean): string | null {
  if (!(from > 0)) return null
  const sign = to > from ? '+' : '−'
  const gap = Math.abs(to - from)
  const share = (gap / from) * 100
  if (share >= SMALLEST_PERCENT) return `${sign}${percent(share)}`
  return money
    ? `${sign}${formatPlanPrice(gap / 100)}`
    : `${sign}${gap.toLocaleString('en-GH', { maximumSignificantDigits: 3 })} percentage points`
}
