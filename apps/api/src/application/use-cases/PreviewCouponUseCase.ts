import {
  BillingCycle,
  CouponSurface,
  type CouponPreview,
  type CouponValidationInput,
} from '@ubuntu-fund/types';
import type { CouponService } from '../services/CouponService.js';
import type { PlanService } from '../services/PlanService.js';
import { roundToCurrency } from '../../domain/value-objects/Money.js';
import type { AffiliateCodePricing } from '../services/AffiliateCodePricing.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** The platform's only settlement currency, and the one plan prices are in. */
const CURRENCY = 'GHS';

/**
 * Quote a coupon against a paid-plan checkout without charging anything: resolve
 * the plan's list price for the chosen tier + billing cycle, then defer to
 * {@link CouponService.validateAndPrice}. This is a *soft* endpoint — every
 * rejection (an invalid, expired, exhausted, or inapplicable coupon) is caught
 * and mapped onto `{ valid: false, reason }`, so it never throws.
 */
export class PreviewCouponUseCase {
  constructor(
    private readonly couponService: CouponService,
    private readonly planService: PlanService,
    /**
     * Must be the same instance the checkout uses. The preview exists to tell
     * the customer what they will pay, so anything checkout would accept has
     * to quote here too — an affiliate code that previews as "not found" and
     * then works at checkout is worse than not previewing at all.
     */
    private readonly affiliateCodePricing?: AffiliateCodePricing,
    /** Resolves a campaign's platform fee, for quoting a donation waiver. */
    private readonly planLimits?: { platformFeePercentForCampaign(id: string): Promise<number> }
  ) {}

  /** A soft rejection, in the shape this endpoint always answers with. */
  private invalid(code: string, baseAmount: number, reason: string): CouponPreview {
    return {
      valid: false,
      code,
      baseAmount,
      discountAmount: 0,
      finalAmount: baseAmount,
      currency: CURRENCY,
      reason,
    };
  }

  async execute(
    input: CouponValidationInput,
    userId: string
  ): Promise<CouponPreview> {
    const code = input.code.trim().toUpperCase();
    const surface = input.surface ?? CouponSurface.SUBSCRIPTION;

    // What the coupon is quoted against differs by surface: a subscription
    // discounts its plan price, a donation discounts only the platform fee —
    // never the gift itself. Quoting a donation against the gift would show the
    // donor a saving they do not get and the campaign does not want.
    let baseAmount: number;
    if (surface === CouponSurface.DONATION) {
      if (!input.campaignId || !(input.amount && input.amount > 0)) {
        return this.invalid(code, 0, 'A campaign and amount are required');
      }
      const feePercent = this.planLimits
        ? await this.planLimits.platformFeePercentForCampaign(input.campaignId)
        : 0;
      baseAmount = roundToCurrency((input.amount * feePercent) / 100, CURRENCY);
      if (baseAmount <= 0) {
        return this.invalid(code, 0, 'There is no platform fee on this donation to waive');
      }
    } else {
      // Base price from the DB-backed plan so the preview matches what checkout
      // will charge (PlanService falls back to the code defaults).
      const plan = await this.planService.getPlan(input.tier ?? '');
      baseAmount = roundToCurrency(
        input.billingCycle === BillingCycle.YEARLY ? plan.priceYearly : plan.priceMonthly,
        CURRENCY
      );
    }

    try {
      const pricing = await this.couponService.validateAndPrice({
        code,
        tier: input.tier,
        billingCycle: input.billingCycle,
        userId,
        baseAmount,
        surface,
      });
      return {
        valid: true,
        code: pricing.coupon.code,
        discountType: pricing.coupon.discountType,
        baseAmount: pricing.baseAmount,
        discountAmount: pricing.discountAmount,
        finalAmount: pricing.finalAmount,
        currency: pricing.currency,
      };
    } catch (err) {
      // Mirror the checkout's fallback exactly: an unknown code may be an
      // affiliate's referral code, which discounts just the same.
      // An affiliate code discounts a subscription, never a donation fee, so
      // the fallback belongs to that surface only.
      const unknownCode =
        err instanceof AppError &&
        err.message === 'Coupon not found' &&
        surface === CouponSurface.SUBSCRIPTION;
      if (unknownCode && this.affiliateCodePricing) {
        try {
          const quote = await this.affiliateCodePricing.quote(
            code,
            userId,
            baseAmount,
            CURRENCY
          );
          if (quote) {
            return {
              valid: true,
              code: quote.code,
              baseAmount,
              discountAmount: quote.discountAmount,
              finalAmount: quote.finalAmount,
              currency: CURRENCY,
            };
          }
        } catch {
          // This endpoint's whole contract is that it never throws — callers
          // render `valid: false` rather than handling an error. A database
          // blip inside the affiliate lookup must degrade to "no discount",
          // not 500 a page that was only quoting a price.
        }
      }

      const reason =
        err instanceof AppError
          ? err.message
          : 'This coupon could not be applied';
      return {
        valid: false,
        code,
        baseAmount,
        discountAmount: 0,
        finalAmount: baseAmount,
        currency: CURRENCY,
        reason,
      };
    }
  }
}
