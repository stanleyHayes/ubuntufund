import { describe, expect, it, vi } from 'vitest';
import { BillingCycle, SUBSCRIPTION_PLANS, SubscriptionTier, type SubscriptionCheckout, type SubscriptionPlan } from '@ubuntu-fund/types';
import { CreateSubscriptionCheckoutUseCase } from '../../../src/application/use-cases/CreateSubscriptionCheckoutUseCase.js';
import { PlanService } from '../../../src/application/services/PlanService.js';
import type { SubscriptionPlanRepositoryPort } from '../../../src/domain/ports/outbound/SubscriptionPlanRepositoryPort.js';

/**
 * Web checkout charges the price an admin set on the plan, or nothing. It reads
 * plans through the real PlanService, whose non-strict read would fall back to
 * the code price book (Pro 149 instead of the live 29.99) on a database error.
 */

function checkout(findByTier: SubscriptionPlanRepositoryPort['findByTier']) {
  const planRepo = { findByTier: vi.fn(findByTier), findAll: vi.fn(async () => []), create: vi.fn(), update: vi.fn(), seedDefaults: vi.fn() };
  const gateway = {
    isConfigured: () => true,
    initializeCharge: vi.fn(async () => ({ reference: 'sub-1', authorizationUrl: 'https://checkout.paystack.test/sub-1', accessCode: 'access' })),
  };
  const checkouts = {
    findPendingByUser: vi.fn(async () => []),
    create: vi.fn(async (row: SubscriptionCheckout) => ({ ...row, id: 'checkout-1' })),
    setProviderRef: vi.fn(async () => null),
  };
  const ownership = { claimProvider: vi.fn(async () => {}) };
  const users = { findById: vi.fn(async (id: string) => ({ id, email: { value: 'member@example.test' } })) };
  const useCase = new CreateSubscriptionCheckoutUseCase(ownership as never, checkouts as never, {} as never, users as never,
    {} as never, gateway as never, {} as never, new PlanService(planRepo));
  const buy = (tier: string) => useCase.execute({ tier, billingCycle: BillingCycle.MONTHLY }, 'member-1');
  return { buy, gateway, checkouts, ownership };
}

const pro: SubscriptionPlan = { ...SUBSCRIPTION_PLANS[SubscriptionTier.PRO], priceMonthly: 29.99, priceYearly: 299 };

describe('pricing a web checkout', () => {
  it('fails, and opens no charge, when the plan price cannot be read', async () => {
    const s = checkout(async () => { throw new Error('database unavailable'); });
    await expect(s.buy(SubscriptionTier.PRO)).rejects.toThrow('database unavailable');
    expect(s.gateway.initializeCharge).not.toHaveBeenCalled();
    expect(s.checkouts.create).not.toHaveBeenCalled();
    expect(s.ownership.claimProvider).not.toHaveBeenCalled();
  });

  it('charges the stored price', async () => {
    const s = checkout(async (tier) => (tier === SubscriptionTier.PRO ? pro : null));
    await expect(s.buy(SubscriptionTier.PRO)).resolves.toMatchObject({ preview: { baseAmount: 29.99, finalAmount: 29.99 } });
    expect(s.gateway.initializeCharge).toHaveBeenCalledWith(expect.objectContaining({ amount: 29.99 }));
  });

  it('sells a tier an admin created, when it is active and public', async () => {
    const parish: SubscriptionPlan = { ...pro, tier: 'parish-plus', name: 'Parish Plus', priceMonthly: 20 };
    const s = checkout(async (tier) => (tier === 'parish-plus' ? parish : null));
    await expect(s.buy('parish-plus')).resolves.toMatchObject({ checkout: { tier: 'parish-plus', baseAmount: 20 } });
  });

  it('refuses plans it does not sell before claiming the billing rail', async () => {
    const plans: Record<string, SubscriptionPlan> = {
      [SubscriptionTier.ENTERPRISE]: SUBSCRIPTION_PLANS[SubscriptionTier.ENTERPRISE],
      'hidden-plan': { ...pro, tier: 'hidden-plan', isPublic: false },
      'retired-plan': { ...pro, tier: 'retired-plan', active: false },
    };
    const s = checkout(async (tier) => plans[tier] ?? null);
    await expect(s.buy(SubscriptionTier.ENTERPRISE)).rejects.toMatchObject({ statusCode: 403 });
    await expect(s.buy('hidden-plan')).rejects.toMatchObject({ statusCode: 403 });
    await expect(s.buy('retired-plan')).rejects.toMatchObject({ statusCode: 400 });
    // An unknown tier resolves to the Free plan: not the plan that was asked for.
    await expect(s.buy('no-such-plan')).rejects.toMatchObject({ statusCode: 400, message: 'That subscription plan is not available' });
    expect(s.ownership.claimProvider).not.toHaveBeenCalled();
    expect(s.gateway.initializeCharge).not.toHaveBeenCalled();
  });
});
