import type { CreatorPayoutEntity } from '../../entities/CreatorPayout.js';
import type { PayoutStatus } from '@ubuntu-fund/types';

export interface CreatorPayoutRepositoryPort {
  create(payout: CreatorPayoutEntity): Promise<CreatorPayoutEntity>;
  findById(id: string): Promise<CreatorPayoutEntity | null>;
  findByProviderRef(providerRef: string): Promise<CreatorPayoutEntity | null>;
  findByCreator(creatorUserId: string, limit?: number): Promise<CreatorPayoutEntity[]>;

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
  /** PAID/FAILED/(REVERSED w/ reversedFrom) withdrawals whose effect was not recorded. */
  findTerminalUnsettled(olderThan: Date): Promise<CreatorPayoutEntity[]>;
}
