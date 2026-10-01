import { describe, expect, it, vi } from 'vitest';
import { SUBSCRIPTION_PLANS, SubscriptionTier, type SubscriptionPlan } from '@ubuntu-fund/types';
import { PlanService, isSelfServePlan } from '../../../src/application/services/PlanService.js';
import type { SubscriptionPlanRepositoryPort } from '../../../src/domain/ports/outbound/SubscriptionPlanRepositoryPort.js';

const plan = (over: Partial<SubscriptionPlan>): SubscriptionPlan => ({ ...SUBSCRIPTION_PLANS[SubscriptionTier.PRO], ...over });

function repoReturning(findAll: SubscriptionPlanRepositoryPort['findAll']): SubscriptionPlanRepositoryPort {
  return { findAll: vi.fn(findAll), findByTier: vi.fn(async () => null), create: vi.fn(), update: vi.fn(), seedDefaults: vi.fn() };
}

describe('plan order', () => {
  it('breaks a tie on sort order and price by tier id, whatever order the rows come back in', async () => {
    // Live data has Organization and Enterprise on the same sortOrder; two
    // plans that also cost the same must not swap places between requests.
    const zeta = plan({ tier: 'zeta-plan', sortOrder: 9, priceMonthly: 50 });
    const alpha = plan({ tier: 'alpha-plan', sortOrder: 9, priceMonthly: 50 });
    for (const rows of [[zeta, alpha], [alpha, zeta]]) {
      const plans = await new PlanService(repoReturning(async () => rows)).getAllPlans(true);
      expect(plans.slice(-2).map((p) => p.tier)).toEqual(['alpha-plan', 'zeta-plan']);
    }
  });

  it('still orders by sort order first, then monthly price', async () => {
    const rows = [
      plan({ tier: 'b-plan', sortOrder: 7, priceMonthly: 10 }),
      plan({ tier: 'a-plan', sortOrder: 7, priceMonthly: 20 }),
      plan({ tier: 'c-plan', sortOrder: 6, priceMonthly: 99 }),
    ];
    const plans = await new PlanService(repoReturning(async () => rows)).getAllPlans(true);
    expect(plans.slice(-3).map((p) => p.tier)).toEqual(['c-plan', 'b-plan', 'a-plan']);
  });
});

describe('isSelfServePlan', () => {
  it('lets members buy an active, public paid plan, built in or added by an admin', () => {
    expect(isSelfServePlan(SUBSCRIPTION_PLANS[SubscriptionTier.STARTER])).toBe(true);
    expect(isSelfServePlan(SUBSCRIPTION_PLANS[SubscriptionTier.ORGANIZATION])).toBe(true);
    expect(isSelfServePlan(plan({ tier: 'parish-plus' }))).toBe(true);
  });

  it('never sells Free, Enterprise, or an inactive or hidden plan', () => {
    expect(isSelfServePlan(SUBSCRIPTION_PLANS[SubscriptionTier.FREE])).toBe(false);
    expect(isSelfServePlan(SUBSCRIPTION_PLANS[SubscriptionTier.ENTERPRISE])).toBe(false);
    expect(isSelfServePlan(plan({ active: false }))).toBe(false);
    expect(isSelfServePlan(plan({ isPublic: false }))).toBe(false);
  });
});
