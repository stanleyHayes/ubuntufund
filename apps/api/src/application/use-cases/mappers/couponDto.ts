import type { Coupon, CouponRedemption } from '@ubuntu-fund/types';
import type { CouponEntity } from '../../../domain/entities/Coupon.js';

/** Map a coupon domain entity onto its wire DTO. */
export function toCouponDto(entity: CouponEntity): Coupon {
  const c = entity.toPlain();
  return {
    id: c.id,
    code: c.code,
    description: c.description,
    discountType: c.discountType,
    amount: c.amount,
    currency: c.currency,
    maxRedemptions: c.maxRedemptions,
    redemptions: c.redemptions,
    perUserLimit: c.perUserLimit,
    minSubtotal: c.minSubtotal,
    appliesToTiers: c.appliesToTiers,
    appliesToBillingCycles: c.appliesToBillingCycles,
    validFrom: c.validFrom,
    validUntil: c.validUntil,
    active: c.active,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

/**
 * A persisted redemption as it reaches the mapper: either the plain
 * `CouponRedemption` the repository already returns, or a raw Mongo document /
 * lean row still keyed by `_id`.
 */
type CouponRedemptionRow = Omit<CouponRedemption, 'id'> & {
  id?: string;
  _id?: { toString(): string };
};

/**
 * Normalise a persisted redemption onto its wire DTO, projecting the exact
 * `CouponRedemption` fields and resolving `id` from either a normalised `id` or
 * a Mongo `_id`.
 */
export function toCouponRedemptionDto(row: CouponRedemptionRow): CouponRedemption {
  return {
    id: row.id ?? row._id?.toString() ?? '',
    couponId: row.couponId,
    code: row.code,
    userId: row.userId,
    subscriptionId: row.subscriptionId,
    checkoutId: row.checkoutId,
    tier: row.tier,
    billingCycle: row.billingCycle,
    status: row.status,
    baseAmount: row.baseAmount,
    discountAmount: row.discountAmount,
    finalAmount: row.finalAmount,
    currency: row.currency,
    providerRef: row.providerRef,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
