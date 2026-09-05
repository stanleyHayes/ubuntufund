import type { PayoutEntity } from '../../entities/Payout.js';

export interface PayoutRepositoryPort {
  create(payout: PayoutEntity): Promise<PayoutEntity>;
  findById(id: string): Promise<PayoutEntity | null>;
  findByCampaignId(campaignId: string): Promise<PayoutEntity[]>;
  /** Correlate a provider transfer webhook back to its payout. */
  findByProviderRef(providerRef: string): Promise<PayoutEntity | null>;
  /** All payouts, newest first (admin console). */
  findAll(): Promise<PayoutEntity[]>;

  /**
   * Atomically move PENDING → PROCESSING, stamping the approver, our unique
   * transfer reference, and (optionally) the provider transfer code. Returns the
   * updated payout, or null when it was no longer PENDING (another approval won).
   */
  transitionToProcessing(
    id: string,
    fields: { approvedBy: string; providerRef: string; transferCode?: string }
  ): Promise<PayoutEntity | null>;

  /** Attach the provider transfer code once the transfer is initiated. */
  attachTransferCode(id: string, transferCode: string): Promise<PayoutEntity | null>;

  /** Atomically move PROCESSING → PAID. Null when not PROCESSING (idempotent). */
  transitionToPaid(id: string): Promise<PayoutEntity | null>;

  /** Atomically move PROCESSING → FAILED. Null when not PROCESSING. */
  transitionToFailed(id: string): Promise<PayoutEntity | null>;

  /** Atomically move PAID → REVERSED. Null when not PAID. */
  transitionPaidToReversed(id: string): Promise<PayoutEntity | null>;

  /** Atomically move PROCESSING → REVERSED. Null when not PROCESSING. */
  transitionProcessingToReversed(id: string): Promise<PayoutEntity | null>;
}
