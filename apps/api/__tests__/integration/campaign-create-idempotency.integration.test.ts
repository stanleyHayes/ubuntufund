import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { SubscriptionTier } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { KYCVerificationModel } from '../../src/infrastructure/database/models/KYCVerificationModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';

let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); await CampaignModel.init(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

async function organiser(verificationLevel = 2) {
  const signup = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: `idem-${randomUUID()}@example.com`, name: 'Idempotency fixture', password: 'SecurePass123' }).expect(201);
  const id = signup.body.data.user.id as string;
  await UserModel.updateOne({ _id: id }, { $set: { verificationLevel } });
  await KYCVerificationModel.create({ userId: id, verificationType: 'identity', status: 'approved', expiryDate: new Date('2099-01-01'), documents: [] });
  await SubscriptionModel.create({ userId: id, tier: SubscriptionTier.PRO, status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date('2099-01-01') });
  return { id, auth: `Bearer ${signup.body.data.tokens.accessToken}` };
}
const input = () => ({ title: 'Idempotent community campaign', description: 'Community education supplies for the school', goalAmount: 100, currency: 'GHS', category: 'education', priority: 'normal', beneficiaries: ['School'], endDate: new Date(Date.now() + 30 * 86_400_000).toISOString() });
const post = (auth: string, body: object, key?: string) => {
  const req = request(app).post('/api/v1/campaigns').set('Authorization', auth);
  if (key) req.set('Idempotency-Key', key);
  return req.send(body);
};

it('returns the campaign already created when the same key is retried, without re-checking the allowance', async () => {
  // Level 1: a single lifetime campaign, so a duplicate would be refused (403)
  // if the retry were treated as a second creation.
  const owner = await organiser(1);
  const body = input(), key = randomUUID();
  const first = await post(owner.auth, body, key).expect(201);
  const retry = await post(owner.auth, body, key).expect(200);
  expect(retry.body.data.id).toBe(first.body.data.id);
  expect(retry.body.message).toBe('Campaign already created');
  expect(await CampaignModel.countDocuments({ creatorId: owner.id })).toBe(1);
  // A new submission (new key) is a new campaign and meets the allowance.
  await post(owner.auth, body, randomUUID()).expect(403);
});

it('creates distinct campaigns for distinct keys and keeps key-less requests working', async () => {
  const owner = await organiser();
  const body = input();
  const a = await post(owner.auth, body, randomUUID()).expect(201);
  const b = await post(owner.auth, body, randomUUID()).expect(201);
  expect(a.body.data.id).not.toBe(b.body.data.id);
  await post(owner.auth, { ...body, title: 'Key-less campaign' }).expect(201);
  expect(await CampaignModel.countDocuments({ creatorId: owner.id })).toBe(3);
});

it('creates one campaign when two requests with the same key race', async () => {
  const owner = await organiser();
  const body = input(), key = randomUUID();
  const responses = await Promise.all([post(owner.auth, body, key), post(owner.auth, body, key)]);
  expect(responses.map(response => response.status).sort()).toEqual([200, 201]);
  expect(new Set(responses.map(response => response.body.data.id)).size).toBe(1);
  expect(await CampaignModel.countDocuments({ creatorId: owner.id })).toBe(1);
});

it('refuses a reused key with different content and malformed keys', async () => {
  const owner = await organiser();
  const key = randomUUID();
  await post(owner.auth, input(), key).expect(201);
  await post(owner.auth, { ...input(), title: 'A different campaign entirely' }, key).expect(409);
  await post(owner.auth, input(), 'short').expect(400);
  await post(owner.auth, input(), 'x'.repeat(101)).expect(400);
  expect(await CampaignModel.countDocuments({ creatorId: owner.id })).toBe(1);
  // Keys are scoped per creator: another organiser's identical key is unrelated.
  const other = await organiser();
  await post(other.auth, input(), key).expect(201);
});
