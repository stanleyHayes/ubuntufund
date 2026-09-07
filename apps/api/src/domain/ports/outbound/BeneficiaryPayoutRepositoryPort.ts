import type { BeneficiaryPayoutEntity } from '../../entities/BeneficiaryPayout.js';

export interface BeneficiaryPayoutRepositoryPort {
  create(payout: BeneficiaryPayoutEntity): Promise<BeneficiaryPayoutEntity>;
  findById(id: string): Promise<BeneficiaryPayoutEntity | null>;
  findByProviderRef(providerRef: string): Promise<BeneficiaryPayoutEntity | null>;
  findByCampaign(campaignId: string): Promise<BeneficiaryPayoutEntity[]>;
  findByCampaignAndBeneficiary(
    campaignId: string,
    beneficiaryId: string
  ): Promise<BeneficiaryPayoutEntity[]>;

  /** Payouts stuck in PROCESSING since before `olderThan` (missed webhook). */
  findStuckProcessing(olderThan: Date): Promise<BeneficiaryPayoutEntity[]>;

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
