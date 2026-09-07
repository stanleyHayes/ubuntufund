import type { DonationIntentStatus } from '@ubuntu-fund/types';
import type { DonationIntentEntity } from '../../entities/DonationIntent.js';

export interface DonationIntentRepositoryPort {
  create(intent: DonationIntentEntity): Promise<DonationIntentEntity>;
  findById(id: string): Promise<DonationIntentEntity | null>;
  /** Resolve an intent by its idempotency key (the dedupe seam). */
  findByIdempotencyKey(key: string): Promise<DonationIntentEntity | null>;

  /**
   * Resolve an intent by its provider reference (the Paystack webhook seam —
   * settlement correlates the signed event back to its intent by this ref).
   */
  findByProviderRef(providerRef: string): Promise<DonationIntentEntity | null>;

  /**
   * Atomically move CREATED|PENDING → SUCCEEDED, setting `providerRef`. Returns
   * the updated intent, or null when the intent is not in a transitionable
   * state (already terminal). This is the single exactly-once settlement gate.
   */
  transitionToSucceeded(
    id: string,
    providerRef?: string
  ): Promise<DonationIntentEntity | null>;

  /** Set a non-terminal→terminal/PENDING status (FAILED, EXPIRED, PENDING). */
  updateStatus(
    id: string,
    status: DonationIntentStatus,
    providerRef?: string
  ): Promise<DonationIntentEntity | null>;

  /**
   * Atomically mark a still-PENDING intent FAILED. Returns the updated intent,
   * or null when it is no longer PENDING (e.g. a webhook settled it to SUCCEEDED
   * first). Used by reconciliation so a stale sweep can never overwrite a
   * concurrently-settled intent back to FAILED.
   */
  markFailedIfPending(
    id: string,
    providerRef?: string
  ): Promise<DonationIntentEntity | null>;

  /**
   * Hosted-rail intents still PENDING past `olderThan` (with a providerRef to
   * correlate). The reconciliation job re-verifies these against the provider to
   * repair settlements missed by a dropped webhook (spec §13).
   */
  findStalePending(olderThan: Date, limit: number): Promise<DonationIntentEntity[]>;

  /**
   * Admin search over contributions (spec §15) by any combination of provider
   * reference, campaign, donor email, status, provider and a created-at window.
   * Newest first, capped by `limit`.
   */
  searchForAdmin(filters: {
    providerRef?: string;
    campaignId?: string;
    donorEmail?: string;
    status?: DonationIntentStatus;
    provider?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<DonationIntentEntity[]>;

  /**
   * Atomically reserve `amountMinor` of refund against a refundable intent
   * (spec §14) BEFORE any provider call, so a retried refund request can never
   * double-refund. The reservation succeeds only while the intent is SUCCEEDED
   * or PARTIALLY_REFUNDED, the cumulative refunded total stays within
   * `maxMinor` (the original campaign amount), and — when an `idempotencyKey` is
   * supplied — that key has not already been applied. Returns the updated intent
   * (with `refundedAmountMinor` incremented), or null when the claim is rejected.
   */
  claimRefund(
    id: string,
    amountMinor: number,
    maxMinor: number,
    idempotencyKey?: string
  ): Promise<DonationIntentEntity | null>;

  /**
   * Release a refund reservation made by {@link claimRefund} when the downstream
   * provider call fails, so the amount becomes refundable again. Idempotent.
   */
  releaseRefundClaim(
    id: string,
    amountMinor: number,
    idempotencyKey?: string
  ): Promise<void>;

  /**
   * Persist the verified settlement money split in integer minor units (spec §8)
   * once a contribution settles. Additive/best-effort — it records the
   * settlement/fee/FX figures and never gates crediting.
   */
  recordSettlementFinancials(
    id: string,
    fields: {
      settlementAmountMinor?: number;
      settlementCurrency?: string;
      fxRate?: number;
      fxSource?: string;
      providerFeeMinor?: number;
      platformFeeMinor?: number;
      netCampaignAmountMinor?: number;
    }
  ): Promise<void>;
}
