import { describe, expect, it, vi } from 'vitest';
import {
  BillingCycle, CouponCommissionBase, CouponDiscountType, CouponRedemptionStatus, SUBSCRIPTION_PLANS, SubscriptionCheckoutStatus,
  SubscriptionTier, type CouponRedemption, type SubscriptionCheckout, type SubscriptionPlan,
} from '@ubuntu-fund/types';
import { PreviewCouponUseCase } from '../../../src/application/use-cases/PreviewCouponUseCase.js';
import { PlanService } from '../../../src/application/services/PlanService.js';
import { CouponService } from '../../../src/application/services/CouponService.js';
import { CouponEntity } from '../../../src/domain/entities/Coupon.js';
import type { CouponRepositoryPort } from '../../../src/domain/ports/outbound/CouponRepositoryPort.js';
import type { CouponRedemptionRepositoryPort } from '../../../src/domain/ports/outbound/CouponRedemptionRepositoryPort.js';
import type { SubscriptionPlanRepositoryPort } from '../../../src/domain/ports/outbound/SubscriptionPlanRepositoryPort.js';

/**
 * The preview quotes the price checkout will charge, for a plan checkout will
 * sell. It reads plans through the real PlanService, so a non-strict read that
 * quietly quoted the code defaults would show up here.
 */

function planStore(findByTier: SubscriptionPlanRepositoryPort['findByTier']) {
  return new PlanService({
    findByTier: vi.fn(findByTier), findAll: vi.fn(async () => []), create: vi.fn(), update: vi.fn(), seedDefaults: vi.fn(),
  });
}

/** Stored plans as an admin left them: Pro at its live price, the rest at their seeds. */
const stored: Record<string, SubscriptionPlan> = {
  ...SUBSCRIPTION_PLANS,
  [SubscriptionTier.PRO]: { ...SUBSCRIPTION_PLANS[SubscriptionTier.PRO], priceMonthly: 29.99, priceYearly: 299 },
};

function tenPercentOff() {
  return {
    validateAndPrice: vi.fn(async ({ baseAmount }: { baseAmount: number }) => ({
      coupon: { code: 'TEN', discountType: 'percent' },
      baseAmount,
      discountAmount: Math.round(baseAmount * 10) / 100,
      finalAmount: baseAmount - Math.round(baseAmount * 10) / 100,
      currency: 'GHS',
    })),
  };
}

const preview = (tier: string, plans: PlanService, coupons = tenPercentOff(), billingCycle = BillingCycle.MONTHLY) =>
  new PreviewCouponUseCase(coupons as never, plans).execute({ code: 'ten', tier, billingCycle }, 'buyer');

describe('previewing a coupon against a plan', () => {
  it('quotes the stored price of a plan checkout sells', async () => {
    const coupons = tenPercentOff();
    await expect(preview(SubscriptionTier.PRO, planStore(async (tier) => stored[tier] ?? null), coupons)).resolves.toMatchObject({
      valid: true, baseAmount: 29.99, discountAmount: 3,
    });
    expect(coupons.validateAndPrice).toHaveBeenCalledWith(expect.objectContaining({ baseAmount: 29.99, tier: 'pro' }));
  });

  it('says prices are unavailable when the plan cannot be read, instead of quoting the code defaults', async () => {
    const coupons = tenPercentOff();
    const down = planStore(async () => { throw new Error('database unavailable'); });
    await expect(preview(SubscriptionTier.PRO, down, coupons)).resolves.toEqual({
      valid: false, code: 'TEN', baseAmount: 0, discountAmount: 0, finalAmount: 0, currency: 'GHS',
      reason: 'Plan prices are unavailable right now',
    });
    expect(coupons.validateAndPrice).not.toHaveBeenCalled();
  });

  it('refuses a plan checkout would not sell: Enterprise, hidden, inactive, Free or unknown', async () => {
    const plans = planStore(async (tier) => ({
      ...stored,
      'hidden-plan': { ...stored.pro, tier: 'hidden-plan', isPublic: false },
      'retired-plan': { ...stored.pro, tier: 'retired-plan', active: false },
    } as Record<string, SubscriptionPlan>)[tier] ?? null);
    const coupons = tenPercentOff();
    // An unknown tier resolves to the Free plan, which used to preview as "valid, pay 0".
    for (const tier of [SubscriptionTier.ENTERPRISE, 'hidden-plan', 'retired-plan', SubscriptionTier.FREE, 'no-such-plan']) {
      await expect(preview(tier, plans, coupons)).resolves.toMatchObject({
        valid: false, baseAmount: 0, finalAmount: 0, reason: 'That subscription plan is not available',
      });
    }
    expect(coupons.validateAndPrice).not.toHaveBeenCalled();
  });

  it('refuses a billing cycle priced 0, as checkout does, and still quotes the cycle on offer', async () => {
    // A price of 0 means the cycle is not offered. It used to preview as "valid, pay 0".
    const plans = planStore(async (tier) => (tier === SubscriptionTier.PRO ? { ...stored.pro, priceYearly: 0 } : stored[tier] ?? null));
    const coupons = tenPercentOff();
    await expect(preview(SubscriptionTier.PRO, plans, coupons, BillingCycle.YEARLY)).resolves.toEqual({
      valid: false, code: 'TEN', baseAmount: 0, discountAmount: 0, finalAmount: 0, currency: 'GHS',
      reason: 'That billing cycle is not available for this plan',
    });
    expect(coupons.validateAndPrice).not.toHaveBeenCalled();
    await expect(preview(SubscriptionTier.PRO, plans, coupons)).resolves.toMatchObject({ valid: true, baseAmount: 29.99 });
  });
});

/**
 * A once-per-member coupon on the member's own unpaid checkout. Continue sends
 * the member back to that checkout's payment page at its discounted price, so
 * the dialog must quote that price rather than "already used" at the full one.
 */
describe('previewing a coupon the member\'s own open checkout holds', () => {
  const once = new CouponEntity({
    id: 'coupon-1', code: 'ONCE', discountType: CouponDiscountType.PERCENT, amount: 10, currency: 'GHS', redemptions: 0,
    perUserLimit: 1, appliesToTiers: [], appliesToBillingCycles: [], appliesToSurfaces: [],
    commissionBase: CouponCommissionBase.POST_COUPON, newUsersOnly: false, allowedEmails: [], active: true,
    createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
  });
  const openCheckout = (id: string, extra: Partial<SubscriptionCheckout> = {}) => ({
    id, userId: 'buyer', tier: SubscriptionTier.PRO, billingCycle: BillingCycle.MONTHLY, status: SubscriptionCheckoutStatus.PENDING,
    baseAmount: 29.99, discountAmount: 3, finalAmount: 26.99, currency: 'GHS', couponId: 'coupon-1', couponCode: 'ONCE',
    authorizationUrl: `https://checkout.paystack.test/${id}`, createdAt: new Date(), updatedAt: new Date(), ...extra,
  }) as SubscriptionCheckout;

  /** The member's coupon slots and open checkouts, priced through the real CouponService. */
  function member(slots: Partial<CouponRedemption>[], open: SubscriptionCheckout[] | Error) {
    const held = slots.map((slot) => ({ couponId: 'coupon-1', userId: 'buyer', ...slot }));
    const redemptions = {
      countByCouponAndUser: vi.fn(async (couponId: string, userId: string) => held.filter((slot) =>
        slot.couponId === couponId && slot.userId === userId && slot.status !== CouponRedemptionStatus.RELEASED).length),
      findByCheckoutId: vi.fn(async (checkoutId: string) => held.find((slot) => slot.checkoutId === checkoutId) ?? null),
    } as unknown as CouponRedemptionRepositoryPort;
    const coupons = new CouponService({ findByCode: vi.fn(async () => once) } as unknown as CouponRepositoryPort, redemptions,
      { emailFor: vi.fn(), hasPaidBefore: vi.fn(async () => false) });
    const checkouts = { findPendingByUser: vi.fn(async () => { if (open instanceof Error) throw open; return open; }) };
    const useCase = new PreviewCouponUseCase(coupons, planStore(async (tier) => stored[tier] ?? null), undefined, undefined, checkouts);
    const preview = (billingCycle = BillingCycle.MONTHLY) =>
      useCase.execute({ code: 'once', tier: SubscriptionTier.PRO, billingCycle }, 'buyer');
    return { preview, coupons, checkouts };
  }

  it('quotes the discounted total Continue resumes, not "already used" at the full price', async () => {
    const { preview, checkouts } = member([{ checkoutId: 'open-1', status: CouponRedemptionStatus.PENDING }], [openCheckout('open-1')]);
    await expect(preview()).resolves.toEqual({
      valid: true, code: 'ONCE', discountType: CouponDiscountType.PERCENT, baseAmount: 29.99, discountAmount: 3, finalAmount: 26.99, currency: 'GHS',
    });
    // Read exactly as checkout reads them before it charges.
    expect(checkouts.findPendingByUser).toHaveBeenCalledWith('buyer', 5);
  });

  it('quotes the discount for another cycle too, which is charged once the member cancels the open checkout', async () => {
    const { preview, coupons } = member([{ checkoutId: 'open-1', status: CouponRedemptionStatus.PENDING }],
      [openCheckout('open-1'), openCheckout('no-code', { couponId: undefined, couponCode: undefined })]);
    const priced = vi.spyOn(coupons, 'validateAndPrice');
    await expect(preview(BillingCycle.YEARLY)).resolves.toMatchObject({ valid: true, baseAmount: 299, discountAmount: 29.9, finalAmount: 269.1 });
    // Only an open checkout that carries a coupon can hold a seat.
    expect(priced).toHaveBeenCalledWith(expect.objectContaining({ exceptCheckoutIds: ['open-1'] }));
  });

  it('still counts a use the member paid for, which no open checkout holds', async () => {
    const { preview } = member([{ checkoutId: 'paid-1', status: CouponRedemptionStatus.CONSUMED }], []);
    await expect(preview()).resolves.toMatchObject({
      valid: false, baseAmount: 29.99, discountAmount: 0, finalAmount: 29.99, reason: 'You have already used this coupon the maximum number of times',
    });
  });

  it('answers softly when the open checkouts cannot be read, as for any other failed lookup', async () => {
    const { preview } = member([{ checkoutId: 'open-1', status: CouponRedemptionStatus.PENDING }], new Error('database unavailable'));
    await expect(preview()).resolves.toMatchObject({ valid: false, finalAmount: 29.99, reason: 'This coupon could not be applied' });
  });
});
