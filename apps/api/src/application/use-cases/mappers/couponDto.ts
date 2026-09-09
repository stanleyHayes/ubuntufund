import type { Coupon } from '@ubuntu-fund/types';
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
