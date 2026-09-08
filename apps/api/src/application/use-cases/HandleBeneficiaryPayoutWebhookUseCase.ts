import type { BeneficiaryPayoutRepositoryPort } from '../../domain/ports/outbound/BeneficiaryPayoutRepositoryPort.js';
import type { CampaignBeneficiaryBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBeneficiaryBalanceRepositoryPort.js';
import type { CampaignBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBalanceRepositoryPort.js';
import type { LedgerRepositoryPort } from '../../domain/ports/outbound/LedgerRepositoryPort.js';
import { JournalEntryEntity } from '../../domain/entities/JournalEntry.js';
import type { BeneficiaryPayoutEntity } from '../../domain/entities/BeneficiaryPayout.js';

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
    await this.applyForwardDisbursement(payout, reference);
    await this.payoutRepo.markSettlementApplied(payout.id, 'PAID');
  }

  async handleFailed(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference);
    if (!payout) return;
    const won = await this.payoutRepo.transitionToFailed(payout.id);
    if (!won) return;
    await this.applyReturn(payout);
    await this.payoutRepo.markSettlementApplied(payout.id, 'FAILED');
  }

  async handleReversed(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference);
    if (!payout) return;

    const fromPaid = await this.payoutRepo.transitionPaidToReversed(payout.id);
    if (fromPaid) {
      await this.applyReversalFromPaid(payout, reference);
      await this.payoutRepo.markSettlementApplied(payout.id, 'REVERSED');
      return;
    }

    const fromProcessing = await this.payoutRepo.transitionProcessingToReversed(payout.id);
    if (fromProcessing) {
      await this.applyReturn(payout);
      await this.payoutRepo.markSettlementApplied(payout.id, 'REVERSED');
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
   *  - REVERSED → replay the reverse effect owed, disambiguated by `reversedFrom`
   *    (G7): 'PROCESSING' → return to both buckets; 'PAID' → reverse both buckets.
   *    A legacy REVERSED payout has no `reversedFrom` and is skipped (the finder
   *    excludes it). The settlement flag is set only if the payout is STILL in the
   *    repaired status, so a stale repair can't clobber a newer owed effect.
   */
  async repairSettlement(payoutId: string): Promise<void> {
    const payout = await this.payoutRepo.findById(payoutId);
    if (!payout) return;
    if (payout.status === 'PAID') {
      await this.applyForwardDisbursement(payout, 'reconcile');
      await this.payoutRepo.markSettlementApplied(payout.id, 'PAID');
    } else if (payout.status === 'FAILED') {
      await this.applyReturn(payout);
      await this.payoutRepo.markSettlementApplied(payout.id, 'FAILED');
    } else if (payout.status === 'REVERSED') {
      if (payout.reversedFrom === 'PROCESSING') {
        await this.applyReturn(payout);
        await this.payoutRepo.markSettlementApplied(payout.id, 'REVERSED');
      } else if (payout.reversedFrom === 'PAID') {
        await this.applyReversalFromPaid(payout, 'reconcile');
        await this.payoutRepo.markSettlementApplied(payout.id, 'REVERSED');
      }
    }
  }

  /**
   * The forward disbursement effect on BOTH buckets + the disbursement journal,
   * keyed by `bpay:{id}:paid`. No settlement flag — callers decide. Idempotent.
   */
  private async applyForwardDisbursement(
    payout: BeneficiaryPayoutEntity,
    reference: string
  ): Promise<void> {
    const key = `bpay:${payout.id}`;
    await this.beneficiaryBalanceRepo.markPaidOut(
      payout.campaignId,
      payout.beneficiaryId,
      payout.currency,
      payout.amount,
      `${key}:paid`
    );
    await this.campaignBalanceRepo.markPaidOut(payout.campaignId, payout.amount, 0, `${key}:paid`);
    await this.ledgerRepo.postEntry(
      JournalEntryEntity.forPayoutDisbursement({
        campaignId: payout.campaignId,
        amount: payout.amount,
        currency: payout.currency,
        memo: `beneficiary payout ${payout.id} settled (${reference})`,
        externalRef: `${key}:paid`,
      })
    );
  }

  /** Return the reservation to BOTH buckets, keyed by `bpay:{id}:returned`. Idempotent. */
  private async applyReturn(payout: BeneficiaryPayoutEntity): Promise<void> {
    const key = `bpay:${payout.id}`;
    await this.beneficiaryBalanceRepo.returnToAvailable(
      payout.campaignId,
      payout.beneficiaryId,
      payout.currency,
      payout.amount,
      `${key}:returned`
    );
    await this.campaignBalanceRepo.returnToAvailable(payout.campaignId, payout.amount, `${key}:returned`);
  }

  /**
   * The PAID→REVERSED effect on BOTH buckets (G7): move paidOut → available on
   * both buckets and post the reversing journal, idempotent per the `:reversed`
   * settleRef / externalRef. Does NOT re-drive the forward (that would
   * double-credit a legacy payout whose forward never recorded a `:paid` ref).
   */
  private async applyReversalFromPaid(
    payout: BeneficiaryPayoutEntity,
    reference: string
  ): Promise<void> {
    const key = `bpay:${payout.id}`;
    await this.beneficiaryBalanceRepo.reverseFromPaidOut(
      payout.campaignId,
      payout.beneficiaryId,
      payout.currency,
      payout.amount,
      `${key}:reversed`
    );
    await this.campaignBalanceRepo.reverseFromPaidOut(payout.campaignId, payout.amount, 0, `${key}:reversed`);
    await this.ledgerRepo.postEntry(
      JournalEntryEntity.forPayoutReversal({
        campaignId: payout.campaignId,
        amount: payout.amount,
        currency: payout.currency,
        memo: `beneficiary payout ${payout.id} reversed (${reference})`,
        externalRef: `${key}:reversed`,
      })
    );
  }
}
