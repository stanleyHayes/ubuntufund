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
    await this.affiliatePayoutRepo.markSettlementApplied(payout.id);
  }

  async handleFailed(reference: string): Promise<void> {
    const payout = await this.affiliatePayoutRepo.findByProviderRef(reference);
    if (!payout) return;

    const won = await this.affiliatePayoutRepo.transitionToFailed(payout.id);
    if (!won) return; // idempotent

    // Nothing was disbursed — return the reservation to availableBalance.
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
    await this.affiliatePayoutRepo.markSettlementApplied(payout.id);
  }

  async handleReversed(reference: string): Promise<void> {
    const payout = await this.affiliatePayoutRepo.findByProviderRef(reference);
    if (!payout) return;

    // A reversal of an already-settled (PAID) transfer: the funds came back, so
    // make them available again.
    const fromPaid = await this.affiliatePayoutRepo.transitionPaidToReversed(
      payout.id
    );
    if (fromPaid) {
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
      return;
    }

    // A reversal seen before we observed success: treat like a failure —
    // return the reservation.
    const fromProcessing =
      await this.affiliatePayoutRepo.transitionProcessingToReversed(payout.id);
    if (fromProcessing) {
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
    // Otherwise not in a reversible state — idempotent no-op.
  }

  /**
   * Reconciliation repair (G5): re-apply the terminal settlement effect for an
   * affiliate payout whose balance write did not complete (a crash between the
   * state transition and the effect). Idempotent via the same settleRef the
   * webhook uses. PAID → re-credit paidOut; FAILED → re-return the reservation.
   * REVERSED is not repaired here (see HandlePayoutWebhookUseCase.repairSettlement).
   */
  async repairSettlement(payoutId: string): Promise<void> {
    const payout = await this.affiliatePayoutRepo.findById(payoutId);
    if (!payout) return;
    if (payout.status !== 'PAID' && payout.status !== 'FAILED') return;
    const balance = await this.affiliateBalanceRepo.findByAffiliateId(
      payout.affiliateId
    );
    if (balance) {
      if (payout.status === 'PAID') {
        await this.affiliateBalanceRepo.markPaidOut(
          balance.id,
          payout.amount,
          `aff:${payout.id}:paid`
        );
      } else {
        await this.affiliateBalanceRepo.returnToAvailable(
          balance.id,
          payout.amount,
          `aff:${payout.id}:returned`
        );
      }
    }
    await this.affiliatePayoutRepo.markSettlementApplied(payout.id);
  }
}
