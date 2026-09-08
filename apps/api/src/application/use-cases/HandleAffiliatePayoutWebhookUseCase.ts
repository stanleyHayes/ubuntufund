import type { AffiliatePayoutRepositoryPort } from '../../domain/ports/outbound/AffiliatePayoutRepositoryPort.js';
import type { AffiliateBalanceRepositoryPort } from '../../domain/ports/outbound/AffiliateBalanceRepositoryPort.js';

/**
 * Applies Paystack transfer webhooks to the affiliate payout + balance read
 * models. Each handler correlates the payout by its unique `aff-` transfer
 * reference and is idempotent: the balance effect runs only for the caller that
 * wins the atomic state transition, so a duplicate webhook is a harmless no-op.
 * (Reserved funds were removed from `availableBalance` at request time.)
 *
 *  - transfer.success  → PROCESSING → PAID; the in-transit funds have left the
 *                        platform → paidOutBalance += amount.
 *  - transfer.failed   → PROCESSING → FAILED; return the reserved in-transit
 *                        funds to availableBalance.
 *  - transfer.reversed → PAID → REVERSED (the transfer bounced back) or
 *                        PROCESSING → REVERSED (seen before we observed success);
 *                        either way the funds are made available again.
 */
export class HandleAffiliatePayoutWebhookUseCase {
  constructor(
    private readonly affiliatePayoutRepo: AffiliatePayoutRepositoryPort,
    private readonly affiliateBalanceRepo: AffiliateBalanceRepositoryPort
  ) {}

  async handleSuccess(reference: string): Promise<void> {
    const payout = await this.affiliatePayoutRepo.findByProviderRef(reference);
    if (!payout) return;

    const won = await this.affiliatePayoutRepo.transitionToPaid(payout.id);
    if (!won) return; // idempotent: already PAID or not PROCESSING

    const balance = await this.affiliateBalanceRepo.findByAffiliateId(
      payout.affiliateId
    );
    if (balance) {
      await this.affiliateBalanceRepo.markPaidOut(
        balance.id,
        payout.amount,
        `aff:${payout.id}:paid`
      );
    }
    await this.affiliatePayoutRepo.markSettlementApplied(payout.id, 'PAID');
  }

  async handleFailed(reference: string): Promise<void> {
    const payout = await this.affiliatePayoutRepo.findByProviderRef(reference);
    if (!payout) return;

    const won = await this.affiliatePayoutRepo.transitionToFailed(payout.id);
    if (!won) return; // idempotent

    await this.applyReturn(payout);
    await this.affiliatePayoutRepo.markSettlementApplied(payout.id, 'FAILED');
  }

  async handleReversed(reference: string): Promise<void> {
    const payout = await this.affiliatePayoutRepo.findByProviderRef(reference);
    if (!payout) return;

    // A reversal of an already-settled (PAID) transfer: the funds came back.
    const fromPaid = await this.affiliatePayoutRepo.transitionPaidToReversed(
      payout.id
    );
    if (fromPaid) {
      await this.applyReversalFromPaid(payout);
      await this.affiliatePayoutRepo.markSettlementApplied(payout.id, 'REVERSED');
      return;
    }

    // A reversal seen before we observed success: treat like a failure —
    // return the reservation.
    const fromProcessing =
      await this.affiliatePayoutRepo.transitionProcessingToReversed(payout.id);
    if (fromProcessing) {
      await this.applyReturn(payout);
      await this.affiliatePayoutRepo.markSettlementApplied(payout.id, 'REVERSED');
    }
    // Otherwise not in a reversible state — idempotent no-op.
  }

  /**
   * Reconciliation repair for an affiliate payout whose balance write did not
   * complete (a crash between the state transition and the effect). Idempotent
   * via the same settleRef the webhook uses.
   *  - PAID   → re-credit paidOut (G5).
   *  - FAILED → re-return the reservation (G5).
   *  - REVERSED → replay the owed reverse effect, disambiguated by `reversedFrom`
   *    (G7): 'PROCESSING' → return the reservation; 'PAID' → reverse paidOut →
   *    available. Legacy REVERSED (no `reversedFrom`) is skipped (finder excludes
   *    it). The flag is set only if the payout is STILL in the repaired status.
   */
  async repairSettlement(payoutId: string): Promise<void> {
    const payout = await this.affiliatePayoutRepo.findById(payoutId);
    if (!payout) return;
    if (payout.status === 'PAID') {
      const balance = await this.affiliateBalanceRepo.findByAffiliateId(
        payout.affiliateId
      );
      if (balance) {
        await this.affiliateBalanceRepo.markPaidOut(
          balance.id,
          payout.amount,
          `aff:${payout.id}:paid`
        );
      }
      await this.affiliatePayoutRepo.markSettlementApplied(payout.id, 'PAID');
    } else if (payout.status === 'FAILED') {
      await this.applyReturn(payout);
      await this.affiliatePayoutRepo.markSettlementApplied(payout.id, 'FAILED');
    } else if (payout.status === 'REVERSED') {
      if (payout.reversedFrom === 'PROCESSING') {
        await this.applyReturn(payout);
        await this.affiliatePayoutRepo.markSettlementApplied(payout.id, 'REVERSED');
      } else if (payout.reversedFrom === 'PAID') {
        await this.applyReversalFromPaid(payout);
        await this.affiliatePayoutRepo.markSettlementApplied(payout.id, 'REVERSED');
      }
    }
  }

  /** Return the reservation to availableBalance (idempotent per settleRef). */
  private async applyReturn(payout: {
    id: string;
    affiliateId: string;
    amount: number;
  }): Promise<void> {
    const balance = await this.affiliateBalanceRepo.findByAffiliateId(
      payout.affiliateId
    );
    if (balance) {
      await this.affiliateBalanceRepo.returnToAvailable(
        balance.id,
        payout.amount,
        `aff:${payout.id}:returned`
      );
    }
  }

  /**
   * The PAID→REVERSED effect (G7): move paidOut → available, idempotent per the
   * `:reversed` settleRef. Does NOT re-drive the forward credit (that would
   * double-credit a legacy payout whose forward never recorded a `:paid` ref).
   */
  private async applyReversalFromPaid(payout: {
    id: string;
    affiliateId: string;
    amount: number;
  }): Promise<void> {
    const balance = await this.affiliateBalanceRepo.findByAffiliateId(
      payout.affiliateId
    );
    if (balance) {
      await this.affiliateBalanceRepo.reverseFromPaidOut(
        balance.id,
        payout.amount,
        `aff:${payout.id}:reversed`
      );
    }
  }
}
