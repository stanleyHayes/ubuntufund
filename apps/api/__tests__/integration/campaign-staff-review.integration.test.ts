import { KYCVerificationModel } from '../../src/infrastructure/database/models/KYCVerificationModel.js';
import { LiveSessionModel } from '../../src/infrastructure/database/models/LiveSessionModel.js';
import { MongoLiveSafety } from '../../src/infrastructure/adapters/outbound/persistence/MongoLiveSafety.js';
import { MongoUserBlockRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoUserBlockRepository.js';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { CampaignReviewModel } from '../../src/infrastructure/database/models/CampaignReviewModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
import { MongoCampaignRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.js';
import { MongoCampaignReview } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignReview.js';
import { MongoAccountErasure } from '../../src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.js';
let app: Express;
beforeAll(async () => { await connectTestDatabase(); await CampaignReviewModel.init(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function account(admin = false) {
  const response = await request(app).post('/api/v1/auth/register').send({ name: 'Staff review fixture', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const id = response.body.data.user.id;
  await UserModel.findByIdAndUpdate(id, { verificationLevel: 3, ...(admin ? { role: 'admin' } : {}) });
  return { id, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
async function fixture() {
  const owner = await account(), admin = await account(true);
  const campaign = await CampaignModel.create({ title: 'Legacy school fundraiser', description: 'The complete legacy public story being reviewed.', goalAmount: 300000, raisedAmount: 35.5, currency: 'GHS', category: 'education', status: 'pending_review', creatorId: owner.id, beneficiaries: ['School community'], imageUrls: ['https://media.example.test/photo.jpg'], startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
  const path = `/api/v1/campaigns/${campaign.id}`;
  const current = async () => (await request(app).get(path).set('Authorization', admin.auth).expect(200)).body.data;
  return { owner, admin, campaign, path, current };
}
const notes = 'Reviewed the complete public content, media, verification and fundraising evidence.';
const decision = (expectedVersion: string, action = 'approve') => ({ expectedVersion, action, reason: notes, contentReviewed: true, fundraisingReviewed: true });
it('requires explicit complete-version review and commits immutable evidence with safe retries', async () => {
  const f = await fixture(), preview = await f.current();
  await request(app).get(f.path).expect(404);
  expect((await request(app).get(f.path).set('Authorization', f.owner.auth).expect(200)).body.data).not.toHaveProperty('reviewVersion');
  await request(app).put(`${f.path}/approve`).set('Authorization', f.admin.auth).send({}).expect(400);
  await request(app).put(`${f.path}/approve`).set('Authorization', f.admin.auth).send({ ...decision(preview.reviewVersion), contentReviewed: false }).expect(400);
  await request(app).put(`${f.path}/review`).set('Authorization', f.owner.auth).send(decision(preview.reviewVersion)).expect(403);
  const input = decision(preview.reviewVersion);
  await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(input).expect(200);
  const restarted = await createTestApp();
  await request(restarted).put(`${f.path}/approve`).set('Authorization', f.admin.auth).send(input).expect(200);
  await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send({ ...input, reason: 'A different decision note cannot replace immutable evidence.' }).expect(409);
  const stored = await CampaignModel.findById(f.campaign.id);
  expect(stored?.status).toBe('active'); expect(stored?.raisedAmount).toBe(35.5); expect(stored?.reviewRevision).toBe(1);
  expect(await CampaignReviewModel.countDocuments({ campaignId: f.campaign.id })).toBe(1);
  const record = await CampaignReviewModel.findOne({ campaignId: f.campaign.id });
  expect(record?.snapshot).toMatchObject({ description: f.campaign.description, goalAmount: 300000, imageUrls: f.campaign.imageUrls });
  expect(record?.snapshot).not.toHaveProperty('raisedAmount');
  expect(await AuditLogModel.countDocuments({ resource: f.campaign.id, action: 'campaign.approve' })).toBe(1);
  await request(app).get(`${f.path}/reviews`).set('Authorization', f.owner.auth).expect(403);
  const history = await request(app).get(`${f.path}/reviews`).set('Authorization', f.admin.auth).expect(200);
  expect(history.headers['cache-control']).toBe('private, no-store'); expect(history.body.data.total).toBe(1);
  expect(history.body.data.items[0].actorId).toBe(f.admin.id);
});
it('rolls back the status, revision and decision when audit persistence fails', async () => {
  const f = await fixture(), preview = await f.current();
  const fault = vi.spyOn(AuditLogModel, 'create').mockRejectedValueOnce(new Error('Injected audit fault') as never);
  try { await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(decision(preview.reviewVersion)).expect(500); } finally { fault.mockRestore(); }
  const stored = await CampaignModel.findById(f.campaign.id);
  expect(stored?.status).toBe('pending_review'); expect(stored?.reviewRevision).toBe(0);
  expect(await CampaignReviewModel.countDocuments({ campaignId: f.campaign.id })).toBe(0);
  await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(decision(preview.reviewVersion)).expect(200);
});
it('rejects a stale content snapshot and preserves a concurrent financial update', async () => {
  const f = await fixture(), preview = await f.current();
  const original = MongoCampaignRepository.prototype.findById;
  let changed = false;
  const race = vi.spyOn(MongoCampaignRepository.prototype, 'findById').mockImplementation(async function (id) {
    const record = await original.call(this, id);
    if (!changed) { changed = true; await CampaignModel.updateOne({ _id: id }, { $set: { title: 'A concurrently changed story title' } }, { session: null }); }
    return record;
  });
  try { await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(decision(preview.reviewVersion)).expect(409); } finally { race.mockRestore(); }
  const fresh = await f.current();
  changed = false;
  const donation = vi.spyOn(MongoCampaignRepository.prototype, 'findById').mockImplementation(async function (id) {
    const record = await original.call(this, id);
    if (!changed) { changed = true; await CampaignModel.updateOne({ _id: id }, { $inc: { raisedAmount: 17.25 } }, { session: null }); }
    return record;
  });
  try { await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(decision(fresh.reviewVersion)).expect(200); } finally { donation.mockRestore(); }
  expect((await CampaignModel.findById(f.campaign.id))?.raisedAmount).toBe(52.75);
});
it('returns blocked campaigns to private review with a fresh version and prevents unsafe approval', async () => {
  const f = await fixture(), initial = await f.current();
  await request(app).put(`${f.path}/reject`).set('Authorization', f.admin.auth).send(decision(initial.reviewVersion, 'reject')).expect(200);
  const blocked = await f.current();
  await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(decision(blocked.reviewVersion, 'reopen')).expect(200);
  await request(app).get(f.path).expect(404);
  const pending = await f.current();
  expect(pending.status).toBe('pending_review'); expect(pending.reviewVersion).not.toBe(initial.reviewVersion);
  await ContentRestrictionModel.create({ userId: f.owner.id, reason: 'Publishing hold fixture', restrictedBy: f.admin.id });
  await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(decision(pending.reviewVersion)).expect(409);
  expect(await CampaignReviewModel.countDocuments({ campaignId: f.campaign.id })).toBe(2);
});
it('rechecks staff credentials and forbids self-review, and erases duplicate content while retaining financial references', async () => {
  const f = await fixture(), preview = await f.current();
  await UserModel.findByIdAndUpdate(f.owner.id, { role: 'admin' });
  await request(app).put(`${f.path}/review`).set('Authorization', f.owner.auth).send(decision(preview.reviewVersion)).expect(403);
  const original = MongoCampaignReview.prototype.decide;
  const revoke = vi.spyOn(MongoCampaignReview.prototype, 'decide').mockImplementationOnce(async function (input) {
    await UserModel.findByIdAndUpdate(input.actorId, { authVersion: 'revoked-during-request' });
    return original.call(this, input);
  });
  try { await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(decision(preview.reviewVersion)).expect(403); } finally { revoke.mockRestore(); }
  // Use a different current administrator after revoking the first session.
  const other = await account(true);
  await request(app).put(`${f.path}/review`).set('Authorization', other.auth).send(decision(preview.reviewVersion)).expect(200);
  await new MongoAccountErasure().request(f.owner.id);
  const review = await CampaignReviewModel.findOne({ campaignId: f.campaign.id }).lean();
  expect(review?.snapshot).toBeUndefined(); expect(review?.snapshotErasedAt).toBeInstanceOf(Date);
  expect(review?.version).toBe(preview.reviewVersion);
  expect((await CampaignModel.findById(f.campaign.id))?.raisedAmount).toBe(35.5);
  expect(await AuditLogModel.exists({ resource: f.campaign.id, action: 'campaign.approve' })).toBeTruthy();
});

it('retains the funded milestone when approving a previously funded campaign again', async () => {
  const f = await fixture();
  await CampaignModel.updateOne({ _id: f.campaign.id }, { $set: { status: 'funded', raisedAmount: 300100 } });
  const funded = await f.current();
  await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(decision(funded.reviewVersion, 'block')).expect(200);
  const blocked = await f.current();
  await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(decision(blocked.reviewVersion, 'reopen')).expect(200);
  const pending = await f.current();
  const approved = await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(decision(pending.reviewVersion)).expect(200);
  expect(approved.body.data.status).toBe('funded');
  expect(approved.body.data.raisedAmount).toBe(300100);
});

it('queues live shutdown atomically with a block and retries provider failures', async () => {
  const f = await fixture();
  await CampaignModel.updateOne({ _id: f.campaign.id }, { $set: { status: 'active' } });
  const live = await LiveSessionModel.create({ campaignId: f.campaign.id, status: 'active', title: 'Live classroom fixture', overlayToken: 'test-only-overlay', providerRoomIssuedAt: new Date() });
  const preview = await f.current();
  const input = decision(preview.reviewVersion, 'block');
  const fault = vi.spyOn(AuditLogModel, 'create').mockRejectedValueOnce(new Error('Audit rollback fixture') as never);
  try { await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(input).expect(500); } finally { fault.mockRestore(); }
  expect((await LiveSessionModel.findById(live.id))?.status).toBe('active');
  await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(input).expect(200);
  const ended = await LiveSessionModel.findById(live.id);
  expect(ended?.status).toBe('ended'); expect(ended?.overlayToken).toBe(''); expect(ended?.providerStopPending).toBe(true);
  const safety = new MongoLiveSafety(new MongoUserBlockRepository());
  await expect(safety.assertSessionVisible(live.id)).rejects.toThrow('Broadcast unavailable');
  const video = { enabled: true, removeIdentity: vi.fn().mockResolvedValue(undefined), closeRoom: vi.fn().mockRejectedValueOnce(new Error('Provider unavailable')) };
  await safety.reconcile(video);
  expect((await LiveSessionModel.findById(live.id))?.providerStopPending).toBe(true);
  video.closeRoom.mockResolvedValue(undefined);
  await safety.reconcile(video);
  expect((await LiveSessionModel.findById(live.id))?.providerStopPending).toBe(false);
  expect(video.closeRoom).toHaveBeenCalledWith(live.id);
});

it('denies staff publication above the current evidence allowance and permits renewed evidence', async () => {
  const f = await fixture();
  await CampaignModel.create({ title: 'Earlier campaign fixture', description: 'Earlier historical campaign', goalAmount: 100, raisedAmount: 20, currency: 'GHS', category: 'education', status: 'active', creatorId: f.owner.id, beneficiaries: [], startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
  const evidence = await KYCVerificationModel.create({ userId: f.owner.id, verificationType: 'identity', status: 'approved', expiryDate: new Date('2020-01-01'), documents: [] });
  const preview = await f.current();
  await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(decision(preview.reviewVersion)).expect(409);
  expect((await CampaignModel.findById(f.campaign.id))?.status).toBe('pending_review');
  expect((await CampaignModel.findById(f.campaign.id))?.raisedAmount).toBe(35.5);
  expect(await CampaignReviewModel.countDocuments({ campaignId: f.campaign.id })).toBe(0);
  await KYCVerificationModel.updateOne({ _id: evidence.id }, { $set: { expiryDate: new Date('2099-01-01') } });
  await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(decision(preview.reviewVersion)).expect(200);
});
