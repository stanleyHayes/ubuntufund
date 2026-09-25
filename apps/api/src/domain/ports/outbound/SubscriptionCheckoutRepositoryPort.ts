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
   * the signed webhook / inline settlement can correlate it. `page` keeps the
   * hosted payment page so an unpaid checkout can be resumed. Returns the
   * updated checkout, or null when no record exists for `id`.
   */
  setProviderRef(
    id: string,
    providerRef: string,
    page?: { authorizationUrl?: string; accessCode?: string }
  ): Promise<SubscriptionCheckout | null>;

  /**
   * Atomically move PENDING (or EXPIRED) → SUCCEEDED. Returns the updated
   * checkout, or null when it was already SUCCEEDED/FAILED. This is the single
   * exactly-once settlement gate, mirroring DonationIntent.transitionToSucceeded.
   * EXPIRED is accepted because an unpaid checkout is only expired by us; if the
   * provider later confirms the charge (a late webhook or verification), the
   * member must get what they paid for rather than lose the money.
   * `allowFromFailed` also admits FAILED — only for a success the caller has
   * re-verified server-side (a declined first attempt, then a paid retry on
   * the same checkout).
   */
  transitionToSucceeded(id: string, opts?: { allowFromFailed?: boolean }): Promise<SubscriptionCheckout | null>;

  /** Atomically move PENDING → FAILED. Null when not PENDING (idempotent). */
  transitionToFailed(id: string): Promise<SubscriptionCheckout | null>;

  /** Atomically move PENDING → EXPIRED (unpaid past its lifetime). Null when not PENDING. */
  transitionToExpired(id: string): Promise<SubscriptionCheckout | null>;

  /**
   * PENDING checkouts created before `olderThan` for the reconciliation sweep:
   * never-visited first, then the least recently visited, so rows the provider
   * cannot resolve yet rotate behind newer ones instead of starving them.
   */
  findStalePending(olderThan: Date, limit: number): Promise<SubscriptionCheckout[]>;

  /** Stamp a sweep visit on a still-PENDING checkout (see findStalePending). */
  recordReconciliationAttempt(id: string, attemptedAt: Date): Promise<void>;

  /** A user's PENDING checkouts, newest first. */
  findPendingByUser(userId: string, limit: number): Promise<SubscriptionCheckout[]>;
}
