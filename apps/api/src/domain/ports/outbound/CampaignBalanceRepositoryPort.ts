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

  /**
   * Reverse a refunded contribution's split from the buckets (spec §14).
   * Guarded on `pendingBalance >= beneficiaryNet` so a refund can only claw back
   * funds that have NOT been disbursed; returns null when pending is short (the
   * funds were already paid out — needs a manual clawback). Reduces totalRaised,
   * pendingBalance, fees and tips.
   */
  applyRefund(
    campaignId: string,
    currency: string,
    delta: CampaignBalanceDelta
  ): Promise<CampaignBalance | null>;

  // ── Payout lifecycle (pending → available → in-transit → paidOut) ─────────

  /**
   * Clear settled funds from `pendingBalance` to `availableBalance` (making
   * them withdrawable). Atomic and guarded: only fires while `pendingBalance >=
   * amount`. Returns the updated balance, or null when there isn't enough
   * pending to clear.
   */
  clearPendingToAvailable(
    campaignId: string,
    amount: number
  ): Promise<CampaignBalance | null>;

  /**
   * Reserve funds for an approved payout: `availableBalance -= amount` (the
   * money is now in transit). Atomic and guarded on `availableBalance >=
   * amount`. Returns the updated balance, or null when available is short.
   */
  reserveForPayout(
    campaignId: string,
    amount: number
  ): Promise<CampaignBalance | null>;

  /**
   * Confirm a paid-out transfer: the reserved gross (net + fee) that left
   * `availableBalance` splits into `paidOutBalance += netAmount` (disbursed to the
   * beneficiary) and `payoutFees += fee` (Ujimora's retained service fee).
   */
  markPaidOut(
    campaignId: string,
    netAmount: number,
    fee?: number
  ): Promise<CampaignBalance | null>;

  /**
   * Return reserved in-transit funds to `availableBalance` after a failed
   * transfer (no paid-out amount was ever recorded).
   */
  returnToAvailable(
    campaignId: string,
    amount: number
  ): Promise<CampaignBalance | null>;

  /**
   * Reverse a previously paid-out transfer: the disbursed `netAmount` and retained
   * `fee` both return to `availableBalance` (money came back to the platform).
   */
  reverseFromPaidOut(
    campaignId: string,
    netAmount: number,
    fee?: number
  ): Promise<CampaignBalance | null>;
}
