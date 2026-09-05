import {
  BillingCycle,
  SUBSCRIPTION_PLANS,
  type CouponPreview,
  type CouponValidationInput,
} from '@ubuntu-fund/types';
import type { CouponService } from '../services/CouponService.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** The platform's only settlement currency. */
const CURRENCY = 'GHS';

/** Round to 2 decimal places (money is in GHS major units). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Quote a coupon against a paid-plan checkout without charging anything: resolve
 * the plan's list price for the chosen tier + billing cycle, then defer to
 * {@link CouponService.validateAndPrice}. This is a *soft* endpoint — every
 * rejection (an invalid, expired, exhausted, or inapplicable coupon) is caught
 * and mapped onto `{ valid: false, reason }`, so it never throws.
 */
export class PreviewCouponUseCase {
  constructor(private readonly couponService: CouponService) {}

  async execute(
    input: CouponValidationInput,
    userId: string
  ): Promise<CouponPreview> {
    const code = input.code.trim().toUpperCase();
    const plan = SUBSCRIPTION_PLANS[input.tier];
    const baseAmount = round2(
      plan
        ? input.billingCycle === BillingCycle.YEARLY
          ? plan.priceYearly
          : plan.priceMonthly
        : 0
    );

    try {
      const pricing = await this.couponService.validateAndPrice({
        code,
        tier: input.tier,
        billingCycle: input.billingCycle,
        userId,
        baseAmount,
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
