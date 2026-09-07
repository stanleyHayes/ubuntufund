import type { PayoutRepositoryPort } from '../../domain/ports/outbound/PayoutRepositoryPort.js';
import type { CampaignBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBalanceRepositoryPort.js';
import type { LedgerRepositoryPort } from '../../domain/ports/outbound/LedgerRepositoryPort.js';
import type { PayoutEntity } from '../../domain/entities/Payout.js';
import { JournalEntryEntity } from '../../domain/entities/JournalEntry.js';

/**
 * Applies Paystack transfer webhooks to the payout + ledger read models. All
 * handlers correlate by the unique transfer reference and are idempotent: the
 * balance/ledger effect runs only for the caller that wins the atomic state
 * transition, so a duplicate webhook is a harmless no-op.
 *
 * A reference resolves one of two ways:
 *  - a single-transfer payout's `providerRef` → the payout-level handlers below;
 *  - one leg of a batched payout → the per-leg handlers, which settle that leg
 *    and reconcile the batch (PAID when all legs succeed, else NEEDS_REVIEW).
 *
 * Single-transfer semantics:
 *  - transfer.success  → PROCESSING → PAID; move in-transit → paidOut; post the
 *                        immutable disbursement journal (debit beneficiary,
 *                        credit payout).
 *  - transfer.failed   → PROCESSING → FAILED; return the reserved in-transit
 *                        funds to availableBalance (no journal).
 *  - transfer.reversed → PAID → REVERSED (reversing journal + paidOut → available)
 *                        or PROCESSING → REVERSED (return the reservation).
 */
export class HandlePayoutWebhookUseCase {
  constructor(
    private readonly payoutRepo: PayoutRepositoryPort,
    private readonly campaignBalanceRepo: CampaignBalanceRepositoryPort,
    private readonly ledgerRepo: LedgerRepositoryPort
  ) {}

  async handleSuccess(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference);
    if (payout && !payout.isBatched) {
      const won = await this.payoutRepo.transitionToPaid(payout.id);
      if (!won) return; // idempotent: already PAID or not PROCESSING

      // Split the gross into the beneficiary's net + Ujimora's retained payout fee.
      await this.campaignBalanceRepo.markPaidOut(
        payout.campaignId,
        payout.netAmount,
        payout.fee
      );

      const entry = JournalEntryEntity.forPayoutDisbursement({
        campaignId: payout.campaignId,
        amount: payout.amount,
        currency: payout.currency,
        memo: `payout ${payout.id} settled (${reference})`,
      });
      await this.ledgerRepo.postEntry(entry);
      return;
    }

    const batched = await this.payoutRepo.findByLegReference(reference);
    if (batched) await this.onLegSuccess(batched, reference);
  }

  async handleFailed(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference);
    if (payout && !payout.isBatched) {
      const won = await this.payoutRepo.transitionToFailed(payout.id);
      if (!won) return; // idempotent

      // Nothing was disbursed — return the reservation to availableBalance.
      await this.campaignBalanceRepo.returnToAvailable(
        payout.campaignId,
        payout.amount
      );
      return;
    }

    const batched = await this.payoutRepo.findByLegReference(reference);
    if (batched) await this.onLegFailed(batched, reference);
  }

  async handleReversed(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference);
    if (payout && !payout.isBatched) {
      // A reversal of an already-settled (PAID) transfer: money came back —
      // move paidOut → available and post the reversing journal.
      const fromPaid = await this.payoutRepo.transitionPaidToReversed(payout.id);
      if (fromPaid) {
        await this.campaignBalanceRepo.reverseFromPaidOut(
          payout.campaignId,
          payout.netAmount,
          payout.fee
        );
        const entry = JournalEntryEntity.forPayoutReversal({
          campaignId: payout.campaignId,
          amount: payout.amount,
          currency: payout.currency,
          memo: `payout ${payout.id} reversed (${reference})`,
        });
        await this.ledgerRepo.postEntry(entry);
        return;
      }

      // A reversal seen before we observed success: treat like a failure —
      // return the reservation, no journal was ever posted.
      const fromProcessing =
        await this.payoutRepo.transitionProcessingToReversed(payout.id);
      if (fromProcessing) {
        await this.campaignBalanceRepo.returnToAvailable(
          payout.campaignId,
          payout.amount
        );
      }
      // Otherwise not in a reversible state — idempotent no-op.
      return;
    }

    const batched = await this.payoutRepo.findByLegReference(reference);
    if (batched) await this.onLegReversed(batched, reference);
  }

  // ---- Batched (multi-leg) settlement -------------------------------------

  /**
   * A batched leg's transfer succeeded. Move exactly that leg's amount into
   * paidOut and journal it (a large standard payout carries no fee, so each leg
   * is pure net), then reconcile the batch.
   */
  private async onLegSuccess(
    payout: PayoutEntity,
    reference: string
  ): Promise<void> {
    const leg = payout.legs?.find((l) => l.reference === reference);
    if (!leg) return;
    const won = await this.payoutRepo.setLegStatus(
      payout.id,
      reference,
      ['queued', 'submitted'],
      'success'
    );
    if (!won) return; // idempotent

    await this.campaignBalanceRepo.markPaidOut(
      payout.campaignId,
      leg.amount,
      0
    );
    const entry = JournalEntryEntity.forPayoutDisbursement({
      campaignId: payout.campaignId,
      amount: leg.amount,
      currency: payout.currency,
      memo: `payout ${payout.id} leg ${leg.index + 1} settled (${reference})`,
    });
    await this.ledgerRepo.postEntry(entry);

    await this.reconcileBatch(payout.id);
  }

  /** A batched leg failed: return that leg's reservation, then reconcile. */
  private async onLegFailed(
    payout: PayoutEntity,
    reference: string
  ): Promise<void> {
    const leg = payout.legs?.find((l) => l.reference === reference);
    if (!leg) return;
    const won = await this.payoutRepo.setLegStatus(
      payout.id,
      reference,
      ['queued', 'submitted'],
      'failed'
    );
    if (!won) return; // idempotent

    await this.campaignBalanceRepo.returnToAvailable(
      payout.campaignId,
      leg.amount
    );
    await this.reconcileBatch(payout.id);
  }

  /**
   * A settled batched leg reversed: return that leg's money (paidOut → available)
   * with a reversing journal, and flag the whole payout for manual review — a
   * reversal on a partially/fully disbursed batch always needs a human.
   */
  private async onLegReversed(
    payout: PayoutEntity,
    reference: string
  ): Promise<void> {
    const leg = payout.legs?.find((l) => l.reference === reference);
    if (!leg) return;
    const won = await this.payoutRepo.setLegStatus(
      payout.id,
      reference,
      ['success'],
      'reversed'
    );
    if (!won) return; // idempotent

    await this.campaignBalanceRepo.reverseFromPaidOut(
      payout.campaignId,
      leg.amount,
      0
    );
    const entry = JournalEntryEntity.forPayoutReversal({
      campaignId: payout.campaignId,
      amount: leg.amount,
      currency: payout.currency,
      memo: `payout ${payout.id} leg ${leg.index + 1} reversed (${reference})`,
    });
    await this.ledgerRepo.postEntry(entry);
    await this.payoutRepo.flagNeedsReview(payout.id);
  }

  /**
   * Decide a batched payout's terminal state once every leg is settled: PAID if
   * all legs succeeded, else NEEDS_REVIEW (real money left on the winners and
   * cannot be un-sent). No-op while any leg is still in flight — the last leg's
   * webhook makes the call. Atomic guards keep it exactly-once.
   */
  private async reconcileBatch(payoutId: string): Promise<void> {
    const p = await this.payoutRepo.findById(payoutId);
    if (!p || !p.isBatched || p.status !== 'PROCESSING') return;
    const legs = p.legs ?? [];
    const inFlight = legs.some(
      (l) => l.status === 'queued' || l.status === 'submitted'
    );
    if (inFlight) return;
    const allSuccess = legs.every((l) => l.status === 'success');
    if (allSuccess) {
      await this.payoutRepo.transitionBatchedToPaid(payoutId);
    } else {
      await this.payoutRepo.flagNeedsReview(payoutId);
    }
  }
}
