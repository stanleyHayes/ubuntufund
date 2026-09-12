import type { BillingCycle } from './subscription'

// Coupons discount a paid-subscription checkout. Money is in GHS major units
// (mirroring subscription.ts prices). A coupon is redeemed idempotently on the
// signed Paystack webhook — the redemption counter only ever moves there.

/**
 * Where a coupon may be redeemed. Chosen per coupon, and more than one is
 * allowed — an empty list means SUBSCRIPTION, so every coupon that existed
 * before this field keeps behaving exactly as it did.
 *
 * There is deliberately no TIP surface. A creator tip charges no fee when it
 * is sent (`CreateTipIntentUseCase` sets fee = 0; the plan fee is taken once,
 * on withdrawal), so the only thing a tip-time coupon could discount is the
 * creator's own earnings — an admin-owned coupon reducing a creator's income.
 * The fee a creator actually pays is the withdrawal fee, which is PAYOUT_FEE.
 *
 * There is no DONATION surface yet either, and the reason is worth recording.
 * The sound design is a platform-fee waiver: the donor pays the same, the
 * campaign receives more, and the cost is bounded by the fee — not a discount
 * on what the donor pays, which would quietly reduce what the campaign raises.
 * But the fee percentage is not stored on the intent; it is re-resolved from
 * the campaign's plan at settlement in four separate places (the Paystack
 * webhook, the Flutterwave webhook, reconciliation, and intent creation). A
 * waiver has to reach all four identically or a donation settles with the
 * wrong split, so it is its own piece of work rather than a value in this
 * enum that nothing honours.
 */
export enum CouponSurface {
  /** Reduce the price of a paid-subscription checkout. The customer pays less. */
  SUBSCRIPTION = 'subscription',
  /** Reduce the platform fee on a withdrawal. The recipient receives more. */
  PAYOUT_FEE = 'payout_fee',
}

/**
 * Which amount an affiliate's commission is computed from when a coupon
 * discounted the sale.
 */
export enum CouponCommissionBase {
  /** What was actually charged. Protects margin; a 100%-off sale pays nothing. */
  POST_COUPON = 'post_coupon',
  /** The plan's list price, so a promotion does not penalise the referrer. */
  LIST_PRICE = 'list_price',
}

export enum CouponDiscountType {
  PERCENT = 'percent',
  FIXED = 'fixed',
}

export enum CouponRedemptionStatus {
  PENDING = 'pending', // checkout created, charge not yet settled (holds a per-user slot)
  CONSUMED = 'consumed', // webhook settled — counts toward global + per-user limits
  RELEASED = 'released', // checkout failed/expired — slot freed
}

export interface Coupon {
  id: string
  code: string // stored UPPERCASE, unique
  description?: string
  discountType: CouponDiscountType
  amount: number // percent (0-100) when PERCENT; GHS off when FIXED
  /**
   * Ceiling on what a PERCENT coupon may take off, in the coupon's currency.
   *
   * Without one, "30% off" costs a fixed fraction of whatever the customer
   * buys — harmless on a starter plan, considerably less so on an enterprise
   * annual one. Ignored for FIXED coupons, whose amount is already the cap.
   * Undefined/0 = no ceiling.
   */
  maxDiscountAmount?: number
  currency: string // 'GHS' (only meaningful for FIXED)
  maxRedemptions?: number // undefined/0 = unlimited (global)
  redemptions: number // running count of CONSUMED redemptions
  perUserLimit?: number // undefined/0 = unlimited per user
  minSubtotal?: number // optional GHS floor the base price must meet
  appliesToTiers: string[] // empty = all paid tiers
  appliesToBillingCycles: BillingCycle[] // empty = all cycles
  /**
   * Restrict to customers who have never completed a paid checkout.
   *
   * Deliberately "has not paid before" rather than "signed up recently": a
   * user who registered months ago and is only now upgrading is still a new
   * customer, and cancelling does not make a returning one new again.
   */
  /** Where this coupon may be redeemed. Empty = subscription only. */
  appliesToSurfaces: CouponSurface[]
  /** Which amount an affiliate commission is computed from on a discounted sale. */
  commissionBase: CouponCommissionBase
  newUsersOnly: boolean
  /**
   * Named recipients, lowercased. Empty = open to anyone who meets the other
   * rules. A coupon with a list fails closed — an unresolvable user is not on
   * it.
   */
  allowedEmails: string[]
  validFrom?: Date
  validUntil?: Date
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CreateCouponInput {
  code: string
  description?: string
  discountType: CouponDiscountType
  amount: number
  maxRedemptions?: number
  perUserLimit?: number
  minSubtotal?: number
  appliesToTiers?: string[]
  appliesToBillingCycles?: BillingCycle[]
  maxDiscountAmount?: number
  appliesToSurfaces?: CouponSurface[]
  commissionBase?: CouponCommissionBase
  newUsersOnly?: boolean
  allowedEmails?: string[]
  validFrom?: string // ISO strings over the wire; the use-case coerces to Date
  validUntil?: string
  active?: boolean
}

export interface UpdateCouponInput {
  description?: string
  discountType?: CouponDiscountType
  amount?: number
  maxRedemptions?: number
  perUserLimit?: number
  minSubtotal?: number
  appliesToTiers?: string[]
  appliesToBillingCycles?: BillingCycle[]
  maxDiscountAmount?: number
  appliesToSurfaces?: CouponSurface[]
  commissionBase?: CouponCommissionBase
  newUsersOnly?: boolean
  allowedEmails?: string[]
  validFrom?: string
  validUntil?: string
  active?: boolean
} // code is immutable after creation

export interface CouponRedemption {
  id: string
  couponId: string
  code: string
  userId: string
  subscriptionId?: string
  checkoutId?: string
  /**
   * Which surface the slot was opened on. Absent on rows written before
   * surfaces existed, all of which were subscription checkouts.
   */
  surface?: CouponSurface
  /**
   * Subscription-only context. A payout-fee redemption has no plan and no
   * billing cycle, so these cannot be required once a coupon can be redeemed
   * anywhere but a subscription checkout.
   */
  tier?: string
  billingCycle?: BillingCycle
  status: CouponRedemptionStatus
  baseAmount: number
  discountAmount: number
  finalAmount: number
  currency: string
  providerRef?: string // Paystack reference; correlates the webhook
  /**
   * 0-based ordinal of the per-user seat this redemption holds.
   *
   * Present only when the coupon caps per-user redemptions. A unique index on
   * (couponId, userId, seat) is what actually enforces that cap: counting first
   * and inserting afterwards lets two concurrent checkouts both read the same
   * count and both pass. Released back to undefined when the slot is freed, so
   * a failed checkout does not burn the seat forever.
   */
  seat?: number
  createdAt: Date
  updatedAt: Date
}

export interface CouponValidationInput {
  // POST /coupons/preview body
  code: string
  tier: string
  billingCycle: BillingCycle
}

export interface CouponPreview {
  // soft response (never throws)
  valid: boolean
  code: string
  discountType?: CouponDiscountType
  baseAmount: number
  discountAmount: number
  finalAmount: number
  currency: string
  reason?: string // populated when valid === false
}
