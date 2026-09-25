import type { DonationIntentEntity } from '../../domain/entities/DonationIntent.js';
import type { CouponRedemptionRepositoryPort } from '../../domain/ports/outbound/CouponRedemptionRepositoryPort.js';
import { releaseDonationSeat } from '../services/donationCouponSeats.js';
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
import { tipChargeMatches, type TipCharge } from './HandleTipWebhookUseCase.js';

/** The tip settlement seam the reconciler drives; {@link HandleTipWebhookUseCase} satisfies it. */
export interface TipCreditRepairer {
  creditSucceededTip(tip: TipEntity): Promise<void>;
  handleSuccess(reference: string, charge: TipCharge): Promise<void>;
  handleFailed(reference: string): Promise<void>;
}

/**
 * How long a checkout the provider reports as `abandoned` stays open before the
 * sweep closes it. Paystack reports every opened-but-unpaid checkout as
 * `abandoned`, including one the payer is still completing, so it is only
 * treated as final once it is this old. A payment that still lands afterwards
 * is credited by the late-success path, never dropped.
 */
export const ABANDONED_CHECKOUT_TTL_MS = 24 * 60 * 60 * 1000;

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
  /** Stale PENDING tips the provider confirmed paid (lost webhook) and settled. */
  tipsSettled: number;
  /** Stale PENDING tips closed as FAILED (provider failed, or abandoned past the TTL). */
  tipsFailed: number;
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
    private readonly tipCreditRepairer?: TipCreditRepairer,
    /** Optional: frees a failed donation's fee-waiver seat on the sweep. */
    private readonly couponRedemptionRepo?: CouponRedemptionRepositoryPort
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
      tipsSettled: 0,
      tipsFailed: 0,
    };
    for (const intent of stale) {
      const outcome = await this.reconcileOne(intent);
      summary[outcome] += 1;
    }
    const tips = await this.reconcileStaleTips(cutoff, limit);
    summary.tipsSettled = tips.settled;
    summary.tipsFailed = tips.failed;
    summary.tipsRepaired = await this.repairUncreditedTips(cutoff, limit);
    logger.info({ ...summary }, 'payment reconciliation sweep complete');
    return summary;
  }

  /**
   * Re-verify stale PENDING tips with the provider, so a tip whose webhook was
   * lost is still credited (and a dead checkout is eventually closed):
   *   - success with the same reference, amount and currency → settle,
   *   - failed, or abandoned for longer than {@link ABANDONED_CHECKOUT_TTL_MS} → FAILED,
   *   - anything else (still paying, transient error, mismatch) → left PENDING.
   * Every visited row is stamped first, so unresolvable rows rotate to the back
   * of the queue and can never starve newer ones.
   */
  private async reconcileStaleTips(
    cutoff: Date,
    limit: number
  ): Promise<{ settled: number; failed: number }> {
    const result = { settled: 0, failed: 0 };
    if (!this.tipRepo || !this.tipCreditRepairer) return result;
    const gateway = this.gatewayRegistry.get('paystack');
    if (!gateway || !gateway.isConfigured()) return result;
    const now = new Date();
    const stale = await this.tipRepo.findStalePending(cutoff, limit);
    for (const tip of stale) {
      try {
        await this.tipRepo.recordReconciliationAttempt(tip.id, now);
        const verified = await gateway.verifyTransaction(tip.providerRef);
        if (verified.status === 'success') {
          if (verified.reference !== tip.providerRef || !tipChargeMatches(tip, verified)) {
            logger.warn(
              {
                tipId: tip.id,
                providerRef: tip.providerRef,
                expectedAmount: tip.amount,
                providerAmount: verified.amount,
                expectedCurrency: tip.currency,
                providerCurrency: verified.currency,
              },
              'reconcile: tip provider/row mismatch — flagged, not credited'
            );
            continue;
          }
          await this.tipCreditRepairer.handleSuccess(tip.providerRef, {
            amount: verified.amount,
            currency: verified.currency,
            providerVerified: true,
          });
          result.settled += 1;
          continue;
        }
        const abandonedTooLong =
          verified.status === 'abandoned' &&
          now.getTime() - tip.toPlain().createdAt.getTime() > ABANDONED_CHECKOUT_TTL_MS;
        if (verified.status === 'failed' || abandonedTooLong) {
          await this.tipCreditRepairer.handleFailed(tip.providerRef);
          result.failed += 1;
        }
      } catch (error) {
        // Transient provider/network error — the row stays PENDING and has
        // already rotated to the back of the queue.
        logger.warn({ err: error, tipId: tip.id }, 'reconcile: tip verification failed (transient)');
      }
    }
    return result;
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
    if (intent.status !== 'PENDING' && intent.status !== 'CREATED') return 'skipped';
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
      const amountMismatch = !Number.isFinite(verified.amount) ||
        Math.abs(verified.amount - intent.gross) > amountTolerance;
      const referenceMismatch = verified.reference !== intent.providerRef;
      const invalidFees = !Number.isFinite(verified.fees) || verified.fees < 0 || verified.fees > verified.amount;
      if (currencyMismatch || amountMismatch || referenceMismatch || invalidFees) {
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

      const platformFeePercent = await this.planLimits.platformFeePercentForIntent(intent);
      const breakdown = this.feePolicy.computeSettlementFromProvider({
        gross: verified.amount,
        tip: intent.tip,
        processorFee: verified.fees,
        currency: verified.currency,
        providerRef: intent.providerRef,
        platformFeePercent,
      });
      await this.settleDonationUseCase.execute(intent, breakdown, verified.raw?.channel);
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
      if (failed) {
        await releaseDonationSeat(this.couponRedemptionRepo, intent.id, intent.couponId);
      }
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
