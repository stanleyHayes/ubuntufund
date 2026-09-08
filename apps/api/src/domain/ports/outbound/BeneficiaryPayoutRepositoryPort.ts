import type { BeneficiaryPayoutEntity } from '../../entities/BeneficiaryPayout.js';
import type { PayoutStatus } from '@ubuntu-fund/types';

export interface BeneficiaryPayoutRepositoryPort {
  create(payout: BeneficiaryPayoutEntity): Promise<BeneficiaryPayoutEntity>;
  findById(id: string): Promise<BeneficiaryPayoutEntity | null>;
  findByProviderRef(providerRef: string): Promise<BeneficiaryPayoutEntity | null>;
  findByCampaign(campaignId: string): Promise<BeneficiaryPayoutEntity[]>;
  /** All beneficiary payouts, newest first (admin console). */
  findAll(): Promise<BeneficiaryPayoutEntity[]>;
  /** Beneficiary payouts in any of the given statuses (admin review queue). */
  findByStatuses(statuses: PayoutStatus[]): Promise<BeneficiaryPayoutEntity[]>;
  findByCampaignAndBeneficiary(
    campaignId: string,
    beneficiaryId: string
  ): Promise<BeneficiaryPayoutEntity[]>;

  /** Payouts stuck in PROCESSING since before `olderThan` (missed webhook). */
  findStuckProcessing(olderThan: Date): Promise<BeneficiaryPayoutEntity[]>;

  /**
   * Flag a payout's terminal balance/ledger effect as applied (G5, idempotent).
   * `expectedStatus` makes it a compare-and-set on status (G7) so a repair cannot
   * flag a payout that has since transitioned.
   */
  markSettlementApplied(id: string, expectedStatus?: PayoutStatus): Promise<void>;

  /**
   * PAID or FAILED payouts whose settlement effect was not recorded (a crash
   * between the state transition and the balance write), older than `olderThan`.
   * Matched by `settlementApplied: false` so legacy payouts (field absent) are
   * never re-applied. REVERSED is excluded (see PayoutRepositoryPort).
   */
  findTerminalUnsettled(olderThan: Date): Promise<BeneficiaryPayoutEntity[]>;

  /**
   * Maker-checker: atomically record the FIRST admin approval (set
   * firstApprovedBy/At while PENDING and not yet first-approved). Null when
   * already first-approved or no longer PENDING.
   */
  recordFirstApproval(
    id: string,
    makerId: string
  ): Promise<BeneficiaryPayoutEntity | null>;

  /** Atomically PENDING → PROCESSING, stamping approver + transfer reference. */
  transitionToProcessing(
    id: string,
    fields: { approvedBy: string; providerRef: string }
  ): Promise<BeneficiaryPayoutEntity | null>;
  attachTransferCode(
    id: string,
    transferCode: string
  ): Promise<BeneficiaryPayoutEntity | null>;
  transitionToPaid(id: string): Promise<BeneficiaryPayoutEntity | null>;
  transitionToFailed(id: string): Promise<BeneficiaryPayoutEntity | null>;
  transitionPaidToReversed(id: string): Promise<BeneficiaryPayoutEntity | null>;
  transitionProcessingToReversed(
    id: string
  ): Promise<BeneficiaryPayoutEntity | null>;
}
