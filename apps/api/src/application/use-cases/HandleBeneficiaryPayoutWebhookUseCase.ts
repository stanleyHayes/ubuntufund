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

    const key = `bpay:${payout.id}`;
    await this.beneficiaryBalanceRepo.markPaidOut(
      payout.campaignId,
      payout.beneficiaryId,
      payout.currency,
      payout.amount,
      `${key}:paid`
    );
    await this.campaignBalanceRepo.markPaidOut(payout.campaignId, payout.amount, 0, `${key}:paid`);

    const entry = JournalEntryEntity.forPayoutDisbursement({
      campaignId: payout.campaignId,
      amount: payout.amount,
      currency: payout.currency,
      memo: `beneficiary payout ${payout.id} settled (${reference})`,
      externalRef: `${key}:paid`,
    });
    await this.ledgerRepo.postEntry(entry);
    await this.payoutRepo.markSettlementApplied(payout.id);
  }

  async handleFailed(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference);
    if (!payout) return;
    const won = await this.payoutRepo.transitionToFailed(payout.id);
    if (!won) return;

    const key = `bpay:${payout.id}`;
    await this.beneficiaryBalanceRepo.returnToAvailable(
      payout.campaignId,
      payout.beneficiaryId,
      payout.currency,
      payout.amount,
      `${key}:returned`
    );
    await this.campaignBalanceRepo.returnToAvailable(payout.campaignId, payout.amount, `${key}:returned`);
    await this.payoutRepo.markSettlementApplied(payout.id);
  }

  async handleReversed(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference);
    if (!payout) return;

    const key = `bpay:${payout.id}`;
    const fromPaid = await this.payoutRepo.transitionPaidToReversed(payout.id);
    if (fromPaid) {
      await this.beneficiaryBalanceRepo.reverseFromPaidOut(
        payout.campaignId,
        payout.beneficiaryId,
        payout.currency,
        payout.amount,
        `${key}:reversed`
      );
      await this.campaignBalanceRepo.reverseFromPaidOut(payout.campaignId, payout.amount, 0, `${key}:reversed`);
      const entry = JournalEntryEntity.forPayoutReversal({
        campaignId: payout.campaignId,
        amount: payout.amount,
        currency: payout.currency,
        memo: `beneficiary payout ${payout.id} reversed (${reference})`,
        externalRef: `${key}:reversed`,
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
        payout.amount,
        `${key}:returned`
      );
      await this.campaignBalanceRepo.returnToAvailable(payout.campaignId, payout.amount, `${key}:returned`);
    }
  }

  /**
   * Reconciliation repair (G5): re-apply the terminal settlement effect for a
   * beneficiary payout whose balance/ledger write did not complete (a crash
   * between the state transition and the effect). Every move is re-driven on BOTH
   * the beneficiary bucket and the campaign mirror with the same settleRef, so a
   * crash that updated only one bucket is reconverged; each write is idempotent,
   * so a fully-applied effect is a no-op.
   *
   *  - PAID   → re-apply the disbursement to both buckets + the journal.
   *  - FAILED → re-return the reservation to both buckets.
   *
   * REVERSED is not repaired here (see {@link HandlePayoutWebhookUseCase.repairSettlement}).
   */
  async repairSettlement(payoutId: string): Promise<void> {
    const payout = await this.payoutRepo.findById(payoutId);
    if (!payout) return;
    const key = `bpay:${payout.id}`;
    if (payout.status === 'PAID') {
      await this.beneficiaryBalanceRepo.markPaidOut(
        payout.campaignId,
        payout.beneficiaryId,
        payout.currency,
        payout.amount,
        `${key}:paid`
      );
      await this.campaignBalanceRepo.markPaidOut(payout.campaignId, payout.amount, 0, `${key}:paid`);
      const entry = JournalEntryEntity.forPayoutDisbursement({
        campaignId: payout.campaignId,
        amount: payout.amount,
        currency: payout.currency,
        memo: `beneficiary payout ${payout.id} settled (reconcile)`,
        externalRef: `${key}:paid`,
      });
      await this.ledgerRepo.postEntry(entry);
      await this.payoutRepo.markSettlementApplied(payout.id);
    } else if (payout.status === 'FAILED') {
      await this.beneficiaryBalanceRepo.returnToAvailable(
        payout.campaignId,
        payout.beneficiaryId,
        payout.currency,
        payout.amount,
        `${key}:returned`
      );
      await this.campaignBalanceRepo.returnToAvailable(payout.campaignId, payout.amount, `${key}:returned`);
      await this.payoutRepo.markSettlementApplied(payout.id);
    }
  }
}
