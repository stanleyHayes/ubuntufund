import type { CryptoWebhookEvent } from '@ubuntu-fund/types';
import type { DonationIntentRepositoryPort } from '../../domain/ports/outbound/DonationIntentRepositoryPort.js';
import type { CryptoPaymentProviderPort } from '../../domain/ports/outbound/CryptoPaymentProviderPort.js';
import type { HandleCryptoWebhookUseCase } from './HandleCryptoWebhookUseCase.js';
import { logger } from '../../infrastructure/logging/logger.js';

export interface CryptoReconcileSummary {
  scanned: number;
  settled: number;
  detected: number;
  failed: number;
  pending: number;
  errored: number;
}

/**
 * Reconciles crypto deposits stuck PENDING/PROCESSING past a threshold (a missed
 * or dropped provider webhook, plan §7/§8/§19). For each stale intent it polls
 * the provider (`getDeposit`) and drives the SAME normalized transitions the
 * webhook would through {@link HandleCryptoWebhookUseCase.applyEvent} — which is
 * idempotent (settlement is gated exactly-once). A deposit that already settled
 * is SUCCEEDED and never returned by the stale scan, so a reconcile run can
 * never double-credit a campaign (§22).
 */
export class ReconcileCryptoUseCase {
  constructor(
    private readonly intentRepo: DonationIntentRepositoryPort,
    private readonly providersByName: Map<string, CryptoPaymentProviderPort>,
    private readonly handleCryptoWebhookUseCase: HandleCryptoWebhookUseCase
  ) {}

  async reconcileStale(opts: {
    olderThanMinutes: number;
    limit?: number;
  }): Promise<CryptoReconcileSummary> {
    const summary: CryptoReconcileSummary = {
      scanned: 0,
      settled: 0,
      detected: 0,
      failed: 0,
      pending: 0,
      errored: 0,
    };
    const cutoff = new Date(Date.now() - opts.olderThanMinutes * 60_000);
    const stale = await this.intentRepo.findStaleCrypto(cutoff, opts.limit ?? 100);

    for (const intent of stale) {
      summary.scanned += 1;
      const provider = this.providersByName.get(intent.provider);
      if (!provider || !intent.providerRef) {
        summary.pending += 1;
        continue;
      }
      let status;
      try {
        status = await provider.getDeposit(intent.providerRef);
      } catch (error) {
        logger.error(
          { err: error, donationIntentId: intent.id },
          'crypto reconcile: provider getDeposit failed'
        );
        summary.errored += 1;
        continue;
      }

      const type: CryptoWebhookEvent['type'] | null =
        status.status === 'confirmed'
          ? 'deposit.confirmed'
          : status.status === 'detected'
            ? 'deposit.detected'
            : status.status === 'failed'
              ? 'deposit.failed'
              : null;
      if (!type) {
        summary.pending += 1;
        continue;
      }

      await this.handleCryptoWebhookUseCase.applyEvent(intent, {
        eventId: `recon-${intent.id}`,
        type,
        providerRef: intent.providerRef,
        transactionHash: status.transactionHash,
        confirmations: status.confirmations,
        cryptoAmount: status.cryptoAmount,
        raw: {},
      });
      if (type === 'deposit.confirmed') summary.settled += 1;
      else if (type === 'deposit.detected') summary.detected += 1;
      else summary.failed += 1;
    }

    return summary;
  }
}
