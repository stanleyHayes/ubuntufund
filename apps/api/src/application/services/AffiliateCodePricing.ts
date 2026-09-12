import { AffiliateStatus } from '@ubuntu-fund/types';
import type { AffiliateRepositoryPort } from '../../domain/ports/outbound/AffiliateRepositoryPort.js';
import type { AffiliateReferralRepositoryPort } from '../../domain/ports/outbound/AffiliateReferralRepositoryPort.js';
import { roundToCurrency } from '../../domain/value-objects/Money.js';
import { logger } from '../../infrastructure/logging/logger.js';

export interface AffiliateCodeQuote {
  affiliateId: string;
  /** The affiliate's code, as stored (lowercase). */
  code: string;
  discountAmount: number;
  finalAmount: number;
}

/**
 * Lets an affiliate's referral code work as a discount code.
 *
 * The two systems were entirely separate: a referral gave the referee nothing,
 * and a coupon gave the referrer nothing. That asks a supporter to carry two
 * codes and an affiliate to explain both. Here one code does both jobs — the
 * referee saves, and the referrer still earns their commission at settlement.
 *
 * Deliberately NOT a coupon record. An affiliate code is not admin-issued, has
 * no redemption caps to enforce, and must not consume coupon seats; folding it
 * into the coupon collection would mean every affiliate silently owning a
 * coupon nobody created.
 *
 * Disabled while the resolved discount is zero, so the behaviour is inert
 * until someone sets a rate. The rate is admin-controlled through the versioned
 * commercial-config store, which is also the audit trail for who changed it,
 * when, and why.
 */
export class AffiliateCodePricing {
  constructor(
    private readonly affiliateRepo: AffiliateRepositoryPort,
    private readonly referralRepo: AffiliateReferralRepositoryPort,
    /**
     * Resolved per quote, not captured at construction: this is a live pricing
     * lever an admin changes in the dashboard, and a value frozen at boot would
     * keep quoting a discount the platform had already stopped giving until the
     * next deploy.
     */
    private readonly resolveDiscountPercent: () => Promise<number>
  ) {}

  /**
   * Quote `code` as an affiliate referral, or return null when it is not one.
   *
   * Returns null rather than throwing: the caller has already failed to find a
   * coupon by this code, and a null here means "not a discount code at all",
   * which is the caller's error to report.
   */
  async quote(
    code: string,
    userId: string,
    baseAmount: number,
    currency: string
  ): Promise<AffiliateCodeQuote | null> {
    const discountPercent = await this.resolveDiscountPercent();
    // Zero disables the behaviour outright: an affiliate code typed into the
    // coupon box is then just an unknown code, exactly as before the feature.
    if (!(discountPercent > 0)) return null;

    // Referral codes are stored lowercase; the checkout box is shared with
    // coupons, which are uppercase, so whatever the customer typed has to be
    // normalised both ways before either lookup can match.
    const affiliate = await this.affiliateRepo.findByReferralCode(
      code.trim().toLowerCase()
    );
    if (!affiliate) return null;

    // A suspended affiliate earns nothing, so their code must not discount
    // anything either — otherwise the platform pays for a promotion that
    // credits no one.
    if (affiliate.status === AffiliateStatus.SUSPENDED) return null;

    // Self-referral: the same guard registration applies. Without it an
    // affiliate discounts their own subscription with their own code.
    if (affiliate.userId === userId) return null;

    // The discount only exists to buy a commission, and the commission is
    // once per referee ever — AffiliateCommissionService returns null once the
    // referral has converted. Without this check the discount recurs on every
    // renewal and upgrade while earning the referrer nothing, and a user
    // already referred by someone else could take any affiliate's discount
    // while that affiliate is credited nothing. Both are pure cash out the
    // door, repeatable indefinitely.
    const existing = await this.referralRepo.findByRefereeId(userId);
    if (existing) {
      const willEarn =
        existing.status === 'pending' && existing.referrerId === affiliate.id;
      if (!willEarn) return null;
    }

    const discountAmount = roundToCurrency(
      Math.min((baseAmount * discountPercent) / 100, baseAmount),
      currency
    );

    return {
      affiliateId: affiliate.id,
      code: affiliate.referralCode,
      discountAmount,
      finalAmount: roundToCurrency(baseAmount - discountAmount, currency),
    };
  }

  /**
   * Attach the referral so the affiliate is credited at settlement.
   *
   * Best-effort, and never fatal to a checkout: a customer's payment must not
   * fail because an attribution row could not be written. Someone already
   * referred keeps their original referrer — `refereeId` is unique, and a user
   * is referred at most once, so entering a second affiliate's code later
   * discounts the purchase without stealing the first referrer's credit.
   */
  async attachReferral(affiliateId: string, userId: string, code: string): Promise<void> {
    try {
      const existing = await this.referralRepo.findByRefereeId(userId);
      if (existing) return;

      const now = new Date();
      await this.referralRepo.create({
        id: '',
        referrerId: affiliateId,
        refereeId: userId,
        referralCode: code,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });
    } catch (err) {
      logger.warn(
        { err, affiliateId, userId },
        'failed to attach affiliate referral from a checkout code'
      );
    }
  }
}
