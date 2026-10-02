import { CouponRedemptionStatus, CouponSurface, type BillingCycle } from '@ubuntu-fund/types';
import type { CouponEntity } from '../../domain/entities/Coupon.js';
import type { CouponRepositoryPort } from '../../domain/ports/outbound/CouponRepositoryPort.js';
import type { CouponRedemptionRepositoryPort } from '../../domain/ports/outbound/CouponRedemptionRepositoryPort.js';
import type { CouponEligibilityPort } from '../../domain/ports/outbound/CouponEligibilityPort.js';
import { roundToCurrency } from '../../domain/value-objects/Money.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface ValidateAndPriceInput {
  /** Raw code from the client; matched UPPERCASE. */
  code: string;
  /**
   * Subscription context, for tier/cycle scoping. Absent on other surfaces: a
   * withdrawal has no plan and no billing cycle, so a coupon's tier list
   * simply does not apply there rather than rejecting every redemption.
   */
  tier?: string;
  billingCycle?: BillingCycle;
  /** The redeeming user, for the per-user limit. */
  userId: string;
  /** The plan's list price (GHS major units) before any discount. */
  baseAmount: number;
  /**
   * Where the coupon is being redeemed. Defaults to SUBSCRIPTION, which is
   * what every caller meant before surfaces existed.
   */
  surface?: CouponSurface;
  /**
   * The member's own unpaid subscription checkouts whose coupon seats do not
   * count against the per-user limit. Checkout passes the open checkout whose
   * code it re-quotes, or a once-per-member coupon would be refused for the
   * very purchase that holds it. The preview passes every checkout the member
   * has open: no new charge opens while one is, so its seat is either this
   * purchase's own (resumed) or freed when the member cancels it. Only a
   * PENDING slot of this coupon and member is set aside, so a consumed use (a
   * settled payment) and anyone else's always count.
   */
  exceptCheckoutIds?: readonly string[];
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
    private readonly redemptionRepo: CouponRedemptionRepositoryPort,
    /**
     * Answers the targeting questions (is this a returning customer, what is
     * their email). Lives here rather than in the two callers so a preview and
     * the checkout it precedes can never disagree about eligibility.
     */
    private readonly eligibility: CouponEligibilityPort
  ) {}

  async validateAndPrice(input: ValidateAndPriceInput): Promise<CouponPricing> {
    const { tier, billingCycle, userId, baseAmount } = input;
    const code = input.code.trim().toUpperCase();

    const coupon = await this.couponRepo.findByCode(code);
    if (!coupon) {
      throw new AppError('Coupon not found', 422);
    }

    const surface = input.surface ?? CouponSurface.SUBSCRIPTION;
    if (!coupon.appliesToSurface(surface)) {
      throw new AppError('This coupon cannot be used here', 422);
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
      tier !== undefined &&
      coupon.appliesToTiers.length > 0 &&
      !coupon.appliesToTiers.includes(tier)
    ) {
      throw new AppError('This coupon does not apply to the selected plan', 422);
    }
    if (
      billingCycle !== undefined &&
      coupon.appliesToBillingCycles.length > 0 &&
      !coupon.appliesToBillingCycles.includes(billingCycle)
    ) {
      throw new AppError(
        'This coupon does not apply to the selected billing cycle',
        422
      );
    }

    // Targeting. Both queries are skipped entirely unless the coupon carries
    // the corresponding restriction, so an ordinary coupon costs nothing extra.
    if (coupon.allowedEmails.length > 0) {
      const email = await this.eligibility.emailFor(userId);
      if (!coupon.allowsEmail(email)) {
        throw new AppError('This coupon is not available on your account', 422);
      }
    }

    if (coupon.newUsersOnly && (await this.eligibility.hasPaidBefore(userId))) {
      throw new AppError('This coupon is for first-time subscribers only', 422);
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
      const used = await this.seatsHeld(coupon.id, userId, input.exceptCheckoutIds);
      if (used >= coupon.perUserLimit) {
        throw new AppError(
          'You have already used this coupon the maximum number of times',
          422
        );
      }
    }

    // Round to the quote's own currency (the coupon's) rather than a hardcoded
    // 2dp: identical for GHS, but keeps the quote representable in a 0- or
    // 3-decimal currency.
    const discountAmount = coupon.computeDiscount(baseAmount);
    const finalAmount = roundToCurrency(
      baseAmount - discountAmount,
      coupon.currency
    );

    return {
      coupon,
      baseAmount: roundToCurrency(baseAmount, coupon.currency),
      discountAmount,
      finalAmount,
      currency: coupon.currency,
    };
  }

  /**
   * The member's seats on the coupon (PENDING or CONSUMED slots), less the
   * slots `exceptCheckoutIds` hold. A slot is set aside only while it is a
   * PENDING slot of this coupon and this member, at most once: a paid use, a
   * freed slot and anyone else's are never set aside.
   */
  private async seatsHeld(couponId: string, userId: string, exceptCheckoutIds: readonly string[] = []): Promise<number> {
    const used = await this.redemptionRepo.countByCouponAndUser(couponId, userId);
    if (used === 0 || exceptCheckoutIds.length === 0) return used;
    const slots = await Promise.all(
      [...new Set(exceptCheckoutIds)].map((checkoutId) => this.redemptionRepo.findByCheckoutId(checkoutId))
    );
    const setAside = slots.filter((slot) => !!slot && slot.couponId === couponId && slot.userId === userId &&
      slot.status === CouponRedemptionStatus.PENDING).length;
    return Math.max(0, used - setAside);
  }
}
