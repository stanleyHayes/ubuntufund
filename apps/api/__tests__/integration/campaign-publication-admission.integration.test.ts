import { MongoCampaignCreation } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignCreation.js';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { SUBSCRIPTION_PLANS, SubscriptionTier } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { MongoPublicationAdmission } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.js';
import { PublicationReviewModel } from '../../src/infrastructure/database/models/PublicationReviewModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { KYCVerificationModel } from '../../src/infrastructure/database/models/KYCVerificationModel.js';
import { SubscriptionPlanModel } from '../../src/infrastructure/database/models/SubscriptionPlanModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
process.env.CAMPAIGN_AUTO_APPROVE_MAX_TIER = '5';
let app: Express;
const screen = vi.fn<(_: string) => Promise<'allowed' | 'flagged'>>();
beforeAll(async () => {
  await connectTestDatabase(); await PublicationReviewModel.init();
  app = await createTestApp({ publicationAdmission: new MongoPublicationAdmission({ screen }) });
  await SubscriptionPlanModel.findOneAndUpdate({ tier: SubscriptionTier.FREE }, { ...SUBSCRIPTION_PLANS[SubscriptionTier.FREE], maxCampaignGoal: 2_000_000, maxActiveCampaigns: 20 }, { upsert: true });
});
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function account(admin = false) {
  const response = await request(app).post('/api/v1/auth/register').send({ name: 'Campaign safety fixture', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const id = response.body.data.user.id;
  await UserModel.findByIdAndUpdate(id, { verificationLevel: 3, ...(admin ? { role: 'admin' } : {}) });
  return { id, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
const input = () => ({ title: `School ${randomUUID()}`, description: 'A proposed public school improvement campaign.', goalAmount: 500, currency: 'GHS', category: 'education', priority: 'normal', beneficiaries: ['School community'], endDate: new Date(Date.now() + 30 * 86400000).toISOString() });
async function approve(actorId: string, admin: Awaited<ReturnType<typeof account>>, action = 'campaign.create') {
  const review = await PublicationReviewModel.findOne({ actorId, action, status: 'pending' });
  expect(review).toBeTruthy();
  await request(app).put(`/api/v1/admin/publication-reviews/${review!.id}/review`).set('Authorization', admin.auth).send({ decision: 'approved', notes: 'Reviewed the complete proposed version and each public media attachment.' }).expect(200);
  return review!;
}
it('holds creation privately without consent and only creates the exact approved version', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account(), admin = await account(true), payload = input();
  const create = (body: object) => request(app).post('/api/v1/campaigns').set('Authorization', owner.auth).send(body);
  await create(payload).expect(409); await create(payload).expect(409);
  expect(screen).not.toHaveBeenCalled();
  expect(await CampaignModel.countDocuments({ creatorId: owner.id })).toBe(0);
  expect(await PublicationReviewModel.countDocuments({ actorId: owner.id })).toBe(1);
  const review = await approve(owner.id, admin);
  expect(JSON.parse(review.text)).toMatchObject(payload);
  await create({ ...payload, goalAmount: 501 }).expect(409);
  const created = await create(payload).expect(201);
  expect(created.body.data.status).toBe('active');
  expect(await CampaignModel.countDocuments({ creatorId: owner.id })).toBe(1);
});
it('keeps safety holds independent from verified returning organizer financial approval', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account(), admin = await account(true);
  await KYCVerificationModel.create({ userId: owner.id, verificationType: 'identity', status: 'approved', documents: [], expiryDate: new Date(Date.now() + 86400000), riskLevel: 'low' });
  const create = (body: object) => request(app).post('/api/v1/campaigns').set('Authorization', owner.auth).send(body);
  const first = await create({ ...input(), goalAmount: 300000, automatedReviewConsent: true }).expect(201);
  expect(first.body.data.status).toBe('pending_review');
  // Published-history fixture; legacy financial-review workflow is audited separately.
  await CampaignModel.findByIdAndUpdate(first.body.data.id, { status: 'active' });
  const payload = { ...input(), goalAmount: 300001, automatedReviewConsent: true };
  screen.mockResolvedValueOnce('flagged');
  await create(payload).expect(409);
  expect(await CampaignModel.countDocuments({ creatorId: owner.id })).toBe(1);
  await approve(owner.id, admin);
  expect((await create(payload).expect(201)).body.data.status).toBe('active');
});
it('holds provider failures and media, and rechecks restrictions and verification after screening', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account();
  const create = (body: object) => request(app).post('/api/v1/campaigns').set('Authorization', owner.auth).send(body);
  screen.mockRejectedValueOnce(new Error('Unavailable fixture provider'));
  await create({ ...input(), automatedReviewConsent: true }).expect(409);
  await create({ ...input(), imageUrls: ['https://media.example.test/photo.jpg'], automatedReviewConsent: true }).expect(409);
  expect(screen).toHaveBeenCalledTimes(1);
  screen.mockImplementationOnce(async () => { await UserModel.findByIdAndUpdate(owner.id, { verificationLevel: 0 }); return 'allowed'; });
  await create({ ...input(), automatedReviewConsent: true }).expect(403);
  await UserModel.findByIdAndUpdate(owner.id, { verificationLevel: 3 });
  screen.mockImplementationOnce(async () => { await ContentRestrictionModel.create({ userId: owner.id, reason: 'Restricted while checking', restrictedBy: 'fixture' }); return 'allowed'; });
  await create({ ...input(), automatedReviewConsent: true }).expect(403);
  expect(await CampaignModel.countDocuments({ creatorId: owner.id })).toBe(0);
});
it('reviews URL replacements and preserves concurrent donations and moderation state', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account(), admin = await account(true);
  const created = await request(app).post('/api/v1/campaigns').set('Authorization', owner.auth).send({ ...input(), automatedReviewConsent: true }).expect(201);
  const id = created.body.data.id, original = created.body.data.slug, path = `/api/v1/campaigns/${id}/slug`;
  await request(app).patch(path).set('Authorization', owner.auth).send({ slug: 'private-proposed-url' }).expect(409);
  expect((await CampaignModel.findById(id))?.slug).toBe(original);
  await approve(owner.id, admin, 'campaign.slug');
  await request(app).patch(path).set('Authorization', owner.auth).send({ slug: 'private-proposed-url' }).expect(200);
  screen.mockImplementationOnce(async () => { await CampaignModel.updateOne({ _id: id }, { $set: { raisedAmount: 175.25, status: 'blocked' } }); return 'allowed'; });
  await request(app).patch(path).set('Authorization', owner.auth).send({ slug: 'reviewed-new-url', automatedReviewConsent: true }).expect(200);
  const stored = await CampaignModel.findById(id);
  expect(stored?.raisedAmount).toBe(175.25); expect(stored?.status).toBe('blocked');
  screen.mockImplementationOnce(async () => { await CampaignModel.updateOne({ _id: id }, { $set: { slug: 'concurrent-url' } }); return 'allowed'; });
  await request(app).patch(path).set('Authorization', owner.auth).send({ slug: 'stale-new-url', automatedReviewConsent: true }).expect(409);
  expect((await CampaignModel.findById(id))?.slug).toBe('concurrent-url');
  screen.mockImplementationOnce(async () => { await UserModel.findByIdAndUpdate(admin.id, { role: 'user' }); return 'allowed'; });
  await request(app).patch(path).set('Authorization', admin.auth).send({ slug: 'revoked-staff-url', automatedReviewConsent: true }).expect(403);
  expect((await CampaignModel.findById(id))?.slug).toBe('concurrent-url');
  await request(app).get(`/api/v1/campaigns/${id}`).expect(404);
});

it.each(['expired', 'rejected', 'removed'])('refuses %s content approval between screening and campaign commit', async change => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account();
  let entered = false;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const original = MongoCampaignCreation.prototype.run;
  const spy = vi.spyOn(MongoCampaignCreation.prototype, 'run').mockImplementationOnce(async function<T>(...args: Parameters<typeof original>): Promise<T> { entered = true; await gate; return original.apply(this, args) as Promise<T>; });
  const response = request(app).post('/api/v1/campaigns').set('Authorization', owner.auth).send({ ...input(), automatedReviewConsent: true }).then(value => value);
  try {
    await expect.poll(() => entered).toBe(true);
    const where = { actorId: owner.id, action: 'campaign.create' };
    if (change === 'removed') await PublicationReviewModel.deleteOne(where);
    else await PublicationReviewModel.updateOne(where, { $set: change === 'expired' ? { approvalExpiresAt: new Date('2020-01-01') } : { status: 'rejected' } });
    release();
    expect((await response).status).toBe(409);
    expect(await CampaignModel.countDocuments({ creatorId: owner.id })).toBe(0);
    expect(screen).toHaveBeenCalledTimes(1);
  } finally { release(); await response; spy.mockRestore(); }
});
