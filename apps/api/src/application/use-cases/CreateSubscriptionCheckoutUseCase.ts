import { randomUUID } from 'node:crypto';
import {
  BillingCycle,
  CouponRedemptionStatus,
  SubscriptionCheckoutStatus,
  SubscriptionTier,
  type CouponRedemption,
  type CreateSubscriptionCheckoutInput,
  type SubscriptionCheckoutResult,
} from '@ubuntu-fund/types';
import type { SubscriptionCheckoutRepositoryPort } from '../../domain/ports/outbound/SubscriptionCheckoutRepositoryPort.js';
import type { CouponRedemptionRepositoryPort } from '../../domain/ports/outbound/CouponRedemptionRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import type { CouponService } from '../services/CouponService.js';
import type { PlanService } from '../services/PlanService.js';
import type { SettleSubscriptionUseCase } from './SettleSubscriptionUseCase.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** Platform billing currency; subscription plan prices are quoted in GHS. */
const DEFAULT_CURRENCY = 'GHS';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Opens a paid-subscription checkout for the authenticated user — the
 * coordination point where pricing, coupons, the Paystack rail, and (later)
 * the affiliate commission all meet. Mirrors {@link CreateDonationIntentUseCase}.
 *
 * - Quotes the plan's list price for the chosen tier + billing cycle, applying a
 *   coupon when supplied (an invalid coupon aborts with 422 before any charge).
 * - Persists a PENDING {@link SubscriptionCheckout} plus, for a coupon, a
 *   provisional PENDING redemption slot (the global counter is only bumped at
 *   settlement).
 * - When a coupon zeroes the price, activates the subscription immediately via
 *   {@link SettleSubscriptionUseCase} with NO Paystack charge.
 * - Otherwise opens a Paystack hosted checkout and returns the authorization URL;
 *   the signed webhook settles it later.
 */
export class CreateSubscriptionCheckoutUseCase {
  constructor(
    private readonly subscriptionCheckoutRepo: SubscriptionCheckoutRepositoryPort,
    private readonly couponRedemptionRepo: CouponRedemptionRepositoryPort,
    private readonly userRepo: UserRepositoryPort,
    private readonly couponService: CouponService,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly settleSubscriptionUseCase: SettleSubscriptionUseCase,
    private readonly planService: PlanService
  ) {}

  async execute(
    input: CreateSubscriptionCheckoutInput,
    userId: string
  ): Promise<SubscriptionCheckoutResult> {
    // The paid-subscription rail is Paystack-backed; a coupon-zeroed activation
    // still requires the billing rail to be configured as a precondition.
    if (!this.paymentGateway.isConfigured()) {
      throw new AppError('Payments are not configured', 501);
    }

    const { tier, billingCycle } = input;
    if (tier === SubscriptionTier.FREE) {
      throw new AppError(
        'The free tier has no paid checkout; select it via POST /subscriptions',
        400
      );
    }

    // Price from the DB-backed plan (admin-editable), with the code defaults as
    // the safe fallback baked into PlanService.
    const plan = await this.planService.getPlan(tier);
    // Tier ids are free-form (admins can add tiers), so validate the requested
    // tier resolves to a REAL, active plan — getPlan falls back to the free plan
    // for an unknown tier, so a mismatch means the tier does not exist. This stops
    // a client self-activating an arbitrary/inactive tier for free.
    if (plan.tier !== tier || plan.active === false) {
      throw new AppError('That subscription plan is not available', 400);
    }
    const baseAmount = round2(
      billingCycle === BillingCycle.YEARLY
        ? plan.priceYearly
        : plan.priceMonthly
    );

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // ── Price it (with a coupon when supplied; 422 propagates on invalid) ──
    let discountAmount = 0;
    let finalAmount = round2(baseAmount);
    let currency = DEFAULT_CURRENCY;
    let couponId: string | undefined;
    let couponCode: string | undefined;
    if (input.couponCode?.trim()) {
      const pricing = await this.couponService.validateAndPrice({
        code: input.couponCode,
        tier,
        billingCycle,
        userId,
        baseAmount,
      });
      discountAmount = pricing.discountAmount;
      finalAmount = pricing.finalAmount;
      currency = pricing.currency;
      couponId = pricing.coupon.id;
      couponCode = pricing.coupon.code;
    }

    const preview = { baseAmount, discountAmount, finalAmount, currency };

    // ── Persist the PENDING checkout + provisional redemption slot ────────
    const now = new Date();
    const checkout = await this.subscriptionCheckoutRepo.create({
      id: '', // assigned by the repository
      userId,
      tier,
      billingCycle,
      status: SubscriptionCheckoutStatus.PENDING,
      baseAmount,
      discountAmount,
      finalAmount,
      currency,
      couponId,
      couponCode,
      createdAt: now,
      updatedAt: now,
    });

    let redemption: CouponRedemption | undefined;
    if (couponId && couponCode) {
      // No counter increment yet — the coupon's global count only moves when the
      // charge settles.
      redemption = await this.couponRedemptionRepo.create({
        id: '',
        couponId,
        code: couponCode,
        userId,
        checkoutId: checkout.id,
        tier,
        billingCycle,
        status: CouponRedemptionStatus.PENDING,
        baseAmount,
        discountAmount,
        finalAmount,
        currency,
        createdAt: now,
        updatedAt: now,
      });
    }

    // ── Coupon-zeroed: activate immediately, no Paystack charge ───────────
    if (finalAmount === 0) {
      // A synthetic reference correlates the inline settlement (and its coupon
      // slot) exactly as a Paystack reference would on the webhook rail.
      const reference = `sub_free_${randomUUID()}`;
      const withRef =
        (await this.subscriptionCheckoutRepo.setProviderRef(
          checkout.id,
          reference
        )) ?? checkout;
      if (redemption) {
        await this.couponRedemptionRepo.setProviderRef(redemption.id, reference);
      }
      const activated = await this.settleSubscriptionUseCase.execute(
        withRef,
        reference
      );
      return {
        checkout: activated ?? withRef,
        activatedWithoutCharge: true,
        preview,
      };
    }

    // ── Paystack rail: open the hosted checkout, store the reference ───────
    const init = await this.paymentGateway.initializeCharge({
      email: user.email.value,
      amount: finalAmount,
      referencePrefix: 'sub',
      callbackPath: '/subscription/callback',
      metadata: { checkoutId: checkout.id, userId, tier, billingCycle, couponId },
    });

    const withRef =
      (await this.subscriptionCheckoutRepo.setProviderRef(
        checkout.id,
        init.reference
      )) ?? checkout;
    if (redemption) {
      await this.couponRedemptionRepo.setProviderRef(
        redemption.id,
        init.reference
      );
    }

    return {
      checkout: withRef,
      authorizationUrl: init.authorizationUrl,
      accessCode: init.accessCode,
      reference: init.reference,
      preview,
    };
  }
}
