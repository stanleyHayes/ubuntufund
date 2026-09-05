import type { CouponEntity } from '../../entities/Coupon.js';

/** Optional server-side filter for the admin listing. */
export interface CouponListFilter {
  active?: boolean;
}

export interface CouponRepositoryPort {
  create(coupon: CouponEntity): Promise<CouponEntity>;
  findById(id: string): Promise<CouponEntity | null>;
  /** Resolve a coupon by its code. Codes are stored and matched UPPERCASE. */
  findByCode(code: string): Promise<CouponEntity | null>;
  /** All coupons, newest first (admin console); optionally filtered. */
  findAll(filter?: CouponListFilter): Promise<CouponEntity[]>;
  update(coupon: CouponEntity): Promise<CouponEntity>;
  delete(id: string): Promise<void>;

  /**
   * Atomically bump `redemptions` by one, but only while the coupon is still
   * under its global cap (an unlimited coupon — falsy `maxRedemptions` — always
   * succeeds). Returns the updated coupon, or null when the cap was already
   * reached (another redemption won). This is the single global-limit gate, so
   * concurrent settlements can never oversell a capped coupon.
   */
  incrementRedemptionIfUnderLimit(id: string): Promise<CouponEntity | null>;
}
