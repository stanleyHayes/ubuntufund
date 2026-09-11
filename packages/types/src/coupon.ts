import type { BillingCycle } from './subscription'

// Coupons discount a paid-subscription checkout. Money is in GHS major units
// (mirroring subscription.ts prices). A coupon is redeemed idempotently on the
// signed Paystack webhook — the redemption counter only ever moves there.

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
  currency: string // 'GHS' (only meaningful for FIXED)
  maxRedemptions?: number // undefined/0 = unlimited (global)
  redemptions: number // running count of CONSUMED redemptions
  perUserLimit?: number // undefined/0 = unlimited per user
  minSubtotal?: number // optional GHS floor the base price must meet
  appliesToTiers: string[] // empty = all paid tiers
  appliesToBillingCycles: BillingCycle[] // empty = all cycles
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
  tier: string
  billingCycle: BillingCycle
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
