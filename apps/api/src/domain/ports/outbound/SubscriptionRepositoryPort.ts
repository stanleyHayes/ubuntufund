import type { Subscription } from '@ubuntu-fund/types';

/**
 * The persisted subscription. `paymentReferences` lists the web (Paystack)
 * charges that paid for the CURRENT period — one for a fresh period, more after
 * early renewals — so a refund can take back exactly the time it paid for.
 */
export type SubscriptionRecord = Subscription & { paymentReferences?: string[] };

export interface SubscriptionRepositoryPort {
  /** Write an existing policy document inside a consuming transaction. */
  lockForConsumption?(userId: string): Promise<void>;
  /** A user has at most one subscription record. */
  findByUserId(userId: string): Promise<SubscriptionRecord | null>;
  findById(id: string): Promise<SubscriptionRecord | null>;
  findAll(params: { page: number; pageSize: number }): Promise<{ items: SubscriptionRecord[]; total: number }>;
  /** Creates a new subscription record. The `id` on the input is ignored/assigned by the repository. */
  save(subscription: SubscriptionRecord): Promise<SubscriptionRecord>;
  /**
   * Replaces an existing subscription's mutable fields. Returns the updated
   * subscription, or null when no record exists for `subscription.id`.
   * `paymentReferences` is only written when provided.
   */
  update(subscription: SubscriptionRecord): Promise<SubscriptionRecord | null>;
}
