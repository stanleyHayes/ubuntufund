import {
  BillingCycle,
  CouponCommissionBase,
  SubscriptionStatus,
  type SubscriptionCheckout,
} from '@ubuntu-fund/types';
import type { SubscriptionCheckoutRepositoryPort } from '../../domain/ports/outbound/SubscriptionCheckoutRepositoryPort.js';
import type { SubscriptionRecord, SubscriptionRepositoryPort } from '../../domain/ports/outbound/SubscriptionRepositoryPort.js';
import type { CouponRepositoryPort } from '../../domain/ports/outbound/CouponRepositoryPort.js';
import type { CouponRedemptionRepositoryPort } from '../../domain/ports/outbound/CouponRedemptionRepositoryPort.js';
import type { AffiliateCommissionService } from '../services/AffiliateCommissionService.js';
import { logger } from '../../infrastructure/logging/logger.js';
import type { UnitOfWorkPort } from '../../domain/ports/outbound/UnitOfWorkPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { isPaidPlanInForce } from '../../domain/services/subscriptionStatus.js';

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
 *   2. Upsert the user's Subscription to the paid tier, ACTIVE. A fresh period
 *      starts now — unless the member bought the web plan they already have
 *      while it is still running, in which case the new period is added to the
 *      end of the current one (early renewal, or a duplicate payment, never
 *      throws paid days away).
 *   3. If the checkout carried a coupon: bump the coupon's global redemption
 *      counter (atomic, under-cap), then CONSUME the provisional redemption slot
 *      and link it to the activated subscription.
 *   4. Award the one-time affiliate commission.
 *
 * All database effects run in one transaction. A failure rolls the gate back,
 * so verification/webhook retry can recover without repeating committed effects.
 * External payments and notifications must never run inside this transaction.
 */
export class SettleSubscriptionUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWorkPort,
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
    return this.unitOfWork.run(() => this.settle(checkout, reference));
  }

  private async settle(
    checkout: SubscriptionCheckout,
    reference: string
  ): Promise<SubscriptionCheckout | null> {
    // ── 1. Exactly-once settlement gate ──────────────────────────────────
    const settled = await this.subscriptionCheckoutRepo.transitionToSucceeded(
      checkout.id
    );
    if (!settled) {
      // Already settled by a prior call (or terminal) — idempotent no-op.
      const existing = await this.subscriptionCheckoutRepo.findById(checkout.id);
      if (existing && existing.providerRef !== reference) throw new AppError('Subscription payment reference does not match.', 409);
      return existing;
    }
    if (settled.providerRef !== reference) throw new AppError('Subscription payment reference does not match.', 409);

    // ── 2. Activate/replace the user's subscription ──────────────────────
    const now = new Date();
    const periodDays =
      settled.billingCycle === BillingCycle.YEARLY ? 365 : 30;
    const existing = await this.subscriptionRepo.findByUserId(settled.userId);
    const extendsCurrent = !!existing && existing.tier === settled.tier &&
      existing.status === SubscriptionStatus.ACTIVE && isPaidPlanInForce(existing, now) &&
      existing.billingProvider !== 'apple' && existing.billingProvider !== 'google';
    const periodStart = extendsCurrent ? new Date(existing.currentPeriodStart) : now;
    const periodBase = extendsCurrent ? new Date(existing.currentPeriodEnd).getTime() : now.getTime();
    const next: SubscriptionRecord = {
      id: existing?.id ?? '', // assigned by the repository when creating
      userId: settled.userId,
      tier: settled.tier,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: settled.billingCycle,
      currentPeriodStart: periodStart,
      currentPeriodEnd: new Date(periodBase + periodDays * MS_PER_DAY),
      cancelAtPeriodEnd: false,
      // Which charges paid for this period, so a refund removes exactly its time.
      paymentReferences: extendsCurrent ? [...(existing.paymentReferences ?? []), reference] : [reference],
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
        // Two different situations; say which, so finance is not misled.
        const stillExists = await this.couponRepo.findById(settled.couponId);
        logger.warn(
          { couponId: settled.couponId, checkoutId: settled.id, reference },
          stillExists
            ? 'subscription settled but coupon was already at its global limit'
            : 'subscription settled but its coupon no longer exists'
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

    // ── 4. One-time affiliate commission (same transaction) ─────────────
    //
    // Which amount the commission is computed from is the coupon's choice.
    // Charging it on finalAmount protects margin but penalises a referrer for
    // a promotion they did not control — and a 100%-off coupon pays them
    // nothing at all while still spending their one-time conversion. A coupon
    // may instead elect LIST_PRICE and make the referrer whole. Absent a
    // coupon, the post-coupon amount stands. A failed lookup must retry the
    // transaction; silently changing the commission basis loses owed funds.
    let commissionBaseAmount = settled.finalAmount;

    // A discount with no coupon behind it came from the affiliate's own
    // referral code. The platform sets that percentage, so the platform funds
    // it: paying the referrer less precisely for sharing the code they were
    // asked to share would quietly discourage the whole mechanism. Commission
    // is computed on the undiscounted price.
    if (!settled.couponId && settled.discountAmount > 0) {
      commissionBaseAmount = settled.baseAmount;
    }

    if (settled.couponId) {
      // The basis quoted with the checkout wins; older checkouts fall back to
      // the live coupon. A coupon deleted before this change can no longer be
      // read: retrying would never help and would leave a paid plan inactive,
      // so the default (post-coupon) basis applies and is flagged for finance.
      let basis = settled.commissionBase;
      if (!basis) {
        const coupon = await this.couponRepo.findById(settled.couponId);
        basis = coupon?.commissionBase;
        if (!coupon) {
          logger.error(
            { couponId: settled.couponId, checkoutId: settled.id, reference },
            'coupon missing at settlement; affiliate commission used the post-coupon amount'
          );
        }
      }
      if (basis === CouponCommissionBase.LIST_PRICE) {
        commissionBaseAmount = settled.baseAmount;
      }
    }

    if (this.affiliateCommissionService) {
      await this.affiliateCommissionService.recordSubscriptionCommission({
        payingUserId: settled.userId,
        chargedAmount: commissionBaseAmount,
        currency: settled.currency,
        sourceRef: reference,
      });
    }

    return settled;
  }
}
