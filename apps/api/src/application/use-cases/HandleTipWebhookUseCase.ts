import type { TipEntity } from '../../domain/entities/Tip.js';
import type { TipRepositoryPort } from '../../domain/ports/outbound/TipRepositoryPort.js';
import type { CreatorBalanceRepositoryPort } from '../../domain/ports/outbound/CreatorBalanceRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import { chargeMatches } from '../services/providerCharge.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/**
 * What the provider says it actually charged for a `tip-` reference, in MAJOR
 * units of `currency`. The signed webhook passes its `data.amount` (parsed from
 * minor units) and `data.currency`; the verify rail passes the figures from a
 * server-side `verifyTransaction`.
 */
export interface TipCharge {
  amount: number;
  currency: string;
  /**
   * True when the figures came from our own server-side `verifyTransaction`
   * (not only from a webhook body). Required before a FAILED tip can be revived
   * by a late success; the webhook path re-verifies itself when it is absent.
   */
  providerVerified?: boolean;
}

/** True when the provider's charge is exactly the tip the supporter was quoted. */
export function tipChargeMatches(tip: TipEntity, charge: TipCharge): boolean {
  return chargeMatches({ amount: tip.amount, currency: tip.currency }, charge);
}

/**
 * Settles a `tip-` charge. Idempotent: the balance credit runs only for the
 * caller that wins the atomic PENDING → SUCCEEDED transition, and the credit
 * itself is guarded by a settleRef, so a duplicate webhook is a harmless no-op.
 *
 * The amount and currency the provider charged must equal the tip row before
 * anything is credited. The row's amount is chosen by the supporter when the
 * checkout opens, so a charge for a different amount under the same reference
 * (e.g. a reference claimed at the provider for a smaller sum) must never credit
 * the row's larger amount. A mismatch is logged and the tip stays PENDING for
 * manual review.
 *
 * A late success on a FAILED tip (the provider first reported the checkout as
 * failed, then the supporter completed it) is credited too — but only after a
 * server-side verification confirms the same reference, amount and currency.
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
    private readonly balanceRepo: CreatorBalanceRepositoryPort,
    /**
     * Optional: re-verifies a late success on a FAILED tip server-side. Absent,
     * a FAILED tip is only revived by a caller that already verified it.
     */
    private readonly gateway?: Pick<PaymentGatewayPort, 'verifyTransaction'>
  ) {}

  async handleSuccess(reference: string, charge: TipCharge): Promise<void> {
    const tip = await this.tipRepo.findByProviderRef(reference);
    if (!tip) return; // unknown reference
    if (tip.status === 'SUCCEEDED') return; // already settled (idempotent)
    if (tip.status !== 'PENDING' && tip.status !== 'FAILED') return;

    if (!tipChargeMatches(tip, charge)) {
      logger.warn(
        {
          tipId: tip.id,
          providerRef: reference,
          expectedAmount: tip.amount,
          expectedCurrency: tip.currency,
          providerAmount: charge.amount,
          providerCurrency: charge.currency,
        },
        'tip settlement mismatch — not crediting; left for manual review'
      );
      return;
    }

    if (tip.status === 'FAILED') {
      if (!(await this.lateSuccessConfirmed(tip, charge))) return;
      logger.warn(
        { tipId: tip.id, providerRef: reference },
        'late provider success on a FAILED tip — crediting after verification'
      );
    }

    const won = await this.tipRepo.transitionToSucceeded(reference, {
      allowFromFailed: tip.status === 'FAILED',
    });
    if (won) {
      await this.applyCredit(won);
      return;
    }
    await this.afterLostTransition(reference, tip, charge);
  }

  /**
   * The transition matched nothing. Either a concurrent success settled the
   * tip (done), or a concurrent failure — a charge.failed webhook, the stale
   * sweep, a verify — moved it PENDING → FAILED between our read and the
   * update. The provider still reports this charge as paid, so that case runs
   * the verified late-success path instead of acknowledging and dropping the
   * money. Anything unexpected throws so the provider redelivers.
   */
  private async afterLostTransition(reference: string, seen: TipEntity, charge: TipCharge): Promise<void> {
    const fresh = await this.tipRepo.findByProviderRef(reference);
    if (!fresh || fresh.status === 'SUCCEEDED') return;
    if (fresh.status === 'FAILED' && seen.status === 'PENDING') {
      if (!(await this.lateSuccessConfirmed(fresh, charge))) return;
      const revived = await this.tipRepo.transitionToSucceeded(reference, { allowFromFailed: true });
      if (revived) {
        logger.warn(
          { tipId: fresh.id, providerRef: reference },
          'tip was failed concurrently with its success — crediting after verification'
        );
        await this.applyCredit(revived);
        return;
      }
      if ((await this.tipRepo.findByProviderRef(reference))?.status === 'SUCCEEDED') return;
    }
    throw new AppError('Tip settlement changed concurrently; retry', 409);
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

  /**
   * A FAILED tip is revived only on a server-side verification that the
   * provider settled exactly this tip. Webhook figures alone are not enough.
   */
  private async lateSuccessConfirmed(tip: TipEntity, charge: TipCharge): Promise<boolean> {
    if (charge.providerVerified) return true;
    if (!this.gateway) return false;
    const verified = await this.gateway.verifyTransaction(tip.providerRef);
    const ok =
      verified.status === 'success' &&
      verified.reference === tip.providerRef &&
      tipChargeMatches(tip, { amount: verified.amount, currency: verified.currency });
    if (!ok) {
      logger.warn(
        { tipId: tip.id, providerRef: tip.providerRef, providerStatus: verified.status },
        'late tip success could not be verified — not crediting'
      );
    }
    return ok;
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
