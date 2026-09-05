import type { SubscriptionCheckout } from '@ubuntu-fund/types';

/**
 * Persistence for the paid-subscription Paystack checkout rail. Mirrors
 * DonationIntent: a PENDING checkout is created, the donor is redirected to
 * Paystack, and settlement (activate the subscription, redeem the coupon, award
 * the affiliate commission) happens exactly once from the signed webhook.
 */
export interface SubscriptionCheckoutRepositoryPort {
  create(checkout: SubscriptionCheckout): Promise<SubscriptionCheckout>;
  findById(id: string): Promise<SubscriptionCheckout | null>;
  /**
   * Resolve a checkout by its provider reference (the Paystack webhook seam —
   * settlement correlates the signed event back to its checkout by this ref).
   */
  findByProviderRef(providerRef: string): Promise<SubscriptionCheckout | null>;

  /**
   * Store the provider reference on a freshly-created PENDING checkout once the
   * charge is opened (or, for a coupon-zeroed activation, a synthetic ref), so
   * the signed webhook / inline settlement can correlate it. Returns the updated
   * checkout, or null when no record exists for `id`.
   */
  setProviderRef(
    id: string,
    providerRef: string
  ): Promise<SubscriptionCheckout | null>;

  /**
   * Atomically move PENDING → SUCCEEDED. Returns the updated checkout, or null
   * when it was no longer PENDING (already terminal). This is the single
   * exactly-once settlement gate, mirroring DonationIntent.transitionToSucceeded.
   */
  transitionToSucceeded(id: string): Promise<SubscriptionCheckout | null>;

  /** Atomically move PENDING → FAILED. Null when not PENDING (idempotent). */
  transitionToFailed(id: string): Promise<SubscriptionCheckout | null>;
}
