import type { SubscriptionTier, BillingCycle } from '@ubuntu-fund/types';
import type { CouponEntity } from '../../domain/entities/Coupon.js';
import type { CouponRepositoryPort } from '../../domain/ports/outbound/CouponRepositoryPort.js';
import type { CouponRedemptionRepositoryPort } from '../../domain/ports/outbound/CouponRedemptionRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ValidateAndPriceInput {
  /** Raw code from the client; matched UPPERCASE. */
  code: string;
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
  /** The redeeming user, for the per-user limit. */
  userId: string;
  /** The plan's list price (GHS major units) before any discount. */
  baseAmount: number;
}

export interface CouponPricing {
  coupon: CouponEntity;
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  currency: string;
}

/**
 * Validates a coupon against a paid-subscription checkout and quotes the
 * discounted price. Every rejection throws an {@link AppError} with 422 and a
 * human-readable reason: the checkout use-case lets it propagate (aborting the
 * charge), while the preview use-case catches it and maps the message onto a
 * soft `CouponPreview{ valid:false, reason }`.
 *
 * Money is in GHS major units. The global cap is enforced authoritatively at
 * settlement by the coupon's atomic `incrementRedemptionIfUnderLimit`; the
 * `isUnderGlobalLimit` check here is only a fast pre-flight against the snapshot
 * count, so a full coupon is rejected before a Paystack charge is ever created.
 */
export class CouponService {
  constructor(
    private readonly couponRepo: CouponRepositoryPort,
    private readonly redemptionRepo: CouponRedemptionRepositoryPort
  ) {}

  async validateAndPrice(input: ValidateAndPriceInput): Promise<CouponPricing> {
    const { tier, billingCycle, userId, baseAmount } = input;
    const code = input.code.trim().toUpperCase();

    const coupon = await this.couponRepo.findByCode(code);
    if (!coupon) {
      throw new AppError('Coupon not found', 422);
    }

    const now = new Date();
    if (!coupon.active) {
      throw new AppError('This coupon is no longer active', 422);
    }
    if (coupon.validFrom && now < coupon.validFrom) {
      throw new AppError('This coupon is not valid yet', 422);
    }
    if (coupon.validUntil && now > coupon.validUntil) {
      throw new AppError('This coupon has expired', 422);
    }

    if (
      coupon.appliesToTiers.length > 0 &&
      !coupon.appliesToTiers.includes(tier)
    ) {
      throw new AppError('This coupon does not apply to the selected plan', 422);
    }
    if (
      coupon.appliesToBillingCycles.length > 0 &&
      !coupon.appliesToBillingCycles.includes(billingCycle)
    ) {
      throw new AppError(
        'This coupon does not apply to the selected billing cycle',
        422
      );
    }

    if (!coupon.meetsMinSubtotal(baseAmount)) {
      throw new AppError(
        `This coupon requires a minimum subtotal of ${coupon.minSubtotal} ${coupon.currency}`,
        422
      );
    }

    if (!coupon.isUnderGlobalLimit()) {
      throw new AppError('This coupon has reached its redemption limit', 422);
    }

    if (coupon.perUserLimit) {
      const used = await this.redemptionRepo.countByCouponAndUser(
        coupon.id,
        userId
      );
      if (used >= coupon.perUserLimit) {
        throw new AppError(
          'You have already used this coupon the maximum number of times',
          422
        );
      }
    }

    const discountAmount = coupon.computeDiscount(baseAmount);
    const finalAmount = round2(baseAmount - discountAmount);

    return {
      coupon,
      baseAmount: round2(baseAmount),
      discountAmount,
      finalAmount,
      currency: coupon.currency,
    };
  }
}
