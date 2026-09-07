import type { PayoutRepositoryPort } from '../../domain/ports/outbound/PayoutRepositoryPort.js';
import type { BeneficiaryPayoutRepositoryPort } from '../../domain/ports/outbound/BeneficiaryPayoutRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import { logger } from '../../infrastructure/logging/logger.js';

/**
 * A settlement handler exposing the three terminal transitions the reconciler
 * drives. Both {@link HandlePayoutWebhookUseCase} and
 * {@link HandleBeneficiaryPayoutWebhookUseCase} satisfy it.
 */
export interface PayoutWebhookHandler {
  handleSuccess(reference: string): Promise<void>;
  handleFailed(reference: string): Promise<void>;
  handleReversed(reference: string): Promise<void>;
}

export interface ReconcilePayoutSummary {
  scanned: number;
  settled: number;
  failed: number;
  reversed: number;
  pending: number;
  errored: number;
}

/**
 * Reconciles payouts stuck in PROCESSING (a provider `transfer.*` webhook was
 * missed or delayed, leaving funds reserved out of `availableBalance` but never
 * disbursed nor returned). For each stale single-transfer payout it re-verifies
 * the transfer against the provider and drives the SAME settlement handler the
 * webhook would — which is idempotent (gated by the atomic state transition), so
 * a payout already settled by a late webhook is a harmless no-op. Covers the
 * campaign and per-beneficiary rails; batched payouts (reconciled per-leg) and
 * pending/OTP transfers are left untouched.
 */
export class ReconcilePayoutsUseCase {
  constructor(
    private readonly payoutRepo: PayoutRepositoryPort,
    private readonly beneficiaryPayoutRepo: BeneficiaryPayoutRepositoryPort,
    private readonly handlePayoutWebhookUseCase: PayoutWebhookHandler,
    private readonly handleBeneficiaryPayoutWebhookUseCase: PayoutWebhookHandler,
    private readonly paymentGateway: PaymentGatewayPort
  ) {}

  async reconcileStale(opts: {
    olderThanMinutes: number;
  }): Promise<ReconcilePayoutSummary> {
    const summary: ReconcilePayoutSummary = {
      scanned: 0,
      settled: 0,
      failed: 0,
      reversed: 0,
      pending: 0,
      errored: 0,
    };
    if (!this.paymentGateway.isConfigured()) return summary;

    const cutoff = new Date(Date.now() - opts.olderThanMinutes * 60_000);

    const campaign = await this.payoutRepo.findStuckProcessing(cutoff);
    for (const payout of campaign) {
      if (payout.providerRef) {
        await this.reconcileOne(
          payout.providerRef,
          this.handlePayoutWebhookUseCase,
          summary
        );
      }
    }

    const beneficiary = await this.beneficiaryPayoutRepo.findStuckProcessing(cutoff);
    for (const payout of beneficiary) {
      if (payout.providerRef) {
        await this.reconcileOne(
          payout.providerRef,
          this.handleBeneficiaryPayoutWebhookUseCase,
          summary
        );
      }
    }

    return summary;
  }

  private async reconcileOne(
    reference: string,
    handler: PayoutWebhookHandler,
    summary: ReconcilePayoutSummary
  ): Promise<void> {
    summary.scanned += 1;
    let status: string;
    try {
      const result = await this.paymentGateway.verifyTransfer(reference);
      status = result.status;
    } catch (error) {
      logger.error({ error, reference }, 'payout reconciliation: verify failed');
      summary.errored += 1;
      return;
    }

    // Drive the same idempotent settlement the webhook would.
    if (status === 'success') {
      await handler.handleSuccess(reference);
      summary.settled += 1;
    } else if (status === 'failed') {
      await handler.handleFailed(reference);
      summary.failed += 1;
    } else if (status === 'reversed') {
      await handler.handleReversed(reference);
      summary.reversed += 1;
    } else {
      // pending / otp / receipt / unknown — the provider hasn't decided; leave it.
      summary.pending += 1;
    }
  }
}
