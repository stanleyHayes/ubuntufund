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
import { roundToCurrency } from '../../domain/value-objects/Money.js';
import type {
  AffiliateCodePricing,
  AffiliateCodeQuote,
} from '../services/AffiliateCodePricing.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** Platform billing currency; subscription plan prices are quoted in GHS. */
const DEFAULT_CURRENCY = 'GHS';

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
    private readonly planService: PlanService,
    /**
     * Optional: lets an affiliate's referral code act as a discount code.
     * Absent (or with a zero discount configured), an unknown code stays
     * unknown and the behaviour is exactly what it was.
     */
    private readonly affiliateCodePricing?: AffiliateCodePricing
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
    const baseAmount = roundToCurrency(
      billingCycle === BillingCycle.YEARLY
        ? plan.priceYearly
        : plan.priceMonthly,
      DEFAULT_CURRENCY
    );

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // ── Price it (with a coupon when supplied; 422 propagates on invalid) ──
    let discountAmount = 0;
    let finalAmount = roundToCurrency(baseAmount, DEFAULT_CURRENCY);
    let currency = DEFAULT_CURRENCY;
    let couponId: string | undefined;
    let couponCode: string | undefined;
    /** Carried from the priced coupon so the seat claim below knows the cap. */
    let perUserLimit: number | undefined;
    /** Set instead when the code turned out to be an affiliate's, not a coupon's. */
    let affiliateCode: AffiliateCodeQuote | null = null;
    if (input.couponCode?.trim()) {
      try {
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
        perUserLimit = pricing.coupon.perUserLimit;
      } catch (err) {
        // Not a coupon? It may be an affiliate's referral code. One box, one
        // code: the referee gets the discount and the referrer still earns.
        //
        // Only a genuinely unknown code falls through. A coupon that exists but
        // was refused — expired, exhausted, wrong plan — must keep its own
        // message, or a customer sees "invalid code" for a coupon that is
        // merely out of date.
        const unknownCode =
          err instanceof AppError && err.message === 'Coupon not found';
        const quote = unknownCode
          ? await this.affiliateCodePricing?.quote(
              input.couponCode,
              userId,
              baseAmount,
              currency
            )
          : null;
        if (!quote) throw err;

        discountAmount = quote.discountAmount;
        finalAmount = quote.finalAmount;
        affiliateCode = quote;
      }
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

    // Attribution for an affiliate code, written before the charge opens so the
    // commission can be credited when settlement runs. Best-effort by design:
    // a payment must not fail because an attribution row could not be written.
    if (affiliateCode && this.affiliateCodePricing) {
      await this.affiliateCodePricing.attachReferral(
        affiliateCode.affiliateId,
        userId,
        affiliateCode.code
      );
    }

    let redemption: CouponRedemption | undefined;
    if (couponId && couponCode) {
      // No counter increment yet — the coupon's global count only moves when the
      // charge settles.
      // createWithSeat, not create: the per-user cap was checked by a count in
      // CouponService, and a count is a read. Two checkouts submitted together
      // both saw room. The seat is claimed through a unique index here, so only
      // one of them can actually take the last one.
      redemption =
        (await this.couponRedemptionRepo.createWithSeat(
          {
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
          },
          perUserLimit
        )) ?? undefined;

      if (!redemption) {
        // Lost the race for the last seat. Fail the checkout rather than let the
        // charge open: the alternative is taking money at a discounted price the
        // user was no longer entitled to.
        await this.subscriptionCheckoutRepo.transitionToFailed(checkout.id);
        throw new AppError(
          'You have already used this coupon the maximum number of times',
          422
        );
      }
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
      // The plan's own currency, not the platform default: without it the
      // charge was scaled and labelled GHS whatever the plan was priced in.
      currency,
      referencePrefix: 'sub',
      callbackPath: `/subscription/callback?checkout=${encodeURIComponent(checkout.id)}`,
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
