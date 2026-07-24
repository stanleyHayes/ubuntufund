import type { Subscription } from '@ubuntu-fund/types';

export interface SubscriptionRepositoryPort {
  /** A user has at most one subscription record. */
  findByUserId(userId: string): Promise<Subscription | null>;
  findById(id: string): Promise<Subscription | null>;
  /** Creates a new subscription record. The `id` on the input is ignored/assigned by the repository. */
  save(subscription: Subscription): Promise<Subscription>;
  /**
   * Replaces an existing subscription's mutable fields. Returns the updated
   * subscription, or null when no record exists for `subscription.id`.
   */
  update(subscription: Subscription): Promise<Subscription | null>;
}
