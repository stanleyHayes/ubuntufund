import {
  CouponDiscountType,
  BillingCycle,
  CouponSurface,
  CouponCommissionBase,
  type CreateCouponInput,
} from '@ubuntu-fund/types'
import type { PlanMap } from '@/lib/subscriptionMetrics'
import { comparePlans, isFreePlan } from '@/lib/plans'
export const SURFACE_LABEL: Record<CouponSurface, string> = {
  [CouponSurface.SUBSCRIPTION]: 'Subscriptions',
  [CouponSurface.DONATION]: 'Donations',
  [CouponSurface.PAYOUT_FEE]: 'Withdrawal fees',
}

/** What the platform actually gives up on each surface, in plain terms. */
export const SURFACE_HINT: Record<CouponSurface, string> = {
  [CouponSurface.SUBSCRIPTION]: 'The subscriber pays less',
  [CouponSurface.DONATION]: 'Platform fee waived — the campaign receives more',
  [CouponSurface.PAYOUT_FEE]: 'Lower fee on a withdrawal',
}
/** The live plans the coupon screens name and offer tiers from (useAdminPlans). */
export interface CouponPlans {
  byTier: PlanMap
  isLoading: boolean
  error: string | null
  retry: () => void
}

/** Live display name for a tier id (falls back to the id while plans are unavailable). */
export const planLabel = (t: string, plans: PlanMap): string => plans[t]?.name ?? t

/**
 * Tiers a coupon can name: live plans that are not retired (inactive) and have
 * a price (coupons discount paid checkouts, so a free plan never qualifies) in
 * plan order, plus any tier the saved coupon already names, so it can be kept
 * or removed.
 */
export function couponTierOptions(plans: PlanMap, savedTiers: string[] = []): string[] {
  const offered = Object.values(plans)
    .filter((plan) => plan.active !== false && !isFreePlan(plan))
    .sort(comparePlans)
    .map((plan) => plan.tier)
  return [...offered, ...savedTiers.filter((tier) => !offered.includes(tier))]
}

/** Whether the coupon discounts subscription checkouts, the only place its tiers apply (no surfaces = subscriptions only, as the API reads it). */
export const appliesToSubscriptions = (form: Pick<CouponForm, 'appliesToSurfaces'>): boolean =>
  form.appliesToSurfaces.length === 0 || form.appliesToSurfaces.includes(CouponSurface.SUBSCRIPTION)

export interface CouponForm {
  code: string
  description: string
  discountType: CouponDiscountType
  amount: number
  /** Ceiling on a percentage discount. 0 = none. */
  maxDiscountAmount: number
  /** Where the coupon may be redeemed. Empty = subscription only. */
  appliesToSurfaces: CouponSurface[]
  /** Which amount an affiliate commission is computed from. */
  commissionBase: CouponCommissionBase
  /** Restrict to customers who have never completed a paid checkout. */
  newUsersOnly: boolean
  /** Named recipients, one per line in the field; empty = open to anyone. */
  allowedEmails: string
  maxRedemptions: number
  perUserLimit: number
  minSubtotal: number
  appliesToTiers: string[]
  appliesToBillingCycles: BillingCycle[]
  validFrom: string
  validUntil: string
  active: boolean
}

export const emptyForm: CouponForm = {
  code: '',
  description: '',
  discountType: CouponDiscountType.PERCENT,
  amount: 10,
  maxDiscountAmount: 0,
  appliesToSurfaces: [],
  commissionBase: CouponCommissionBase.POST_COUPON,
  newUsersOnly: false,
  allowedEmails: '',
  maxRedemptions: 0,
  perUserLimit: 0,
  minSubtotal: 0,
  appliesToTiers: [],
  appliesToBillingCycles: [],
  validFrom: '',
  validUntil: '',
  active: true,
}

/** One address per line or comma-separated; blanks and duplicates dropped. */
export const parseEmails = (raw: string): string[] => [
  ...new Set(
    raw
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  ),
]

/**
 * No tier can be chosen while the live plans are loading or failed, and an
 * empty choice makes a subscription coupon apply to every paid plan, so the
 * tier step cannot be left until they load.
 */
function tierChoiceError(form: CouponForm, plans?: Pick<CouponPlans, 'isLoading' | 'error'>): string | null {
  if (!plans || !appliesToSubscriptions(form)) return null
  if (plans.isLoading) return 'Plans are still loading. Choose which plans this coupon applies to once they appear.'
  if (plans.error) return 'Choose which plans this coupon applies to before continuing: retry loading the plans below.'
  return null
}

/** Why a step cannot be left, or null. Step 1 also needs the live plans' state (see tierChoiceError). */
export function validateCouponStep(
  form: CouponForm,
  step: number,
  plans?: Pick<CouponPlans, 'isLoading' | 'error'>,
): string | null {
  if (step === 1) return tierChoiceError(form, plans)
  if (step === 0) {
    if (!form.code.trim() || form.code.trim().length > 50)
      return 'Enter a coupon code between 1 and 50 characters.'
    if (form.description.length > 500) return 'Keep the description within 500 characters.'
    if (
      !Number.isFinite(form.amount) ||
      form.amount <= 0 ||
      (form.discountType === CouponDiscountType.PERCENT && form.amount > 100)
    )
      return 'Enter a positive discount. Percentage discounts cannot exceed 100%.'
    if (!Number.isFinite(form.maxDiscountAmount) || form.maxDiscountAmount < 0)
      return 'The maximum discount cannot be negative.'
  }
  if (step === 2) {
    if (
      [form.maxRedemptions, form.perUserLimit].some(
        (value) => !Number.isSafeInteger(value) || value < 0,
      )
    )
      return 'Redemption limits must be whole numbers of zero or more.'
    if (!Number.isFinite(form.minSubtotal) || form.minSubtotal < 0)
      return 'The minimum subtotal cannot be negative.'
    if (
      [form.validFrom, form.validUntil].some(
        (value) => value && Number.isNaN(new Date(value).getTime()),
      )
    )
      return 'Enter valid start and end dates.'
    if (form.validFrom && form.validUntil && new Date(form.validUntil) < new Date(form.validFrom))
      return 'The end date must be on or after the start date.'
    const emails = parseEmails(form.allowedEmails)
    if (emails.length > 500 || emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
      return 'Enter valid email addresses, with no more than 500 recipients.'
  }
  return null
}

export function createCouponPayload(form: CouponForm): CreateCouponInput {
  return {
    code: form.code.trim().toUpperCase(),
    description: form.description.trim() || undefined,
    discountType: form.discountType,
    amount: form.amount,
    maxDiscountAmount:
      form.discountType === CouponDiscountType.PERCENT
        ? form.maxDiscountAmount || undefined
        : undefined,
    appliesToSurfaces: form.appliesToSurfaces,
    commissionBase: form.commissionBase,
    newUsersOnly: form.newUsersOnly,
    allowedEmails: parseEmails(form.allowedEmails),
    maxRedemptions: form.maxRedemptions || undefined,
    perUserLimit: form.perUserLimit || undefined,
    minSubtotal: form.minSubtotal || undefined,
    appliesToTiers: form.appliesToTiers,
    appliesToBillingCycles: form.appliesToBillingCycles,
    validFrom: form.validFrom || undefined,
    validUntil: form.validUntil || undefined,
    active: form.active,
  }
}
