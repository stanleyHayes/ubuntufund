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

  /**
   * Open a PENDING slot, claiming a per-user seat atomically.
   *
   * `perUserLimit` falsy means unlimited: no seat is assigned and this behaves
   * exactly like `create`. Otherwise the seat ordinal is claimed through a
   * unique index, so concurrent checkouts cannot both take the last one —
   * whichever loses the collision retries at the next ordinal and is refused
   * once that would exceed the limit.
   *
   * Returns null when every seat is taken. Callers translate that into the
   * same 422 the pre-flight count produces.
   */
  createWithSeat(
    redemption: CouponRedemption,
    perUserLimit: number | undefined
  ): Promise<CouponRedemption | null>;
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
  /**
   * Free a slot: PENDING → RELEASED, returning its per-user seat to the pool.
   *
   * Called when a checkout fails or is abandoned. Without it a failed payment
   * permanently consumes one of the user's allowed redemptions, and RELEASED —
   * the status `countByCouponAndUser` excludes — is never reachable.
   */
  markReleased(id: string): Promise<CouponRedemption | null>;
  /** Link the activated subscription once the checkout settles. */
  attachSubscription(
    id: string,
    subscriptionId: string
  ): Promise<CouponRedemption | null>;
}
