import type { TipRepositoryPort } from '../../domain/ports/outbound/TipRepositoryPort.js';
import type { CreatorBalanceRepositoryPort } from '../../domain/ports/outbound/CreatorBalanceRepositoryPort.js';

/**
 * Settles a `tip-` charge webhook. Idempotent: the balance credit runs only for
 * the caller that wins the atomic PENDING → SUCCEEDED transition, and the credit
 * itself is guarded by a settleRef, so a duplicate webhook is a harmless no-op.
 */
export class HandleTipWebhookUseCase {
  constructor(
    private readonly tipRepo: TipRepositoryPort,
    private readonly balanceRepo: CreatorBalanceRepositoryPort
  ) {}

  async handleSuccess(reference: string): Promise<void> {
    const tip = await this.tipRepo.transitionToSucceeded(reference);
    if (!tip) return; // unknown reference or already settled
    await this.balanceRepo.ensure(tip.creatorUserId, tip.currency);
    await this.balanceRepo.creditTip(
      tip.creatorUserId,
      tip.amount,
      tip.platformFee,
      tip.netAmount,
      `tip:${tip.id}:credited`
    );
  }

  async handleFailed(reference: string): Promise<void> {
    await this.tipRepo.transitionToFailed(reference);
  }
}
