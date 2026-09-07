import type { BeneficiaryRecipient } from '@ubuntu-fund/types';

export interface BeneficiaryRecipientRepositoryPort {
  /** Create or replace a beneficiary's payout destination (resets KYC on change). */
  upsert(recipient: BeneficiaryRecipient): Promise<BeneficiaryRecipient>;
  findByCampaignAndBeneficiary(
    campaignId: string,
    beneficiaryId: string
  ): Promise<BeneficiaryRecipient | null>;
  findById(id: string): Promise<BeneficiaryRecipient | null>;
  /** Admin marks a beneficiary KYC-verified; returns the updated recipient. */
  setKycVerified(
    campaignId: string,
    beneficiaryId: string,
    verifiedBy: string
  ): Promise<BeneficiaryRecipient | null>;
}
