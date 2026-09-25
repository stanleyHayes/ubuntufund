import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { SubscriptionTier, SUBSCRIPTION_PLANS, VerificationLevel } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { KYCVerificationModel } from '../../src/infrastructure/database/models/KYCVerificationModel.js';
import { SubscriptionPlanModel } from '../../src/infrastructure/database/models/SubscriptionPlanModel.js';
import { MongoCampaignRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.js';

let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
beforeEach(async () => { await CampaignModel.deleteMany({}); });

const DAY = 86_400_000;
const legalAcceptance = { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true };

async function account(role?: 'admin') {
  const response = await request(app).post('/api/v1/auth/register').send({ name: 'Expiry fixture', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance }).expect(201);
  const id = response.body.data.user.id as string;
  if (role) await UserModel.findByIdAndUpdate(id, { role });
  return { id, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    slug: `c-${randomUUID()}`, title: 'Community water project', description: 'Clean water for the village',
    goalAmount: 1000, raisedAmount: 0, currency: 'GHS', category: 'community', creatorId: 'creator-fixture',
    status: 'active', startDate: new Date(Date.now() - 10 * DAY), endDate: new Date(Date.now() + 10 * DAY),
    ...overrides,
  };
}

it('frees a plan slot as soon as a campaign ends, so a Free organiser can create the next one', async () => {
  const organiser = await account();
  await UserModel.findByIdAndUpdate(organiser.id, { verificationLevel: VerificationLevel.NATIONAL_ID });
  await KYCVerificationModel.create({ userId: organiser.id, verificationType: 'identity', status: 'approved', expiryDate: new Date('2099-01-01'), documents: [] });
  await SubscriptionPlanModel.findOneAndUpdate({ tier: SubscriptionTier.FREE }, { ...SUBSCRIPTION_PLANS[SubscriptionTier.FREE], maxActiveCampaigns: 1 }, { upsert: true });
  const input = { title: 'First community campaign', description: 'Helping the local community with supplies', goalAmount: 100, currency: 'GHS', category: 'education', priority: 'normal', beneficiaries: ['Community'], endDate: new Date(Date.now() + 30 * DAY).toISOString() };
  const post = (body: object) => request(app).post('/api/v1/campaigns').set('Authorization', organiser.auth).send(body);
  const options = () => request(app).get('/api/v1/campaigns/creation-options').set('Authorization', organiser.auth).expect(200);

  const first = await post(input).expect(201);
  expect((await options()).body.data).toMatchObject({ activeCount: 1, canCreate: false, creationBlockReason: 'plan_limit' });
  await post({ ...input, title: 'Blocked by the plan' }).expect(403);

  // The campaign ends; the sweep has not run yet, so it is still stored as open.
  await CampaignModel.updateOne({ _id: first.body.data.id }, { $set: { endDate: new Date(Date.now() - 1000) } });
  const repo = new MongoCampaignRepository();
  expect(await repo.countActiveByCreator(organiser.id)).toBe(0);
  expect((await options()).body.data).toMatchObject({ activeCount: 0, totalCount: 1, canCreate: true, creationBlockReason: null });
  await post({ ...input, title: 'Second community campaign' }).expect(201);
  expect((await options()).body.data).toMatchObject({ activeCount: 1, totalCount: 2, canCreate: false, creationBlockReason: 'plan_limit' });
});

it('counts open, funded and pending campaigns but not ended, expired or blocked ones', async () => {
  const creatorId = `creator-${randomUUID()}`;
  const past = new Date(Date.now() - DAY);
  await CampaignModel.create([
    campaign({ creatorId, status: 'active' }),
    campaign({ creatorId, status: 'funded' }),
    campaign({ creatorId, status: 'pending_review' }),
    campaign({ creatorId, status: 'active', endDate: past }),
    campaign({ creatorId, status: 'funded', endDate: past }),
    campaign({ creatorId, status: 'pending_review', endDate: past }),
    campaign({ creatorId, status: 'expired', endDate: past }),
    campaign({ creatorId, status: 'blocked' }),
    campaign({ creatorId, status: 'active', deletedAt: new Date() }),
  ]);
  expect(await new MongoCampaignRepository().countActiveByCreator(creatorId)).toBe(3);
});

it('sweeps ended active and funded campaigns to expired, idempotently, and leaves everything else alone', async () => {
  const past = new Date(Date.now() - 60_000);
  const [endedActive, endedFunded, openActive, endedPending, endedBlocked, deleted] = await CampaignModel.create([
    campaign({ status: 'active', endDate: past, raisedAmount: 400 }),
    campaign({ status: 'funded', endDate: past, raisedAmount: 1200 }),
    campaign({ status: 'active' }),
    // Never published: re-labelling it EXPIRED would make it public.
    campaign({ status: 'pending_review', endDate: past }),
    campaign({ status: 'blocked', endDate: past }),
    campaign({ status: 'active', endDate: past, deletedAt: new Date() }),
  ]);
  expect(await app.locals.expireEndedCampaigns()).toBe(2);
  const status = async (id: unknown) => (await CampaignModel.findById(id).lean())!.status;
  expect(await status(endedActive._id)).toBe('expired');
  expect(await status(endedFunded._id)).toBe('expired');
  expect(await status(openActive._id)).toBe('active');
  expect(await status(endedPending._id)).toBe('pending_review');
  expect(await status(endedBlocked._id)).toBe('blocked');
  expect(await status(deleted._id)).toBe('active');
  // Totals are untouched and a second pass changes nothing.
  expect((await CampaignModel.findById(endedFunded._id).lean())!.raisedAmount).toBe(1200);
  expect(await app.locals.expireEndedCampaigns()).toBe(0);
  // An expired campaign stays a public page.
  expect((await request(app).get(`/api/v1/campaigns/${endedActive._id}`).expect(200)).body.data.status).toBe('expired');
});

it('filters public listings by effective status, so ended campaigns are expired before the sweep runs', async () => {
  const past = new Date(Date.now() - 60_000);
  const [open, funded, ended, swept] = await CampaignModel.create([
    campaign({ title: 'Open campaign' }),
    campaign({ title: 'Funded campaign', status: 'funded', raisedAmount: 1000 }),
    campaign({ title: 'Ended campaign', endDate: past }),
    campaign({ title: 'Swept campaign', status: 'expired', endDate: past }),
    campaign({ title: 'Pending campaign', status: 'pending_review' }),
  ]);
  const ids = async (query: string, auth?: string) => {
    const req = request(app).get(`/api/v1/campaigns?${query}`);
    if (auth) req.set('Authorization', auth);
    const res = await req.expect(200);
    return (res.body.data.items as { id: string }[]).map(item => item.id).sort();
  };
  expect(await ids('status=active')).toEqual([open.id]);
  expect(await ids('status=funded')).toEqual([funded.id]);
  expect(await ids('status=open')).toEqual([open.id, funded.id].sort());
  expect(await ids('status=expired')).toEqual([ended.id, swept.id].sort());
  expect(await ids('')).toHaveLength(4);
  // A guest asking for a non-public state still gets only public campaigns.
  expect(await ids('status=pending_review')).toHaveLength(4);
  const admin = await account('admin');
  const pending = await ids('status=pending_review', admin.auth);
  expect(pending).toHaveLength(1);
  await request(app).get('/api/v1/campaigns?status=bogus').expect(400);
});

it('searches, filters and pages on the server so campaigns beyond the first page are reachable', async () => {
  const base = Date.now() - 100 * DAY;
  await CampaignModel.create(Array.from({ length: 30 }, (_, index) => campaign({
    title: index === 0 ? 'Oldest (clinic) roof repair' : `Recent campaign ${index}`,
    category: index % 2 === 0 ? 'medical' : 'education',
    raisedAmount: index * 10,
  })).map((row, index) => ({ ...row, createdAt: new Date(base + index * DAY) })));

  const firstPage = await request(app).get('/api/v1/campaigns').expect(200);
  expect(firstPage.body.data).toMatchObject({ total: 30, pageSize: 20, totalPages: 2 });
  expect(firstPage.body.data.items.some((item: { title: string }) => item.title.startsWith('Oldest'))).toBe(false);

  // Search reaches the oldest campaign; regex metacharacters are plain text.
  const search = await request(app).get('/api/v1/campaigns').query({ q: '(clinic)' }).expect(200);
  expect(search.body.data.items.map((item: { title: string }) => item.title)).toEqual(['Oldest (clinic) roof repair']);
  expect((await request(app).get('/api/v1/campaigns').query({ q: '.*' }).expect(200)).body.data.total).toBe(0);
  await request(app).get('/api/v1/campaigns').query({ q: 'x'.repeat(101) }).expect(400);

  const medical = await request(app).get('/api/v1/campaigns?category=medical&pageSize=100').expect(200);
  expect(medical.body.data.total).toBe(15);
  expect(medical.body.data.items.every((item: { category: string }) => item.category === 'medical')).toBe(true);
  await request(app).get('/api/v1/campaigns?category=unknown').expect(400);

  // Pages do not overlap and together cover every campaign.
  const pages = await Promise.all([1, 2, 3].map(page => request(app).get(`/api/v1/campaigns?pageSize=12&page=${page}`).expect(200)));
  const seen = pages.flatMap(page => page.body.data.items.map((item: { id: string }) => item.id));
  expect(new Set(seen).size).toBe(30);
});

it('caps page size and only sorts by whitelisted fields', async () => {
  await CampaignModel.create(Array.from({ length: 105 }, (_, index) => campaign({ title: `Bulk ${index}`, goalAmount: 100, raisedAmount: index })));
  const capped = await request(app).get('/api/v1/campaigns?pageSize=100000').expect(200);
  expect(capped.body.data.pageSize).toBe(100);
  expect(capped.body.data.items).toHaveLength(100);
  expect((await request(app).get('/api/v1/campaigns?pageSize=0').expect(200)).body.data.pageSize).toBe(20);
  await request(app).get('/api/v1/campaigns?sortBy=creatorId').expect(400);
  await request(app).get('/api/v1/campaigns?sortBy=__proto__').expect(400);
  await request(app).get('/api/v1/campaigns?sortOrder=sideways').expect(400);

  const byPercent = await request(app).get('/api/v1/campaigns?sortBy=fundedPercent&sortOrder=desc&pageSize=3').expect(200);
  expect(byPercent.body.data.items.map((item: { raisedAmount: number }) => item.raisedAmount)).toEqual([104, 103, 102]);
  const endingSoon = await request(app).get('/api/v1/campaigns?sortBy=endDate&sortOrder=asc&status=open&pageSize=1').expect(200);
  expect(endingSoon.body.data.total).toBe(105);
});
