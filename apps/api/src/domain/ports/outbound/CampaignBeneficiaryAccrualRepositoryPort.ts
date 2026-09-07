import type { CampaignBeneficiaryAccrual } from '@ubuntu-fund/types';

/**
 * The immutable per-donation accrual record (spec §17 / ADR-3): how one settled
 * donation's beneficiary-net was split. Keyed by donation intent so it is
 * written exactly once and a refund reverses the exact amounts credited.
 */
export interface CampaignBeneficiaryAccrualRepositoryPort {
  /**
   * Record a donation's split. Returns true when newly recorded, false when an
   * accrual already exists for this donation intent (idempotent — the caller
   * must skip the balance credits in that case).
   */
  record(accrual: CampaignBeneficiaryAccrual): Promise<boolean>;

  findByDonationIntent(
    donationIntentId: string
  ): Promise<CampaignBeneficiaryAccrual | null>;

  /**
   * Atomically add `minorReversed` to the accrual's cumulative reversed amount,
   * flagging it fully `reversed` once the cumulative reaches `totalMinor`. So
   * successive partial refunds can never reverse more than was accrued.
   */
  recordReversal(
    donationIntentId: string,
    minorReversed: number,
    totalMinor: number
  ): Promise<void>;

  /** Accruals touching a beneficiary (for their statement), newest first. */
  listByBeneficiary(
    campaignId: string,
    beneficiaryId: string
  ): Promise<CampaignBeneficiaryAccrual[]>;
}
