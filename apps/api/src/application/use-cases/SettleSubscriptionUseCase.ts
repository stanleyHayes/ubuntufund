import {
  BillingCycle,
  SubscriptionStatus,
  type Subscription,
  type SubscriptionCheckout,
} from '@ubuntu-fund/types';
import type { SubscriptionCheckoutRepositoryPort } from '../../domain/ports/outbound/SubscriptionCheckoutRepositoryPort.js';
import type { SubscriptionRepositoryPort } from '../../domain/ports/outbound/SubscriptionRepositoryPort.js';
import type { CouponRepositoryPort } from '../../domain/ports/outbound/CouponRepositoryPort.js';
import type { CouponRedemptionRepositoryPort } from '../../domain/ports/outbound/CouponRedemptionRepositoryPort.js';
import type { AffiliateCommissionService } from '../services/AffiliateCommissionService.js';
import { logger } from '../../infrastructure/logging/logger.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Settles a paid-subscription checkout — the single reusable seam every rail
 * calls once the money has actually moved. The signed Paystack webhook calls it
 * with the charge's real reference; a coupon that zeroes the price calls it
 * inline from {@link CreateSubscriptionCheckoutUseCase} with a synthetic ref
 * (no charge). It mirrors {@link SettleDonationUseCase}.
 *
 * settle(checkout, reference):
 *   1. Atomically transition the checkout PENDING → SUCCEEDED (the exactly-once
 *      gate). Null => already settled/terminal; return the current record
 *      unchanged (idempotent no-op).
 *   2. Upsert the user's Subscription to the paid tier, ACTIVE, with a fresh
 *      billing period.
 *   3. If the checkout carried a coupon: bump the coupon's global redemption
 *      counter (atomic, under-cap), then CONSUME the provisional redemption slot
 *      and link it to the activated subscription.
 *   4. Finally, award the one-time affiliate commission (best-effort — a failure
 *      here never unwinds the already-committed activation).
 *
 * Every step after the gate is idempotent, so a replayed settlement is safe.
 */
export class SettleSubscriptionUseCase {
  constructor(
    private readonly subscriptionCheckoutRepo: SubscriptionCheckoutRepositoryPort,
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly couponRepo: CouponRepositoryPort,
    private readonly couponRedemptionRepo: CouponRedemptionRepositoryPort,
    private readonly affiliateCommissionService?: AffiliateCommissionService
  ) {}

  async execute(
    checkout: SubscriptionCheckout,
    reference: string
  ): Promise<SubscriptionCheckout | null> {
    // ── 1. Exactly-once settlement gate ──────────────────────────────────
    const settled = await this.subscriptionCheckoutRepo.transitionToSucceeded(
      checkout.id
    );
    if (!settled) {
      // Already settled by a prior call (or terminal) — idempotent no-op.
      return this.subscriptionCheckoutRepo.findById(checkout.id);
    }

    // ── 2. Activate/replace the user's subscription ──────────────────────
    const now = new Date();
    const periodDays =
      settled.billingCycle === BillingCycle.YEARLY ? 365 : 30;
    const existing = await this.subscriptionRepo.findByUserId(settled.userId);
    const next: Subscription = {
      id: existing?.id ?? '', // assigned by the repository when creating
      userId: settled.userId,
      tier: settled.tier,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: settled.billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + periodDays * MS_PER_DAY),
      cancelAtPeriodEnd: false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const subscription = existing
      ? (await this.subscriptionRepo.update(next)) ?? next
      : await this.subscriptionRepo.save(next);

    // ── 3. Redeem the coupon (global cap + per-user slot) ────────────────
    if (settled.couponId) {
      // Single authoritative global-limit gate; null when the cap was reached
      // since the checkout was quoted (rare) — the activation still stands.
      const bumped = await this.couponRepo.incrementRedemptionIfUnderLimit(
        settled.couponId
      );
      if (!bumped) {
        logger.warn(
          { couponId: settled.couponId, checkoutId: settled.id, reference },
          'subscription settled but coupon was already at its global limit'
        );
      }
      const redemption =
        await this.couponRedemptionRepo.findByProviderRef(reference);
      if (redemption) {
        await this.couponRedemptionRepo.markConsumed(redemption.id);
        await this.couponRedemptionRepo.attachSubscription(
          redemption.id,
          subscription.id
        );
      }
    }

    // ── 4. One-time affiliate commission (best-effort, idempotent) ───────
    if (this.affiliateCommissionService) {
      try {
        await this.affiliateCommissionService.recordSubscriptionCommission({
          payingUserId: settled.userId,
          chargedAmount: settled.finalAmount,
          currency: settled.currency,
          sourceRef: reference,
        });
      } catch (error) {
        logger.error(
          { err: error, checkoutId: settled.id, reference },
          'failed to record affiliate subscription commission'
        );
      }
    }

    return settled;
  }
}
