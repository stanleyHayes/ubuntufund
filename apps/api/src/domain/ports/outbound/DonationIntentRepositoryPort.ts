import type { DonationIntentStatus } from '@ubuntu-fund/types';
import type { DonationIntentEntity } from '../../entities/DonationIntent.js';

export interface DonationIntentRepositoryPort {
  create(intent: DonationIntentEntity): Promise<DonationIntentEntity>;
  findById(id: string): Promise<DonationIntentEntity | null>;
  /** Resolve an intent by its idempotency key (the dedupe seam). */
  findByIdempotencyKey(key: string): Promise<DonationIntentEntity | null>;

  /**
   * Resolve an intent by its provider reference (the Paystack webhook seam —
   * settlement correlates the signed event back to its intent by this ref).
   */
  findByProviderRef(providerRef: string): Promise<DonationIntentEntity | null>;

  /**
   * Atomically move CREATED|PENDING → SUCCEEDED, setting `providerRef`. Returns
   * the updated intent, or null when the intent is not in a transitionable
   * state (already terminal). This is the single exactly-once settlement gate.
   */
  transitionToSucceeded(
    id: string,
    providerRef?: string
  ): Promise<DonationIntentEntity | null>;

  /** Set a non-terminal→terminal/PENDING status (FAILED, EXPIRED, PENDING). */
  updateStatus(
    id: string,
    status: DonationIntentStatus,
    providerRef?: string
  ): Promise<DonationIntentEntity | null>;
}
