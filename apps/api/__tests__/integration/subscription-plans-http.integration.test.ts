import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, afterEach, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { BillingCycle, LEGAL_ACCEPTANCE_VERSION, SubscriptionTier } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { SubscriptionPlanModel } from '../../src/infrastructure/database/models/SubscriptionPlanModel.js';
import { MongoSubscriptionPlanRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoSubscriptionPlanRepository.js';
import { PaystackGateway } from '../../src/infrastructure/adapters/outbound/payments/PaystackGateway.js';

const ON_BEHALF_ZERO = 'Switched on, but 0 allowed: nobody on this plan could start one. Set a limit or -1 for unlimited.';
const PARISH_PLUS = {
  tier: 'parish-plus', name: 'Parish Plus', priceMonthly: 20, priceYearly: 200, platformFeePercent: 3,
  maxActiveCampaigns: 3, maxCampaignGoal: 50000, maxMediaPerCampaign: 10, maxTeamMembers: 1, maxCollaboratorsPerCampaign: 0,
};
let app: Express;

beforeAll(async () => {
  await connectTestDatabase();
  app = await createTestApp();
  // Let the boot seed land, so the edits below never race it.
  await vi.waitFor(async () => expect(await SubscriptionPlanModel.countDocuments()).toBe(Object.values(SubscriptionTier).length),
    { timeout: 60_000, interval: 100 });
});
afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

async function account(role?: 'admin') {
  const response = await request(app).post('/api/v1/auth/register').send({ name: 'Plans test', email: `${randomUUID()}@example.test`,
    password: 'SecurePass123', legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true } }).expect(201);
  if (role) await UserModel.updateOne({ _id: response.body.data.user.id }, { $set: { role } });
  return `Bearer ${response.body.data.tokens.accessToken}`;
}

it('answers GET /plans with an error, never the code price book, when plans cannot be read', async () => {
  const auth = await account();
  const read = vi.spyOn(MongoSubscriptionPlanRepository.prototype, 'findAll').mockRejectedValue(new Error('database unavailable'));
  const failed = await request(app).get('/api/v1/plans').set('Authorization', auth).expect(500);
  expect(failed.body.data).toBeUndefined();
  read.mockRestore();
  const live = await request(app).get('/api/v1/plans').set('Authorization', auth).expect(200);
  expect(live.body.data.map((plan: { tier: string }) => plan.tier)).toEqual(expect.arrayContaining(Object.values(SubscriptionTier)));
});

it('refuses plan prices checkout could not charge exactly, and yearly prices above 12 monthly payments', async () => {
  const admin = await account('admin');
  const edit = (body: object) => request(app).put('/api/v1/plans/starter').set('Authorization', admin).send(body);
  expect((await edit({ priceMonthly: 9.995 }).expect(400)).body.errors).toEqual({ priceMonthly: ['Use at most two decimal places'] });
  expect((await edit({ priceYearly: 2_000_000 }).expect(400)).body.errors).toEqual({ priceYearly: ['Must be 1,000,000 or less'] });
  const yearly = await edit({ priceMonthly: 10, priceYearly: 120.01 }).expect(422);
  expect(yearly.body.message).toContain('more than 12 times the monthly price (GHS 120.00)');
  await edit({ priceMonthly: 10, priceYearly: 120 }).expect(200);
  // 0 means that cycle is not offered, so it is never compared.
  await edit({ priceMonthly: 0 }).expect(200);
  const create = (body: object) => request(app).post('/api/v1/plans').set('Authorization', admin).send({ ...PARISH_PLUS, tier: 'choir-plus', ...body });
  await create({ priceMonthly: 20.001 }).expect(400);
  await create({ priceYearly: 240.5 }).expect(422);
  expect(await SubscriptionPlanModel.exists({ tier: 'choir-plus' })).toBeNull();
});

it('refuses campaigns on behalf of others switched on with none allowed', async () => {
  const admin = await account('admin');
  const edit = (body: object) => request(app).put('/api/v1/plans/organization').set('Authorization', admin).send(body);
  const refused = await edit({ onBehalfCampaigns: true, maxOnBehalfCampaigns: 0 }).expect(422);
  expect(refused.body).toMatchObject({ message: ON_BEHALF_ZERO, errors: { maxOnBehalfCampaigns: [ON_BEHALF_ZERO] } });
  await edit({ onBehalfCampaigns: true, maxOnBehalfCampaigns: -1 }).expect(200);
});

it('checks out a tier an admin created, and leaves which plans are sold to the plan rules', async () => {
  vi.spyOn(PaystackGateway.prototype, 'isConfigured').mockReturnValue(true);
  const charge = vi.spyOn(PaystackGateway.prototype, 'initializeCharge').mockResolvedValue({
    reference: `sub-${randomUUID()}`, authorizationUrl: 'https://checkout.paystack.com/fixture', accessCode: 'fixture',
  });
  await request(app).post('/api/v1/plans').set('Authorization', await account('admin')).send(PARISH_PLUS).expect(201);
  const member = await account();
  const checkout = (tier: unknown) => request(app).post('/api/v1/subscriptions/checkout').set('Authorization', member)
    .send({ tier, billingCycle: BillingCycle.MONTHLY });
  for (const tier of ['   ', 'x'.repeat(61), 42]) {
    expect((await checkout(tier).expect(400)).body.message).toBe('Validation failed');
  }
  // A well-formed id that is not a plan reaches the plan rules.
  expect((await checkout('no-such-plan').expect(400)).body.message).toBe('That subscription plan is not available');
  expect((await checkout(SubscriptionTier.ENTERPRISE).expect(403)).body.message).toMatch(/sales team/);
  const created = await checkout('parish-plus').expect(201);
  expect(created.body.data.checkout).toMatchObject({ tier: 'parish-plus', baseAmount: 20, finalAmount: 20 });
  expect(charge).toHaveBeenCalledTimes(1);
});
