import {
  BillingCycle,
  type CouponPreview,
  type CouponValidationInput,
} from '@ubuntu-fund/types';
import type { CouponService } from '../services/CouponService.js';
import type { PlanService } from '../services/PlanService.js';
import { roundToCurrency } from '../../domain/value-objects/Money.js';
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
    private readonly planService: PlanService
  ) {}

  async execute(
    input: CouponValidationInput,
    userId: string
  ): Promise<CouponPreview> {
    const code = input.code.trim().toUpperCase();
    // Base price from the DB-backed plan so the preview matches what checkout
    // will charge (PlanService falls back to the code defaults).
    const plan = await this.planService.getPlan(input.tier);
    const baseAmount = roundToCurrency(
      input.billingCycle === BillingCycle.YEARLY
        ? plan.priceYearly
        : plan.priceMonthly,
      CURRENCY
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
