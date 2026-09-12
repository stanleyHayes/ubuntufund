import {
  CouponDiscountType,
  SubscriptionTier,
  BillingCycle,
  CouponSurface,
  CouponCommissionBase,
  SUBSCRIPTION_PLANS,
  type CreateCouponInput,
} from '@ubuntu-fund/types'
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
// Coupons discount paid checkouts, so FREE is never a valid applicability.
export const PAID_TIERS = Object.values(SubscriptionTier).filter((t) => t !== SubscriptionTier.FREE)

/** Display name for a tier id (falls back to the id for admin-added tiers). */
export const planLabel = (t: string): string =>
  (SUBSCRIPTION_PLANS as Record<string, { name: string }>)[t]?.name ?? t

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

export function validateCouponStep(form: CouponForm, step: number): string | null {
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
