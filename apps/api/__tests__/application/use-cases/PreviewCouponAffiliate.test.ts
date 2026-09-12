import { describe, expect, it, vi } from 'vitest';
import { AffiliateStatus, BillingCycle, SubscriptionTier } from '@ubuntu-fund/types';
import { PreviewCouponUseCase } from '../../../src/application/use-cases/PreviewCouponUseCase.js';
import { AffiliateCodePricing } from '../../../src/application/services/AffiliateCodePricing.js';
import { AppError } from '../../../src/infrastructure/adapters/inbound/middleware/errorHandler.js';

/**
 * The preview exists to tell a customer what they will pay. Anything checkout
 * would accept has to quote here too — an affiliate code that previews as
 * "not found" and then works at checkout is worse than not previewing at all,
 * because the customer gives up before reaching the page that would honour it.
 */

const planService = {
  getPlan: vi.fn(async () => ({ priceMonthly: 200, priceYearly: 2000 })),
} as never;

function affiliatePricing(percent = 20) {
  const affiliateRepo = {
    findByReferralCode: vi.fn(async (code: string) =>
      code === 'ama-gh'
        ? {
            id: 'aff-1',
            userId: 'affiliate-user',
            referralCode: 'ama-gh',
            status: AffiliateStatus.ACTIVE,
          }
        : null
    ),
  } as never;
  const referralRepo = {
    findByRefereeId: vi.fn(async () => null),
    create: vi.fn(async (r: unknown) => r),
  } as never;
  return new AffiliateCodePricing(affiliateRepo, referralRepo, async () => percent);
}

/** A coupon service that knows no coupons at all. */
const noCoupons = {
  validateAndPrice: vi.fn(async () => {
    throw new AppError('Coupon not found', 422);
  }),
} as never;

const input = {
  code: 'AMA-GH',
  tier: SubscriptionTier.PRO,
  billingCycle: BillingCycle.MONTHLY,
};

describe('previewing an affiliate code', () => {
  it('quotes the referral discount for a code that is not a coupon', async () => {
    const preview = new PreviewCouponUseCase(noCoupons, planService, affiliatePricing(20));

    await expect(preview.execute(input, 'buyer')).resolves.toMatchObject({
      valid: true,
      code: 'ama-gh',
      discountAmount: 40,
      finalAmount: 160,
    });
  });

  it('still reports an unknown code as invalid', async () => {
    const preview = new PreviewCouponUseCase(noCoupons, planService, affiliatePricing(20));

    await expect(
      preview.execute({ ...input, code: 'NOBODY' }, 'buyer')
    ).resolves.toMatchObject({ valid: false, reason: 'Coupon not found' });
  });

  it('reports an affiliate code as invalid when referral discounts are switched off', async () => {
    // Matches checkout, which also declines to price it at zero percent.
    const preview = new PreviewCouponUseCase(noCoupons, planService, affiliatePricing(0));

    await expect(preview.execute(input, 'buyer')).resolves.toMatchObject({ valid: false });
  });

  it('keeps a real coupon rejection reason instead of trying the affiliate path', async () => {
    // An expired coupon must say it expired. Falling through here would tell
    // the customer their valid-but-stale code does not exist.
    const expired = {
      validateAndPrice: vi.fn(async () => {
        throw new AppError('This coupon has expired', 422);
      }),
    } as never;
    const preview = new PreviewCouponUseCase(expired, planService, affiliatePricing(20));

    await expect(preview.execute(input, 'buyer')).resolves.toMatchObject({
      valid: false,
      reason: 'This coupon has expired',
    });
  });
});
