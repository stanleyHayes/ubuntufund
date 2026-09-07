import type { BeneficiaryPayoutRepositoryPort } from '../../domain/ports/outbound/BeneficiaryPayoutRepositoryPort.js';
import type { CampaignBeneficiaryBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBeneficiaryBalanceRepositoryPort.js';
import type { CampaignBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBalanceRepositoryPort.js';
import type { LedgerRepositoryPort } from '../../domain/ports/outbound/LedgerRepositoryPort.js';
import { JournalEntryEntity } from '../../domain/entities/JournalEntry.js';

/**
 * Applies Paystack transfer webhooks to a beneficiary payout (spec §17). Each
 * handler correlates by the unique `bpay-` reference and is idempotent: the
 * balance/ledger effect runs only for the caller that wins the atomic state
 * transition. Every move is applied to the per-beneficiary bucket (authoritative)
 * and mirrored into the campaign aggregate; the campaign disbursement journal
 * keeps the immutable ledger consistent.
 */
export class HandleBeneficiaryPayoutWebhookUseCase {
  constructor(
    private readonly payoutRepo: BeneficiaryPayoutRepositoryPort,
    private readonly beneficiaryBalanceRepo: CampaignBeneficiaryBalanceRepositoryPort,
    private readonly campaignBalanceRepo: CampaignBalanceRepositoryPort,
    private readonly ledgerRepo: LedgerRepositoryPort
  ) {}

  async handleSuccess(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference);
    if (!payout) return;
    const won = await this.payoutRepo.transitionToPaid(payout.id);
    if (!won) return; // idempotent

    await this.beneficiaryBalanceRepo.markPaidOut(
      payout.campaignId,
      payout.beneficiaryId,
      payout.currency,
      payout.amount
    );
    await this.campaignBalanceRepo.markPaidOut(payout.campaignId, payout.amount, 0);

    const entry = JournalEntryEntity.forPayoutDisbursement({
      campaignId: payout.campaignId,
      amount: payout.amount,
      currency: payout.currency,
      memo: `beneficiary payout ${payout.id} settled (${reference})`,
    });
    await this.ledgerRepo.postEntry(entry);
  }

  async handleFailed(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference);
    if (!payout) return;
    const won = await this.payoutRepo.transitionToFailed(payout.id);
    if (!won) return;

    await this.beneficiaryBalanceRepo.returnToAvailable(
      payout.campaignId,
      payout.beneficiaryId,
      payout.currency,
      payout.amount
    );
    await this.campaignBalanceRepo.returnToAvailable(payout.campaignId, payout.amount);
  }

  async handleReversed(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference);
    if (!payout) return;

    const fromPaid = await this.payoutRepo.transitionPaidToReversed(payout.id);
    if (fromPaid) {
      await this.beneficiaryBalanceRepo.reverseFromPaidOut(
        payout.campaignId,
        payout.beneficiaryId,
        payout.currency,
        payout.amount
      );
      await this.campaignBalanceRepo.reverseFromPaidOut(payout.campaignId, payout.amount, 0);
      const entry = JournalEntryEntity.forPayoutReversal({
        campaignId: payout.campaignId,
        amount: payout.amount,
        currency: payout.currency,
        memo: `beneficiary payout ${payout.id} reversed (${reference})`,
      });
      await this.ledgerRepo.postEntry(entry);
      return;
    }

    const fromProcessing = await this.payoutRepo.transitionProcessingToReversed(payout.id);
    if (fromProcessing) {
      await this.beneficiaryBalanceRepo.returnToAvailable(
        payout.campaignId,
        payout.beneficiaryId,
        payout.currency,
        payout.amount
      );
      await this.campaignBalanceRepo.returnToAvailable(payout.campaignId, payout.amount);
    }
  }
}
