import type { CreatorPayoutEntity } from '../../entities/CreatorPayout.js';
import type { PayoutStatus } from '@ubuntu-fund/types';

export interface CreatorPayoutRepositoryPort {
  create(payout: CreatorPayoutEntity): Promise<CreatorPayoutEntity>;
  findById(id: string): Promise<CreatorPayoutEntity | null>;
  findByProviderRef(providerRef: string): Promise<CreatorPayoutEntity | null>;
  findByRequestKey(requestKey: string): Promise<CreatorPayoutEntity | null>;
  findByCreator(creatorUserId: string, limit?: number): Promise<CreatorPayoutEntity[]>;
  /** Withdrawals escalated to NEEDS_REVIEW (oldest first), for the staff queue. */
  findEscalated?(): Promise<CreatorPayoutEntity[]>;

  /** Attach the provider transfer + recipient details and move PENDING → PROCESSING. */
  transitionToProcessing(
    id: string,
    fields: { providerRef: string; transferCode?: string; recipientCode?: string }
  ): Promise<CreatorPayoutEntity | null>;

  /** Best-effort: record the provider transfer/recipient codes on an in-flight withdrawal. */
  attachTransferDetails(
    id: string,
    fields: { transferCode?: string; recipientCode?: string }
  ): Promise<void>;

  transitionToPaid(id: string): Promise<CreatorPayoutEntity | null>;
  transitionToFailed(id: string): Promise<CreatorPayoutEntity | null>;
  transitionPaidToReversed(id: string): Promise<CreatorPayoutEntity | null>;
  transitionProcessingToReversed(id: string): Promise<CreatorPayoutEntity | null>;

  /** G7 compare-and-set settlement flag. */
  markSettlementApplied(id: string, expectedStatus?: PayoutStatus): Promise<void>;
  /** Stuck-in-PROCESSING withdrawals (missed webhook), older than `olderThan`. */
  findStuckProcessing(olderThan: Date): Promise<CreatorPayoutEntity[]>;

  /**
   * Stuck single-transfer handling: move PROCESSING → NEEDS_REVIEW (the
   * provider could not confirm the transfer for a full dwell window), and back
   * NEEDS_REVIEW → PROCESSING only so an admin-triggered resolution can drive
   * the rail's own idempotent settlement handler. Each is a guarded, atomic
   * transition that reports whether this caller won it.
   */
  escalateProcessing?(id: string): Promise<boolean>;
  reopenForSettlement?(id: string): Promise<boolean>;
  /** PAID/FAILED/(REVERSED w/ reversedFrom) withdrawals whose effect was not recorded. */
  findTerminalUnsettled(olderThan: Date): Promise<CreatorPayoutEntity[]>;
}
