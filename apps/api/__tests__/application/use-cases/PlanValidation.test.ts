import { describe, expect, it, vi } from 'vitest';
import { SUBSCRIPTION_PLANS, SubscriptionTier, type CreatePlanInput, type SubscriptionPlan } from '@ubuntu-fund/types';
import { UpdatePlanUseCase } from '../../../src/application/use-cases/UpdatePlanUseCase.js';
import { CreatePlanUseCase } from '../../../src/application/use-cases/CreatePlanUseCase.js';
import type { SubscriptionPlanRepositoryPort } from '../../../src/domain/ports/outbound/SubscriptionPlanRepositoryPort.js';

const ON_BEHALF_ZERO = 'Switched on, but 0 allowed: nobody on this plan could start one. Set a limit or -1 for unlimited.';

/** A plan repository holding one stored plan, recording what gets written. */
function storedPlan(over: Partial<SubscriptionPlan> = {}) {
  const stored: SubscriptionPlan = { ...SUBSCRIPTION_PLANS[SubscriptionTier.PRO], priceMonthly: 29.99, priceYearly: 299, ...over };
  const repo = {
    findByTier: vi.fn(async () => stored),
    findAll: vi.fn(async () => [stored]),
    seedDefaults: vi.fn(async () => {}),
    update: vi.fn(async (_tier: string, patch: Partial<SubscriptionPlan>) => ({ ...stored, ...patch })),
    create: vi.fn(async (input: CreatePlanInput) => ({ ...stored, ...input })),
  };
  return { repo, useCase: new UpdatePlanUseCase(repo as unknown as SubscriptionPlanRepositoryPort) };
}

describe('editing plan prices', () => {
  it('refuses a price checkout could not charge exactly, or above 1,000,000', async () => {
    const { repo, useCase } = storedPlan();
    await expect(useCase.execute('pro', { priceMonthly: 9.995 })).rejects.toMatchObject({ statusCode: 422 });
    await expect(useCase.execute('pro', { priceYearly: 1_000_000.5 })).rejects.toMatchObject({ statusCode: 422 });
    await expect(useCase.execute('pro', { priceYearly: 2_000_000 })).rejects.toMatchObject({ statusCode: 422 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('refuses a yearly price above 12 × the monthly price of the plan as it will be saved', async () => {
    const { repo, useCase } = storedPlan({ priceMonthly: 9.99, priceYearly: 99 });
    await expect(useCase.execute('pro', { priceYearly: 200 })).rejects.toMatchObject({
      statusCode: 422, message: expect.stringContaining('more than 12 times the monthly price (GHS 119.88)'),
    });
    // A monthly-only edit is checked against the stored yearly price too.
    await expect(useCase.execute('pro', { priceMonthly: 5 })).rejects.toMatchObject({ statusCode: 422 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('accepts exactly 12 × monthly, compared in pesewas, and 0 for a cycle that is not offered', async () => {
    const { repo, useCase } = storedPlan();
    // 12 × 4.35 is 52.199999… as a float.
    await expect(useCase.execute('pro', { priceMonthly: 4.35, priceYearly: 52.2 })).resolves.toMatchObject({ priceYearly: 52.2 });
    await expect(useCase.execute('pro', { priceMonthly: 0, priceYearly: 5000 })).resolves.toBeDefined();
    await expect(useCase.execute('pro', { priceYearly: 0 })).resolves.toBeDefined();
    await expect(useCase.execute('pro', { priceMonthly: 999.99, priceYearly: 9999.9 })).resolves.toBeDefined();
    expect(repo.update).toHaveBeenCalledTimes(4);
  });
});

describe('editing campaigns on behalf of others', () => {
  it('refuses switching it on while 0 are allowed', async () => {
    const { repo, useCase } = storedPlan({ onBehalfCampaigns: false, maxOnBehalfCampaigns: 0 });
    await expect(useCase.execute('pro', { onBehalfCampaigns: true })).rejects.toMatchObject({
      statusCode: 422, message: ON_BEHALF_ZERO, errors: { maxOnBehalfCampaigns: [ON_BEHALF_ZERO] },
    });
    await expect(useCase.execute('pro', { onBehalfCampaigns: true, maxOnBehalfCampaigns: 0 })).rejects.toMatchObject({ statusCode: 422 });
    expect(repo.update).not.toHaveBeenCalled();
    await expect(useCase.execute('pro', { onBehalfCampaigns: true, maxOnBehalfCampaigns: -1 })).resolves.toBeDefined();
    await expect(useCase.execute('pro', { onBehalfCampaigns: true, maxOnBehalfCampaigns: 5 })).resolves.toBeDefined();
  });

  it('makes a plan saved as on with 0 allowed set a limit, or switch it off, before any other edit', async () => {
    // The live Enterprise row: switched on, 0 allowed.
    const { repo, useCase } = storedPlan({ onBehalfCampaigns: true, maxOnBehalfCampaigns: 0 });
    await expect(useCase.execute('pro', { description: 'For large institutions' })).rejects.toMatchObject({ statusCode: 422 });
    expect(repo.update).not.toHaveBeenCalled();
    await expect(useCase.execute('pro', { maxOnBehalfCampaigns: -1 })).resolves.toBeDefined();
    await expect(useCase.execute('pro', { onBehalfCampaigns: false })).resolves.toBeDefined();
  });
});

describe('creating a plan', () => {
  const input: CreatePlanInput = {
    tier: 'parish-plus', name: 'Parish Plus', description: '', priceMonthly: 20, priceYearly: 200,
    platformFeePercent: 3, maxActiveCampaigns: 3, maxCampaignGoal: 50000, maxCollaboratorsPerCampaign: 0,
  };

  it('applies the same price and on-behalf rules to the new plan', async () => {
    const { repo } = storedPlan();
    const create = new CreatePlanUseCase(repo as unknown as SubscriptionPlanRepositoryPort);
    await expect(create.execute({ ...input, priceMonthly: 19.999 })).rejects.toMatchObject({ statusCode: 422 });
    await expect(create.execute({ ...input, priceYearly: 1_500_000 })).rejects.toMatchObject({ statusCode: 422 });
    await expect(create.execute({ ...input, priceYearly: 240.01 })).rejects.toMatchObject({ statusCode: 422 });
    // A new row without a limit reads back as 0 allowed.
    await expect(create.execute({ ...input, onBehalfCampaigns: true })).rejects.toMatchObject({ statusCode: 422, message: ON_BEHALF_ZERO });
    expect(repo.create).not.toHaveBeenCalled();
    await expect(create.execute({ ...input, priceYearly: 240, onBehalfCampaigns: true, maxOnBehalfCampaigns: -1 })).resolves.toBeDefined();
    await expect(create.execute({ ...input, priceMonthly: 0 })).resolves.toBeDefined();
  });
});
