import type { PayoutRepositoryPort } from '../../domain/ports/outbound/PayoutRepositoryPort.js';
import type { CampaignBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBalanceRepositoryPort.js';
import type { LedgerRepositoryPort } from '../../domain/ports/outbound/LedgerRepositoryPort.js';
import { JournalEntryEntity } from '../../domain/entities/JournalEntry.js';

/**
 * Applies Paystack transfer webhooks to the payout + ledger read models. All
 * three handlers correlate the payout by its unique transfer reference and are
 * idempotent: the balance/ledger effect runs only for the caller that wins the
 * atomic state transition, so a duplicate webhook is a harmless no-op.
 *
 *  - transfer.success  → PROCESSING → PAID; move in-transit → paidOut; post the
 *                        immutable disbursement journal (debit beneficiary,
 *                        credit payout).
 *  - transfer.failed   → PROCESSING → FAILED; return the reserved in-transit
 *                        funds to availableBalance (no journal — nothing left
 *                        the platform).
 *  - transfer.reversed → PAID → REVERSED (post a reversing journal + move
 *                        paidOut → available), or PROCESSING → REVERSED (return
 *                        the reservation, like a failure).
 */
export class HandlePayoutWebhookUseCase {
  constructor(
    private readonly payoutRepo: PayoutRepositoryPort,
    private readonly campaignBalanceRepo: CampaignBalanceRepositoryPort,
    private readonly ledgerRepo: LedgerRepositoryPort
  ) {}

  async handleSuccess(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference);
    if (!payout) return;

    const won = await this.payoutRepo.transitionToPaid(payout.id);
    if (!won) return; // idempotent: already PAID or not PROCESSING

    await this.campaignBalanceRepo.markPaidOut(payout.campaignId, payout.amount);

    const entry = JournalEntryEntity.forPayoutDisbursement({
      campaignId: payout.campaignId,
      amount: payout.amount,
      currency: payout.currency,
      memo: `payout ${payout.id} settled (${reference})`,
    });
    await this.ledgerRepo.postEntry(entry);
  }

  async handleFailed(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference);
    if (!payout) return;

    const won = await this.payoutRepo.transitionToFailed(payout.id);
    if (!won) return; // idempotent

    // Nothing was disbursed — return the reservation to availableBalance.
    await this.campaignBalanceRepo.returnToAvailable(
      payout.campaignId,
      payout.amount
    );
  }

  async handleReversed(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference);
    if (!payout) return;

    // A reversal of an already-settled (PAID) transfer: money came back —
    // move paidOut → available and post the reversing journal.
    const fromPaid = await this.payoutRepo.transitionPaidToReversed(payout.id);
    if (fromPaid) {
      await this.campaignBalanceRepo.reverseFromPaidOut(
        payout.campaignId,
        payout.amount
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
    const fromProcessing = await this.payoutRepo.transitionProcessingToReversed(
      payout.id
    );
    if (fromProcessing) {
      await this.campaignBalanceRepo.returnToAvailable(
        payout.campaignId,
        payout.amount
      );
    }
    // Otherwise not in a reversible state — idempotent no-op.
  }
}
