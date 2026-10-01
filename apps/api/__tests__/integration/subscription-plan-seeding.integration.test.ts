import { beforeAll, beforeEach, afterAll, afterEach, it, expect, vi } from 'vitest';
import { SUBSCRIPTION_PLANS, SubscriptionTier } from '@ubuntu-fund/types';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { SubscriptionPlanModel } from '../../src/infrastructure/database/models/SubscriptionPlanModel.js';
import { MongoSubscriptionPlanRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoSubscriptionPlanRepository.js';
import { logger } from '../../src/infrastructure/logging/logger.js';

const repo = new MongoSubscriptionPlanRepository();
const seed = (tier: SubscriptionTier) => SUBSCRIPTION_PLANS[tier];

beforeAll(async () => { await connectTestDatabase(); await SubscriptionPlanModel.init(); });
beforeEach(async () => { await SubscriptionPlanModel.deleteMany({}); });
afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

it('seeds each missing plan once and never re-stamps a stored one on later boots', async () => {
  const warn = vi.spyOn(logger, 'warn');
  await repo.seedDefaults();
  const seeded = await SubscriptionPlanModel.find().lean();
  expect(seeded.map((plan) => plan.tier).sort()).toEqual(Object.values(SubscriptionTier).sort());
  for (const plan of seeded) expect(plan.updatedAt).toEqual(plan.createdAt);
  // A fresh database matches the code price book: nothing to report.
  expect(warn).not.toHaveBeenCalled();
  const stamped = new Map(seeded.map((plan) => [plan.tier, plan.updatedAt.getTime()]));
  await new Promise((resolve) => setTimeout(resolve, 25));
  await repo.seedDefaults();
  for (const plan of await SubscriptionPlanModel.find().lean()) {
    expect(plan.updatedAt.getTime()).toBe(stamped.get(plan.tier));
  }
});

it('reports each built-in plan that differs from the code price book on one line, and changes nothing', async () => {
  await repo.seedDefaults();
  // An admin re-priced and renamed Starter in Admin → Plans, and Enterprise
  // shares Organization's sort order (as in production on 2026-09-30).
  const editedStarter = { name: 'Starter Plus', priceMonthly: 12.99, priceYearly: 129, platformFeePercent: 4 };
  await SubscriptionPlanModel.collection.updateOne({ tier: 'starter' }, { $set: editedStarter });
  await SubscriptionPlanModel.collection.updateOne({ tier: 'enterprise' }, { $set: { sortOrder: 3 } });
  const before = await SubscriptionPlanModel.find().lean();
  const warn = vi.spyOn(logger, 'warn');
  await repo.seedDefaults();
  expect(warn).toHaveBeenCalledTimes(2);
  const report = new Map(warn.mock.calls.map(([fields, message]) => [(fields as { tier: string }).tier, { fields, message }]));
  const starter = seed(SubscriptionTier.STARTER);
  expect(report.get('starter')?.fields).toMatchObject({ differences: [
    { field: 'name', stored: 'Starter Plus', code: starter.name },
    { field: 'priceMonthly', stored: 12.99, code: starter.priceMonthly },
    { field: 'priceYearly', stored: 129, code: starter.priceYearly },
    { field: 'platformFeePercent', stored: 4, code: starter.platformFeePercent },
  ] });
  expect(report.get('starter')?.message).toBe(`Plan "starter" differs from the code price book: name Starter Plus (code ${starter.name}), `
    + `priceMonthly 12.99 (code ${starter.priceMonthly}), priceYearly 129 (code ${starter.priceYearly}), platformFeePercent 4 (code ${starter.platformFeePercent})`);
  expect(report.get('enterprise')?.message).toBe(`Plan "enterprise" differs from the code price book: sortOrder 3 (code ${seed(SubscriptionTier.ENTERPRISE).sortOrder})`);
  // Reported, never overwritten or re-stamped.
  expect(await SubscriptionPlanModel.find().lean()).toEqual(before);
});

it('reads a launch-era plan with no collaborator cap as its tier\'s built-in cap', async () => {
  // Rows written before the field existed: the live Free, Starter, Pro and
  // Enterprise plans. A missing cap used to reach enforcement as no cap at all.
  const launchRow = (tier: string) => ({ tier, name: tier, priceMonthly: 0, priceYearly: 0, platformFeePercent: 5,
    maxActiveCampaigns: 1, maxCampaignGoal: 5000, maxMediaPerCampaign: 3, maxTeamMembers: 1 });
  await SubscriptionPlanModel.collection.insertMany(['free', 'starter', 'pro', 'enterprise', 'parish-plus'].map(launchRow));
  const caps = Object.fromEntries((await repo.findAll()).map((plan) => [plan.tier, plan.maxCollaboratorsPerCampaign]));
  // Enterprise's -1 keeps it unlimited, as it is today; an admin-added tier gets none.
  expect(caps).toEqual({ free: 0, starter: 0, pro: 3, enterprise: -1, 'parish-plus': 0 });
  expect((await repo.findByTier('pro'))?.maxCollaboratorsPerCampaign).toBe(seed(SubscriptionTier.PRO).maxCollaboratorsPerCampaign);
  // A stored cap still wins.
  await SubscriptionPlanModel.collection.updateOne({ tier: 'pro' }, { $set: { maxCollaboratorsPerCampaign: 7 } });
  expect((await repo.findByTier('pro'))?.maxCollaboratorsPerCampaign).toBe(7);
});
