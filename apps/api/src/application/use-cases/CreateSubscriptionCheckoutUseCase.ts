import { randomUUID } from 'node:crypto';
import {
  BillingCycle,
  CouponRedemptionStatus,
  type CouponCommissionBase,
  CouponSurface,
  SubscriptionCheckoutStatus,
  SubscriptionTier,
  type CouponRedemption,
  type CreateSubscriptionCheckoutInput,
  type SubscriptionCheckout,
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
import type { BillingOwnershipPort } from '../../domain/ports/outbound/BillingOwnershipPort.js';
import type { SubscriptionRepositoryPort } from '../../domain/ports/outbound/SubscriptionRepositoryPort.js';
import { SubscriptionCheckoutResolver, type CheckoutResolution } from '../services/SubscriptionCheckoutResolver.js';
import { isPaidPlanInForce } from '../../domain/services/subscriptionStatus.js';

/** Platform billing currency; subscription plan prices are quoted in GHS. */
const DEFAULT_CURRENCY = 'GHS';

/**
 * A checkout opened less than this long ago may still be paid in the Paystack
 * window the member left open, so a second charge is not opened over it: the
 * same request resumes its payment page, and a different one is refused until
 * the member cancels it (POST /subscriptions/checkout/:id/abandon). Older
 * unpaid (abandoned) checkouts are expired to make way.
 */
const OPEN_CHECKOUT_HOLD_MS = 60 * 60 * 1000;

/** Coupon and affiliate codes are matched case-insensitively. */
const sameCode = (a?: string, b?: string) =>
  (a?.trim().toUpperCase() || undefined) === (b?.trim().toUpperCase() || undefined);

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
    private readonly billingOwnership: BillingOwnershipPort,
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
    private readonly affiliateCodePricing?: AffiliateCodePricing,
    /** The member's current plan, so a purchase never silently discards paid time. */
    private readonly subscriptionRepo?: SubscriptionRepositoryPort
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
    // Enterprise and internal (non-public) plans are negotiated, never bought
    // self-serve at the list price. Mirrors the store rail's isPublic check.
    if (plan.isPublic === false || tier === SubscriptionTier.ENTERPRISE) {
      throw new AppError('This plan is arranged through our sales team. Contact sales@ujimora.com.', 403);
    }
    const baseAmount = roundToCurrency(
      billingCycle === BillingCycle.YEARLY
        ? plan.priceYearly
        : plan.priceMonthly,
      DEFAULT_CURRENCY
    );
    // A zero price means that cycle is not offered for a paid plan. Without this
    // the no-charge branch below would activate it for free for anyone; a
    // coupon or affiliate code that zeroes a positive price still works.
    if (!(baseAmount > 0)) {
      throw new AppError('That billing cycle is not available for this plan', 400);
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // ── Never open a second charge over an unresolved or active purchase ──
    const resumable = await this.resolveOpenCheckouts(userId, input);
    await this.assertCanBuyOverCurrentPlan(userId, tier, plan.name, input.replaceCurrentPlan === true);
    if (resumable) {
      // The member backed out of this exact purchase and asked again: send them
      // back to the payment page they already have instead of a second charge.
      return {
        checkout: resumable,
        authorizationUrl: resumable.authorizationUrl,
        accessCode: resumable.accessCode,
        reference: resumable.providerRef,
        resumed: true,
        preview: {
          baseAmount: resumable.baseAmount,
          discountAmount: resumable.discountAmount,
          finalAmount: resumable.finalAmount,
          currency: resumable.currency,
        },
      };
    }

    // ── Price it (with a coupon when supplied; 422 propagates on invalid) ──
    let discountAmount = 0;
    let finalAmount = roundToCurrency(baseAmount, DEFAULT_CURRENCY);
    let currency = DEFAULT_CURRENCY;
    let couponId: string | undefined;
    let couponCode: string | undefined;
    /** Carried from the priced coupon so the seat claim below knows the cap. */
    let perUserLimit: number | undefined;
    /** Snapshot so settlement never depends on the coupon still existing. */
    let commissionBase: CouponCommissionBase | undefined;
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
        commissionBase = pricing.coupon.commissionBase;
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
        // Record the code even though there is no coupon record behind it.
        // Without it the checkout persists a non-zero discountAmount attached
        // to nothing, and neither the admin console nor finance can say where
        // the money went. couponId stays unset on purpose — settlement keys
        // coupon redemption off it, and this is not a coupon.
        couponCode = quote.code;
      }
    }

    const preview = { baseAmount, discountAmount, finalAmount, currency };

    // ── Persist the PENDING checkout + provisional redemption slot ────────
    await this.billingOwnership.claimProvider(userId, 'web');
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
      commissionBase,
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
            // Without this, "no surface" would mean both "written before
            // surfaces existed" and "a current subscription redemption", and a
            // query for SUBSCRIPTION rows would return nothing.
            surface: CouponSurface.SUBSCRIPTION,
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
    let init: Awaited<ReturnType<PaymentGatewayPort['initializeCharge']>>;
    try {
      init = await this.paymentGateway.initializeCharge({
        email: user.email.value,
        amount: finalAmount,
        // The plan's own currency, not the platform default: without it the
        // charge was scaled and labelled GHS whatever the plan was priced in.
        currency,
        referencePrefix: 'sub',
        callbackPath: `/subscription/callback?checkout=${encodeURIComponent(checkout.id)}`,
        metadata: { checkoutId: checkout.id, userId, tier, billingCycle, couponId },
      });
    } catch (error) {
      // The member never received a payment page, so nothing can be paid on
      // this checkout. Close it (and free its coupon seat) so an immediate
      // retry is not refused as "a payment in progress".
      await new SubscriptionCheckoutResolver(
        this.subscriptionCheckoutRepo, this.paymentGateway, this.settleSubscriptionUseCase, this.couponRedemptionRepo
      ).expire(checkout);
      throw error;
    }

    const withRef =
      (await this.subscriptionCheckoutRepo.setProviderRef(
        checkout.id,
        init.reference,
        { authorizationUrl: init.authorizationUrl, accessCode: init.accessCode }
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

  /**
   * Settle, fail or expire the member's earlier PENDING checkouts before a new
   * charge opens. A paid one (webhook still in flight) is activated and the new
   * purchase refused; an abandoned older one is expired, freeing its coupon
   * seat. One that could still be paid — opened within the last hour, or still
   * processing — is returned for resuming when it is this same purchase (plan,
   * cycle and code) with a payment page to go back to; any other open one
   * refuses the new purchase, naming the checkout so the member can cancel it.
   */
  private async resolveOpenCheckouts(
    userId: string,
    input: CreateSubscriptionCheckoutInput
  ): Promise<SubscriptionCheckout | null> {
    const open = await this.subscriptionCheckoutRepo.findPendingByUser(userId, 5);
    if (!open.length) return null;
    const resolver = new SubscriptionCheckoutResolver(
      this.subscriptionCheckoutRepo, this.paymentGateway, this.settleSubscriptionUseCase, this.couponRedemptionRepo
    );
    let resumable: SubscriptionCheckout | null = null;
    for (const checkout of open) {
      let outcome: CheckoutResolution;
      try {
        outcome = await resolver.resolve(checkout, { expireUnpaidAfterMs: OPEN_CHECKOUT_HOLD_MS });
      } catch {
        // We cannot tell whether that earlier payment went through, so opening
        // another charge now could take the money twice.
        throw new AppError(
          'We could not confirm your earlier plan payment. Check its status on your subscription page before starting another payment.',
          409,
          { checkoutId: [checkout.id] }
        );
      }
      if (outcome === 'settled') {
        throw new AppError(
          'Your earlier plan payment went through and that plan is now active. Review your subscription before buying again.',
          409,
          { checkoutId: [checkout.id] }
        );
      }
      if (outcome !== 'pending') continue;
      const samePurchase = !resumable && !!checkout.authorizationUrl &&
        checkout.tier === input.tier && checkout.billingCycle === input.billingCycle &&
        sameCode(checkout.couponCode, input.couponCode);
      if (samePurchase) {
        resumable = checkout;
        continue;
      }
      throw new AppError(
        'You already have a plan payment in progress. Finish it in the payment window, or cancel it before starting another.',
        409,
        // The code lets the client offer "cancel it and continue" (…/abandon).
        { checkoutId: [checkout.id], code: ['checkout_in_progress'] }
      );
    }
    return resumable;
  }

  /**
   * Buying the plan you already have extends it (see SettleSubscriptionUseCase).
   * Buying a DIFFERENT plan while one is still in force replaces it straight away
   * and the unused time is not credited — so it needs the member's explicit
   * confirmation. Store-billed plans are left to the billing-rail claim, which
   * refuses them with the store-specific message.
   */
  private async assertCanBuyOverCurrentPlan(
    userId: string,
    tier: string,
    planName: string,
    replaceCurrentPlan: boolean
  ): Promise<void> {
    if (!this.subscriptionRepo) return;
    const current = await this.subscriptionRepo.findByUserId(userId);
    if (!current || !isPaidPlanInForce(current) || current.tier === tier) return;
    if (current.billingProvider === 'apple' || current.billingProvider === 'google') return;
    if (replaceCurrentPlan) return;
    const currentPlan = await this.planService.getPlan(current.tier);
    const until = new Date(current.currentPeriodEnd).toISOString().slice(0, 10);
    throw new AppError(
      `Your ${currentPlan.name} plan is active until ${until}. Buying ${planName} now replaces it straight away, and unused time is not refunded or credited. Confirm the switch to continue.`,
      409,
      { code: ['replace_current_plan'] }
    );
  }
}
