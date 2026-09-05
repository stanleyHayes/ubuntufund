import type { CouponRedemption } from '@ubuntu-fund/types';

/**
 * Persistence for coupon-redemption slots. A slot is opened PENDING when a
 * checkout is created (reserving a per-user seat), moved to CONSUMED when the
 * signed webhook settles the charge, or RELEASED when the checkout fails/expires
 * (freeing the seat). Per-user enforcement reads live counts here; the global
 * cap is enforced on the coupon itself.
 */
export interface CouponRedemptionRepositoryPort {
  create(redemption: CouponRedemption): Promise<CouponRedemption>;
  findById(id: string): Promise<CouponRedemption | null>;
  /** Correlate a settlement webhook back to its redemption by Paystack reference. */
  findByProviderRef(providerRef: string): Promise<CouponRedemption | null>;

  /**
   * Attach the provider reference to a provisional PENDING redemption once the
   * charge is opened (or a synthetic ref for a coupon-zeroed activation), so
   * settlement can correlate the slot back by the same reference as its checkout.
   * Returns the updated redemption, or null when no record exists for `id`.
   */
  setProviderRef(
    id: string,
    providerRef: string
  ): Promise<CouponRedemption | null>;

  /**
   * How many of this user's redemptions of the coupon still hold a seat — i.e.
   * PENDING or CONSUMED (status !== 'released'). RELEASED slots were freed and
   * do not count against the per-user limit.
   */
  countByCouponAndUser(couponId: string, userId: string): Promise<number>;

  /** Settle a slot: PENDING → CONSUMED. Returns the updated redemption, or null. */
  markConsumed(id: string): Promise<CouponRedemption | null>;
  /** Free a slot: PENDING → RELEASED. Returns the updated redemption, or null. */
  markReleased(id: string): Promise<CouponRedemption | null>;
  /** Link the activated subscription once the checkout settles. */
  attachSubscription(
    id: string,
    subscriptionId: string
  ): Promise<CouponRedemption | null>;
}
