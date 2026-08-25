import type { DonationSettlementBreakdown } from '@ubuntu-fund/types';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { CampaignBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBalanceRepositoryPort.js';
import type { LedgerRepositoryPort } from '../../domain/ports/outbound/LedgerRepositoryPort.js';
import { logger } from '../../infrastructure/logging/logger.js';

/**
 * Projects posted ledger activity onto the campaign read models.
 *
 * The campaign's `raisedAmount` field is a PROJECTION of the ledger: it is
 * moved here, as part of settling a donation, and nowhere else on the
 * donation-intent rail (no blind increments elsewhere). The per-campaign
 * {@link CampaignBalanceRepositoryPort} read model tracks the beneficiary
 * balance buckets (pending/available/paid-out) and fee accumulators.
 */
export class CampaignLedgerProjector {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly campaignBalanceRepo: CampaignBalanceRepositoryPort,
    private readonly ledgerRepo: LedgerRepositoryPort
  ) {}

  /**
   * Fold a freshly-posted donation journal into the campaign projections:
   * credit the campaign's raised total by the campaign-directed `amount`, and
   * accrue the beneficiary-net + fees onto the balance read model. Called once
   * per settlement, immediately after the journal is posted.
   */
  async projectDonation(
    campaignId: string,
    breakdown: DonationSettlementBreakdown
  ): Promise<void> {
    // raisedAmount is credited through the ledger settlement (this seam) only.
    const credited = await this.campaignRepo.incrementRaised(
      campaignId,
      breakdown.amount,
      breakdown.currency
    );
    if (!credited) {
      // The campaign closed between validation and settlement; the money was
      // still taken, so log rather than lose the projection silently.
      logger.warn(
        { campaignId, amount: breakdown.amount },
        'raised projection skipped: campaign no longer creditable'
      );
    }

    await this.campaignBalanceRepo.applyDonation(campaignId, breakdown.currency, {
      amount: breakdown.amount,
      beneficiaryNet: breakdown.beneficiaryNet,
      platformFee: breakdown.platformFee,
      processorFee: breakdown.processorFee,
      tip: breakdown.tip,
    });
  }

  /**
   * (Re)derive a campaign's raised total purely from posted `campaign`-account
   * debit lines — the authoritative ledger-sourced figure, for reconciliation
   * or verification against the projected `raisedAmount`.
   */
  async deriveRaisedFromLedger(
    campaignId: string,
    currency: string
  ): Promise<number> {
    return this.ledgerRepo.sumCampaignRaised(campaignId, currency);
  }
}
