import type { TipEntity } from '../../domain/entities/Tip.js';
import type { TipRepositoryPort } from '../../domain/ports/outbound/TipRepositoryPort.js';
import type { CreatorBalanceRepositoryPort } from '../../domain/ports/outbound/CreatorBalanceRepositoryPort.js';

/**
 * Settles a `tip-` charge webhook. Idempotent: the balance credit runs only for
 * the caller that wins the atomic PENDING → SUCCEEDED transition, and the credit
 * itself is guarded by a settleRef, so a duplicate webhook is a harmless no-op.
 *
 * The PENDING→SUCCEEDED transition and the balance credit are two separate,
 * non-atomic writes: a crash between them would leave a SUCCEEDED-but-uncredited
 * tip that the one-shot transition can never re-drive. So the credit is followed
 * by a compare-and-set `settlementApplied` flag, and {@link creditSucceededTip}
 * lets reconciliation re-apply the (settleRef-idempotent) credit for any tip left
 * unsettled — money collected is always eventually made withdrawable.
 */
export class HandleTipWebhookUseCase {
  constructor(
    private readonly tipRepo: TipRepositoryPort,
    private readonly balanceRepo: CreatorBalanceRepositoryPort
  ) {}

  async handleSuccess(reference: string): Promise<void> {
    const tip = await this.tipRepo.transitionToSucceeded(reference);
    if (!tip) return; // unknown reference or already settled
    await this.applyCredit(tip);
  }

  async handleFailed(reference: string): Promise<void> {
    await this.tipRepo.transitionToFailed(reference);
  }

  /**
   * Reconciliation repair: re-apply the balance credit for a SUCCEEDED tip whose
   * credit never landed (crash between the transition and the credit). The credit
   * is settleRef-idempotent, so a tip that actually settled is a harmless no-op.
   */
  async creditSucceededTip(tip: TipEntity): Promise<void> {
    if (tip.status !== 'SUCCEEDED') return;
    await this.applyCredit(tip);
  }

  private async applyCredit(tip: TipEntity): Promise<void> {
    await this.balanceRepo.ensure(tip.creatorUserId, tip.currency);
    await this.balanceRepo.creditTip(
      tip.creatorUserId,
      tip.amount,
      tip.platformFee,
      tip.netAmount,
      `tip:${tip.id}:credited`
    );
    await this.tipRepo.markSettlementApplied(tip.id);
  }
}
