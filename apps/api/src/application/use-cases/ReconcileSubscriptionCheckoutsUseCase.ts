import type { SubscriptionCheckoutRepositoryPort } from '../../domain/ports/outbound/SubscriptionCheckoutRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import type { CouponRedemptionRepositoryPort } from '../../domain/ports/outbound/CouponRedemptionRepositoryPort.js';
import type { SettleSubscriptionUseCase } from './SettleSubscriptionUseCase.js';
import {
  SUBSCRIPTION_CHECKOUT_TTL_MS,
  SubscriptionCheckoutResolver,
  type CheckoutResolution,
} from '../services/SubscriptionCheckoutResolver.js';
import { logger } from '../../infrastructure/logging/logger.js';

/**
 * A checkout whose provider verification keeps failing is given up on after
 * this long. Nothing else would ever move it, and it would otherwise be
 * re-verified on every tick ahead of newer work. A genuine late charge still
 * settles it through the webhook (EXPIRED → SUCCEEDED is allowed).
 */
const UNVERIFIABLE_GIVE_UP_MS = 7 * 24 * 60 * 60 * 1000;

export interface SubscriptionCheckoutSweepSummary {
  scanned: number;
  settled: number;
  failed: number;
  expired: number;
  pending: number;
  errors: number;
}

/**
 * Scheduled repair for the paid-subscription Paystack rail. PENDING checkouts
 * older than `olderThanMinutes` are re-verified with the provider:
 *   - paid → settled (a missed webhook is repaired);
 *   - failed → FAILED, coupon seat released;
 *   - still unpaid after 24 hours → EXPIRED, coupon seat released, which also
 *     frees the member to switch billing rail;
 *   - still processing or a transient provider error → left for the next run
 *     (behind rows not visited yet, so a backlog cannot starve newer ones).
 */
export class ReconcileSubscriptionCheckoutsUseCase {
  private readonly resolver: SubscriptionCheckoutResolver;

  constructor(
    private readonly subscriptionCheckoutRepo: SubscriptionCheckoutRepositoryPort,
    private readonly gateway: PaymentGatewayPort,
    settle: SettleSubscriptionUseCase,
    couponRedemptionRepo?: CouponRedemptionRepositoryPort
  ) {
    this.resolver = new SubscriptionCheckoutResolver(subscriptionCheckoutRepo, gateway, settle, couponRedemptionRepo);
  }

  async reconcileStale(
    opts: { olderThanMinutes?: number; limit?: number; now?: Date } = {}
  ): Promise<SubscriptionCheckoutSweepSummary> {
    const now = opts.now ?? new Date();
    const summary: SubscriptionCheckoutSweepSummary = {
      scanned: 0, settled: 0, failed: 0, expired: 0, pending: 0, errors: 0,
    };
    if (!this.gateway.isConfigured()) return summary;
    const cutoff = new Date(now.getTime() - (opts.olderThanMinutes ?? 30) * 60_000);
    const stale = await this.subscriptionCheckoutRepo.findStalePending(cutoff, opts.limit ?? 100);
    summary.scanned = stale.length;
    for (const checkout of stale) {
      // Stamp the visit first, so a row the provider cannot resolve yet (still
      // processing, or verification keeps failing) moves behind rows not yet
      // checked instead of pinning the head of every sweep.
      try {
        await this.subscriptionCheckoutRepo.recordReconciliationAttempt(checkout.id, now);
      } catch (error) {
        logger.warn({ err: error, checkoutId: checkout.id }, 'subscription checkout reconciliation: could not stamp sweep visit');
      }
      let outcome: CheckoutResolution;
      try {
        outcome = await this.resolver.resolve(checkout, { expireUnpaidAfterMs: SUBSCRIPTION_CHECKOUT_TTL_MS, now });
      } catch (error) {
        summary.errors += 1;
        logger.warn({ err: error, checkoutId: checkout.id }, 'subscription checkout reconciliation failed (will retry)');
        const age = now.getTime() - new Date(checkout.createdAt).getTime();
        if (age < UNVERIFIABLE_GIVE_UP_MS) continue;
        logger.error({ checkoutId: checkout.id }, 'subscription checkout unverifiable for 7 days; expiring it');
        outcome = await this.resolver.expire(checkout);
      }
      summary[outcome] += 1;
    }
    if (summary.scanned) logger.info({ ...summary }, 'subscription checkout reconciliation sweep complete');
    return summary;
  }
}
