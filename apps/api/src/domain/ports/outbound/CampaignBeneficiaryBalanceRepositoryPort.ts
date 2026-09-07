import type { CampaignBeneficiaryBalance } from '@ubuntu-fund/types';

/**
 * Per-`(campaign, beneficiary)` balance read model (spec §17 / ADR-3). Mirrors
 * the campaign-level buckets so each beneficiary's cleared share moves through
 * its own pending → available → paid-out lifecycle. Guarded decrements return a
 * boolean so a short bucket never goes negative.
 */
export interface CampaignBeneficiaryBalanceRepositoryPort {
  /** Accrue a settled donation's share onto a beneficiary's pending bucket. */
  accruePending(
    campaignId: string,
    beneficiaryId: string,
    currency: string,
    amount: number
  ): Promise<CampaignBeneficiaryBalance>;

  /** Reverse a refunded share from pending; false when pending is short. */
  reversePending(
    campaignId: string,
    beneficiaryId: string,
    currency: string,
    amount: number
  ): Promise<boolean>;

  /** Clear pending → available at payout-request time; false when pending short. */
  clearPendingToAvailable(
    campaignId: string,
    beneficiaryId: string,
    currency: string,
    amount: number
  ): Promise<boolean>;

  /** Reserve available → in-transit on payout approval; false when available short. */
  reserveForPayout(
    campaignId: string,
    beneficiaryId: string,
    currency: string,
    amount: number
  ): Promise<boolean>;

  /** Return an in-transit reservation to available (payout failed). */
  returnToAvailable(
    campaignId: string,
    beneficiaryId: string,
    currency: string,
    amount: number
  ): Promise<void>;

  /** Move in-transit → paid-out on a settled payout. */
  markPaidOut(
    campaignId: string,
    beneficiaryId: string,
    currency: string,
    amount: number
  ): Promise<void>;

  /** Reverse paid-out → available on a reversed payout. */
  reverseFromPaidOut(
    campaignId: string,
    beneficiaryId: string,
    currency: string,
    amount: number
  ): Promise<void>;

  findOne(
    campaignId: string,
    beneficiaryId: string,
    currency: string
  ): Promise<CampaignBeneficiaryBalance | null>;

  listByCampaign(campaignId: string): Promise<CampaignBeneficiaryBalance[]>;
}
