import type { PayoutEntity } from '../../entities/Payout.js';
import type { PayoutLeg, PayoutLegStatus } from '@ubuntu-fund/types';

export interface PayoutRepositoryPort {
  create(payout: PayoutEntity): Promise<PayoutEntity>;
  findById(id: string): Promise<PayoutEntity | null>;
  findByCampaignId(campaignId: string): Promise<PayoutEntity[]>;
  /** Correlate a provider transfer webhook back to its (single-transfer) payout. */
  findByProviderRef(providerRef: string): Promise<PayoutEntity | null>;
  /** Correlate a transfer webhook to the batched payout owning a leg reference. */
  findByLegReference(reference: string): Promise<PayoutEntity | null>;
  /** All payouts, newest first (admin console). */
  findAll(): Promise<PayoutEntity[]>;

  /**
   * Maker-checker (spec §16): atomically record the FIRST admin approval of a
   * high-value payout — set `firstApprovedBy`/`firstApprovedAt` while it is still
   * PENDING and not yet first-approved. Returns the updated payout, or null when
   * it was already first-approved or no longer PENDING.
   */
  recordFirstApproval(
    id: string,
    makerId: string
  ): Promise<PayoutEntity | null>;

  /**
   * Atomically move PENDING → PROCESSING, stamping the approver, our unique
   * transfer reference, and (optionally) the provider transfer code. Returns the
   * updated payout, or null when it was no longer PENDING (another approval won).
   */
  transitionToProcessing(
    id: string,
    fields: { approvedBy: string; providerRef: string; transferCode?: string }
  ): Promise<PayoutEntity | null>;

  /**
   * Atomically move PENDING → PROCESSING for a BATCHED payout, stamping the
   * approver, the batch reference, and the transfer legs (all `queued`). Returns
   * the updated payout, or null when it was no longer PENDING.
   */
  transitionToProcessingBatched(
    id: string,
    fields: { approvedBy: string; providerRef: string; legs: PayoutLeg[] }
  ): Promise<PayoutEntity | null>;

  /**
   * Atomically move one leg (matched by `reference`) from any of `from` to `to`,
   * optionally stamping its transfer code. Returns the updated payout when this
   * caller won the leg transition, or null (leg absent, or not in a `from` state
   * — the guard that makes per-leg settlement exactly-once/idempotent).
   */
  setLegStatus(
    id: string,
    reference: string,
    from: PayoutLegStatus[],
    to: PayoutLegStatus,
    extra?: { transferCode?: string }
  ): Promise<PayoutEntity | null>;

  /**
   * Atomically move a batched payout PROCESSING → PAID, but ONLY when every leg
   * is `success`. Null when not PROCESSING or a leg has not succeeded.
   */
  transitionBatchedToPaid(id: string): Promise<PayoutEntity | null>;

  /**
   * Atomically flag a batched payout for manual reconciliation: move
   * PROCESSING or PAID → NEEDS_REVIEW. Null when in neither state (idempotent).
   */
  flagNeedsReview(id: string): Promise<PayoutEntity | null>;

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
