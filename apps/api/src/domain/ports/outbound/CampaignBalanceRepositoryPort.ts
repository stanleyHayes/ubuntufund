import type { CampaignBalance } from '@ubuntu-fund/types';

/** The per-donation deltas applied to a campaign's balance read model. */
export interface CampaignBalanceDelta {
  /** Campaign-directed donation amount (adds to totalRaised). */
  amount: number;
  /** Beneficiary-net settled (adds to pendingBalance). */
  beneficiaryNet: number;
  platformFee: number;
  processorFee: number;
  tip: number;
}

export interface CampaignBalanceRepositoryPort {
  findByCampaignId(campaignId: string): Promise<CampaignBalance | null>;

  /**
   * Atomically fold a settled donation into the campaign's balance buckets
   * (upserting the read model on first activity). Beneficiary-net accrues to
   * `pendingBalance` until a payout/clearing phase moves it onward.
   */
  applyDonation(
    campaignId: string,
    currency: string,
    delta: CampaignBalanceDelta
  ): Promise<CampaignBalance>;
}
