import type { DonationIntentEntity } from '../../domain/entities/DonationIntent.js';
import type { TipEntity } from '../../domain/entities/Tip.js';
import type { DonationIntentRepositoryPort } from '../../domain/ports/outbound/DonationIntentRepositoryPort.js';
import type { PaymentAttemptRepositoryPort } from '../../domain/ports/outbound/PaymentAttemptRepositoryPort.js';
import type { TipRepositoryPort } from '../../domain/ports/outbound/TipRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import type { FeePolicy } from '../services/FeePolicy.js';
import type { PlanLimitsService } from '../services/PlanLimitsService.js';
import type { SettleDonationUseCase } from './SettleDonationUseCase.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { minorUnitExponent } from '../../domain/value-objects/Money.js';

/** The tip-credit repair seam the reconciler drives; {@link HandleTipWebhookUseCase} satisfies it. */
export interface TipCreditRepairer {
  creditSucceededTip(tip: TipEntity): Promise<void>;
}

/** Per-intent reconciliation outcome. */
export type ReconcileOutcome =
  | 'repaired' // provider says success, we settled a missed webhook
  | 'failed' // provider says failed, we marked it FAILED
  | 'mismatched' // provider currency/amount ≠ intent — flagged, not credited
  | 'pending' // provider still processing / transient error — left as-is
  | 'skipped'; // no ref / provider unconfigured

export interface ReconcileSummary {
  scanned: number;
  repaired: number;
  failed: number;
  mismatched: number;
  pending: number;
  skipped: number;
  /** SUCCEEDED-but-uncredited creator tips whose balance credit was re-applied. */
  tipsRepaired: number;
}

/**
 * Scheduled + admin-triggered reconciliation (spec §13). For hosted-rail intents
 * still PENDING past a threshold, it queries the provider with server-side
 * credentials, then repairs safe transitions idempotently:
 *   - provider success (matching currency+amount) → settle via the shared
 *     {@link SettleDonationUseCase} (idempotent; never double-credits),
 *   - provider failed → mark FAILED,
 *   - currency/amount mismatch → flag for manual review, never credit,
 *   - still processing / transient error → leave PENDING.
 * Never creates duplicate ledger entries (settlement is exactly-once).
 */
export class ReconcilePaymentsUseCase {
  constructor(
    private readonly gatewayRegistry: Map<string, PaymentGatewayPort>,
    private readonly donationIntentRepo: DonationIntentRepositoryPort,
    private readonly paymentAttemptRepo: PaymentAttemptRepositoryPort,
    private readonly feePolicy: FeePolicy,
    private readonly settleDonationUseCase: SettleDonationUseCase,
    private readonly planLimits: PlanLimitsService,
    // Optional creator tip-collect repair: re-credit SUCCEEDED-but-uncredited
    // tips (a crash between the status transition and the credit). Absent, the
    // sweep behaves exactly as before.
    private readonly tipRepo?: TipRepositoryPort,
    private readonly tipCreditRepairer?: TipCreditRepairer
  ) {}

  /** Reconcile stale PENDING hosted intents older than `olderThanMinutes`. */
  async reconcileStale(
    opts: { olderThanMinutes?: number; limit?: number } = {}
  ): Promise<ReconcileSummary> {
    const olderThanMinutes = opts.olderThanMinutes ?? 30;
    const limit = opts.limit ?? 100;
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
    const stale = await this.donationIntentRepo.findStalePending(cutoff, limit);

    const summary: ReconcileSummary = {
      scanned: stale.length,
      repaired: 0,
      failed: 0,
      mismatched: 0,
      pending: 0,
      skipped: 0,
      tipsRepaired: 0,
    };
    for (const intent of stale) {
      const outcome = await this.reconcileOne(intent);
      summary[outcome] += 1;
    }
    summary.tipsRepaired = await this.repairUncreditedTips(cutoff, limit);
    logger.info({ ...summary }, 'payment reconciliation sweep complete');
    return summary;
  }

  /**
   * Re-credit SUCCEEDED tips whose balance credit never landed. The credit is
   * settleRef-idempotent, so a tip that actually settled is a harmless no-op.
   * Returns how many tips were re-driven.
   */
  private async repairUncreditedTips(cutoff: Date, limit: number): Promise<number> {
    if (!this.tipRepo || !this.tipCreditRepairer) return 0;
    const stuck = await this.tipRepo.findSucceededUnsettled(cutoff, limit);
    let repaired = 0;
    for (const tip of stuck) {
      try {
        await this.tipCreditRepairer.creditSucceededTip(tip);
        repaired += 1;
      } catch (error) {
        logger.error({ err: error, tipId: tip.id }, 'reconcile: tip credit repair failed');
      }
    }
    return repaired;
  }

  /** Reconcile a single intent by id (admin action). Throws 404 if unknown. */
  async reconcileById(id: string): Promise<{ outcome: ReconcileOutcome; status: string }> {
    const intent = await this.donationIntentRepo.findById(id);
    if (!intent) throw new AppError('Contribution not found', 404);
    const outcome = await this.reconcileOne(intent);
    const fresh = await this.donationIntentRepo.findById(id);
    return { outcome, status: fresh?.status ?? intent.status };
  }

  private async reconcileOne(intent: DonationIntentEntity): Promise<ReconcileOutcome> {
    if (!intent.providerRef) return 'skipped';
    const gateway = this.gatewayRegistry.get(intent.provider);
    if (!gateway || !gateway.isConfigured()) return 'skipped';

    let verified;
    try {
      verified = await gateway.verifyTransaction(intent.providerRef);
    } catch (error) {
      // Transient provider/network error — leave PENDING for the next sweep.
      logger.warn(
        { err: error, intentId: intent.id, providerRef: intent.providerRef, provider: intent.provider },
        'reconcile: provider verification failed (transient)'
      );
      return 'pending';
    }

    if (verified.status === 'success') {
      const currencyMismatch =
        verified.currency.toUpperCase() !== intent.currency.toUpperCase();
      const amountTolerance = 0.5 / 10 ** minorUnitExponent(intent.currency);
      const amountMismatch =
        Math.abs(verified.amount - intent.gross) > amountTolerance;
      if (currencyMismatch || amountMismatch) {
        logger.warn(
          {
            intentId: intent.id,
            providerRef: intent.providerRef,
            provider: intent.provider,
            expectedCurrency: intent.currency,
            providerCurrency: verified.currency,
            expectedGross: intent.gross,
            providerGross: verified.amount,
          },
          'reconcile: provider/intent mismatch — flagged, not credited'
        );
        await this.safeRecordAttempt(intent, 'failed', verified.raw);
        return 'mismatched';
      }

      const platformFeePercent = await this.planLimits.platformFeePercentForCampaign(
        intent.campaignId
      );
      const breakdown = this.feePolicy.computeSettlementFromProvider({
        gross: verified.amount,
        tip: intent.tip,
        processorFee: verified.fees,
        currency: verified.currency,
        providerRef: intent.providerRef,
        platformFeePercent,
      });
      await this.settleDonationUseCase.execute(intent, breakdown);
      await this.safeRecordAttempt(intent, 'succeeded', verified.raw);
      return 'repaired';
    }

    if (verified.status === 'failed') {
      // Atomic guard: only fail an intent still PENDING. A webhook may have
      // settled it to SUCCEEDED between the stale scan and now — never overwrite
      // a credited intent back to FAILED.
      const failed = await this.donationIntentRepo.markFailedIfPending(
        intent.id,
        intent.providerRef
      );
      return failed ? 'failed' : 'pending';
    }

    // 'pending' / 'abandoned' / anything non-terminal — try again next sweep.
    return 'pending';
  }

  private async safeRecordAttempt(
    intent: DonationIntentEntity,
    status: 'succeeded' | 'failed',
    raw: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.paymentAttemptRepo.record({
        intentId: intent.id,
        provider: intent.provider,
        providerRef: intent.providerRef,
        status,
        raw,
      });
    } catch (error) {
      logger.error({ err: error, intentId: intent.id }, 'reconcile: failed to record attempt');
    }
  }
}
