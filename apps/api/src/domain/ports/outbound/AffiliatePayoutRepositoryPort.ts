import type { AffiliatePayoutEntity } from '../../entities/AffiliatePayout.js';
import type { PayoutStatus } from '@ubuntu-fund/types';

export interface AffiliatePayoutRepositoryPort {
  create(payout: AffiliatePayoutEntity): Promise<AffiliatePayoutEntity>;
  findById(id: string): Promise<AffiliatePayoutEntity | null>;
  findByAffiliateId(affiliateId: string): Promise<AffiliatePayoutEntity[]>;
  /** Correlate a provider transfer webhook back to its payout. */
  findByProviderRef(providerRef: string): Promise<AffiliatePayoutEntity | null>;
  /** All affiliate payouts, newest first (admin console). */
  findAll(): Promise<AffiliatePayoutEntity[]>;

  /** Payouts stuck in PROCESSING since before `olderThan` (missed webhook). */
  findStuckProcessing(olderThan: Date): Promise<AffiliatePayoutEntity[]>;

  /** Flag a payout's terminal balance effect as applied (G5, idempotent). */
  markSettlementApplied(id: string, expectedStatus?: PayoutStatus): Promise<void>;

  /**
   * PAID or FAILED payouts whose settlement effect was not recorded (a crash
   * between the state transition and the balance write), older than `olderThan`.
   * Matched by `settlementApplied: false` so legacy payouts (field absent) are
   * never re-applied. REVERSED is excluded (see PayoutRepositoryPort).
   */
  findTerminalUnsettled(olderThan: Date): Promise<AffiliatePayoutEntity[]>;

  /**
   * Atomically move PENDING → PROCESSING, stamping the approver, our unique
   * transfer reference, and (optionally) the provider transfer code. Returns the
   * updated payout, or null when it was no longer PENDING (another approval won).
   */
  transitionToProcessing(
    id: string,
    fields: { approvedBy: string; providerRef: string; transferCode?: string }
  ): Promise<AffiliatePayoutEntity | null>;

  /** Attach the provider transfer code once the transfer is initiated. */
  attachTransferCode(
    id: string,
    transferCode: string
  ): Promise<AffiliatePayoutEntity | null>;

  /** Atomically move PROCESSING → PAID. Null when not PROCESSING (idempotent). */
  transitionToPaid(id: string): Promise<AffiliatePayoutEntity | null>;

  /** Atomically move PROCESSING → FAILED. Null when not PROCESSING. */
  transitionToFailed(id: string): Promise<AffiliatePayoutEntity | null>;

  /** Atomically move PAID → REVERSED. Null when not PAID. */
  transitionPaidToReversed(id: string): Promise<AffiliatePayoutEntity | null>;

  /** Atomically move PROCESSING → REVERSED. Null when not PROCESSING. */
  transitionProcessingToReversed(id: string): Promise<AffiliatePayoutEntity | null>;
}
