import type { CreatorPayoutRepositoryPort } from '../../domain/ports/outbound/CreatorPayoutRepositoryPort.js';
import type { CreatorBalanceRepositoryPort } from '../../domain/ports/outbound/CreatorBalanceRepositoryPort.js';

/**
 * Settles `cpay-` transfer webhooks for creator withdrawals. Applies the G5/G7
 * durability the other payout rails use: the balance effect runs only for the
 * caller that wins the atomic status transition, is guarded by a settleRef, and
 * the settlement flag is a compare-and-set on status. Reconciliation re-drives a
 * terminal-but-unsettled withdrawal via {@link repairSettlement}.
 */
export class HandleCreatorPayoutWebhookUseCase {
  constructor(
    private readonly payoutRepo: CreatorPayoutRepositoryPort,
    private readonly balanceRepo: CreatorBalanceRepositoryPort
  ) {}

  async handleSuccess(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference);
    if (!payout) return;
    const won = await this.payoutRepo.transitionToPaid(payout.id);
    if (!won) return; // idempotent
    await this.balanceRepo.markPaidOut(
      payout.creatorUserId,
      payout.amount,
      0,
      `cpay:${payout.id}:paid`
    );
    await this.payoutRepo.markSettlementApplied(payout.id, 'PAID');
  }

  async handleFailed(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference);
    if (!payout) return;
    const won = await this.payoutRepo.transitionToFailed(payout.id);
    if (!won) return;
    await this.balanceRepo.returnToAvailable(
      payout.creatorUserId,
      payout.amount,
      `cpay:${payout.id}:returned`
    );
    await this.payoutRepo.markSettlementApplied(payout.id, 'FAILED');
  }

  async handleReversed(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference);
    if (!payout) return;
    const fromPaid = await this.payoutRepo.transitionPaidToReversed(payout.id);
    if (fromPaid) {
      await this.balanceRepo.reverseFromPaidOut(
        payout.creatorUserId,
        payout.amount,
        `cpay:${payout.id}:reversed`
      );
      await this.payoutRepo.markSettlementApplied(payout.id, 'REVERSED');
      return;
    }
    const fromProcessing = await this.payoutRepo.transitionProcessingToReversed(payout.id);
    if (fromProcessing) {
      await this.balanceRepo.returnToAvailable(
        payout.creatorUserId,
        payout.amount,
        `cpay:${payout.id}:returned`
      );
      await this.payoutRepo.markSettlementApplied(payout.id, 'REVERSED');
    }
  }

  /** Reconciliation repair for a terminal-but-unsettled withdrawal (crash). */
  async repairSettlement(payoutId: string): Promise<void> {
    const payout = await this.payoutRepo.findById(payoutId);
    if (!payout) return;
    const key = `cpay:${payout.id}`;
    if (payout.status === 'PAID') {
      await this.balanceRepo.markPaidOut(payout.creatorUserId, payout.amount, 0, `${key}:paid`);
      await this.payoutRepo.markSettlementApplied(payout.id, 'PAID');
    } else if (payout.status === 'FAILED') {
      await this.balanceRepo.returnToAvailable(payout.creatorUserId, payout.amount, `${key}:returned`);
      await this.payoutRepo.markSettlementApplied(payout.id, 'FAILED');
    } else if (payout.status === 'REVERSED') {
      if (payout.reversedFrom === 'PROCESSING') {
        await this.balanceRepo.returnToAvailable(payout.creatorUserId, payout.amount, `${key}:returned`);
        await this.payoutRepo.markSettlementApplied(payout.id, 'REVERSED');
      } else if (payout.reversedFrom === 'PAID') {
        await this.balanceRepo.reverseFromPaidOut(payout.creatorUserId, payout.amount, `${key}:reversed`);
        await this.payoutRepo.markSettlementApplied(payout.id, 'REVERSED');
      }
    }
  }
}
