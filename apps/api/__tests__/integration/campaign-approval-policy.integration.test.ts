import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { SUBSCRIPTION_PLANS, SubscriptionTier, UserRole, VerificationLevel } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { KYCVerificationModel } from '../../src/infrastructure/database/models/KYCVerificationModel.js';
import { SubscriptionPlanModel } from '../../src/infrastructure/database/models/SubscriptionPlanModel.js';
// Even the most permissive generic tier setting cannot waive the high-goal gate.
process.env.CAMPAIGN_AUTO_APPROVE_MAX_TIER = '5';
let app: Express;
beforeAll(async () => {
  await connectTestDatabase(); app = await createTestApp();
  await SubscriptionPlanModel.findOneAndUpdate({ tier: SubscriptionTier.FREE }, { ...SUBSCRIPTION_PLANS[SubscriptionTier.FREE], maxCampaignGoal: 2_000_000, maxActiveCampaigns: 20 }, { upsert: true });
});
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function user(role = UserRole.USER) {
  const res = await request(app).post('/api/v1/auth/register').send({ name: 'Approval test', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  await UserModel.findByIdAndUpdate(res.body.data.user.id, { role, verificationLevel: VerificationLevel.COMMUNITY });
  return { id: res.body.data.user.id, token: `Bearer ${res.body.data.tokens.accessToken}` };
}
const input = (goalAmount: number) => ({ title: `Approval ${randomUUID()}`, description: 'A synthetic community campaign for approval policy verification.', goalAmount, currency: 'GHS', category: 'education', priority: 'normal', beneficiaries: ['Community'], endDate: new Date(Date.now() + 86400000 * 30).toISOString() });

it.each([UserRole.USER, UserRole.ORGANIZATION])('holds first/pending high-goal campaigns and auto-approves a currently verified returning %s', async role => {
  const owner = await user(role);
  const kyc = await KYCVerificationModel.create({ userId: owner.id, verificationType: role === UserRole.ORGANIZATION ? 'business' : 'identity', status: 'approved', documents: [], expiryDate: new Date(Date.now() + 86400000), riskLevel: 'low' });
  const create = (goal = 250000.01) => request(app).post('/api/v1/campaigns').set('Authorization', owner.token).send(input(goal));
  const first = await create().expect(201);
  expect(first.body.data.status).toBe('pending_review');
  expect((await create().expect(201)).body.data.status).toBe('pending_review');
  await CampaignModel.findByIdAndUpdate(first.body.data.id, { status: 'active' });
  expect((await create(1_100_000).expect(201)).body.data.status).toBe('active');
  await KYCVerificationModel.findByIdAndUpdate(kyc.id, { expiryDate: new Date(Date.now() - 1000) });
  await create().expect(403); // Expired evidence also removes the higher campaign-count allowance.
});

it('keeps the exact boundary on the base tier policy, requires real verification above it, and preserves compliance caps', async () => {
  const owner = await user();
  const create = (goal: number) => request(app).post('/api/v1/campaigns').set('Authorization', owner.token).send(input(goal));
  expect((await create(250000).expect(201)).body.data.status).toBe('active');
  const unverified = await user();
  const high = await request(app).post('/api/v1/campaigns').set('Authorization', unverified.token).send(input(250000.01)).expect(201);
  expect(high.body.data.status).toBe('pending_review');
  await KYCVerificationModel.create({ userId: owner.id, verificationType: 'identity', status: 'approved', documents: [], expiryDate: new Date(Date.now() + 86400000), riskLevel: 'low' });
  await UserModel.findByIdAndUpdate(owner.id, { complianceApprovedCampaignLimit: 100000 });
  await create(300000).expect(422);
});
