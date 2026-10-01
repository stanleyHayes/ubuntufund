import { describe, expect, it, vi } from 'vitest';
import { BillingCycle, SUBSCRIPTION_PLANS, SubscriptionTier, type SubscriptionPlan } from '@ubuntu-fund/types';
import { PreviewCouponUseCase } from '../../../src/application/use-cases/PreviewCouponUseCase.js';
import { PlanService } from '../../../src/application/services/PlanService.js';
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
