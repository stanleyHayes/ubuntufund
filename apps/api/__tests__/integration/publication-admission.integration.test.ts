import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { MongoPublicationAdmission } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.js';
import { PublicationReviewModel } from '../../src/infrastructure/database/models/PublicationReviewModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { CampaignCommentModel } from '../../src/infrastructure/database/models/CampaignCommentModel.js';
import { CampaignUpdateModel } from '../../src/infrastructure/database/models/CampaignUpdateModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { LiveSessionModel } from '../../src/infrastructure/database/models/LiveSessionModel.js';
let app: Express;
const screen = vi.fn<(_: string) => Promise<'allowed' | 'flagged'>>();
beforeAll(async () => { await connectTestDatabase(); await PublicationReviewModel.init(); app = await createTestApp({ publicationAdmission: new MongoPublicationAdmission({ screen }) }); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function account() {
  const response = await request(app).post('/api/v1/auth/register').send({ name: 'Publication reviewer', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { id: response.body.data.user.id, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
async function fixture() {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account(), admin = await account(), other = await account();
  await UserModel.findByIdAndUpdate(admin.id, { role: 'admin' });
  const campaign = await CampaignModel.create({ title: 'Publication fixture', description: 'A public campaign', goalAmount: 500, currency: 'GHS', category: 'education', status: 'active', creatorId: owner.id, startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
  return { owner, admin, other, campaign, comments: `/api/v1/campaigns/${campaign.id}/comments`, updates: `/api/v1/campaigns/${campaign.id}/updates` };
}
const notes = 'Reviewed the complete proposed public version against community rules.';
it('holds live metadata privately, binds staff approval to the exact title and starts only approved content', async () => {
  const f = await fixture();
  await SubscriptionModel.create({ userId: f.owner.id, tier: 'pro', status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000) });
  const path = `/api/v1/campaigns/${f.campaign.id}/live-sessions`;
  const input = { title: 'A proposed fundraising broadcast', targetAmount: 250 };
  await request(app).post(path).set('Authorization', f.other.auth).send(input).expect(403);
  await request(app).post(path).set('Authorization', f.owner.auth).send(input).expect(409);
  expect(screen).not.toHaveBeenCalled();
  expect(await LiveSessionModel.countDocuments({ campaignId: f.campaign.id })).toBe(0);
  const review = await PublicationReviewModel.findOne({ actorId: f.owner.id, action: 'live.start' });
  expect(review).not.toBeNull();
  await request(app).put(`/api/v1/admin/publication-reviews/${review!.id}/review`).set('Authorization', f.admin.auth).send({ decision: 'approved', notes }).expect(200);
  await request(app).post(path).set('Authorization', f.owner.auth).send({ ...input, title: 'Unreviewed replacement' }).expect(409);
  expect(await LiveSessionModel.countDocuments({ campaignId: f.campaign.id })).toBe(0);
  const started = await request(app).post(path).set('Authorization', f.owner.auth).send(input).expect(201);
  expect(started.body.data.title).toBe(input.title);
  expect(await LiveSessionModel.countDocuments({ campaignId: f.campaign.id })).toBe(1);
});

it('withholds live sessions when screening flags content, fails, or the campaign closes during screening', async () => {
  const f = await fixture();
  await SubscriptionModel.create({ userId: f.owner.id, tier: 'pro', status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000) });
  const path = `/api/v1/campaigns/${f.campaign.id}/live-sessions`;
  screen.mockResolvedValueOnce('flagged');
  await request(app).post(path).set('Authorization', f.owner.auth).send({ title: 'Flagged version', automatedReviewConsent: true }).expect(409);
  screen.mockRejectedValueOnce(new Error('Screening unavailable'));
  await request(app).post(path).set('Authorization', f.owner.auth).send({ title: 'Unavailable version', automatedReviewConsent: true }).expect(409);
  screen.mockImplementationOnce(async () => { await CampaignModel.updateOne({ _id: f.campaign.id }, { $set: { status: 'blocked' } }); return 'allowed'; });
  await request(app).post(path).set('Authorization', f.owner.auth).send({ title: 'Previously available campaign', automatedReviewConsent: true }).expect(409);
  expect(await LiveSessionModel.countDocuments({ campaignId: f.campaign.id })).toBe(0);
});

it('holds without cloud consent, deduplicates retries, isolates evidence and permits the exact staff-approved version', async () => {
  const f = await fixture();
  const input = { content: 'My proposed public comment' };
  await Promise.all([1, 2].map(() => request(app).post(f.comments).set('Authorization', f.owner.auth).send(input).expect(409)));
  expect(screen).not.toHaveBeenCalled();
  expect(await CampaignCommentModel.countDocuments({ campaignId: f.campaign.id })).toBe(0);
  const review = await PublicationReviewModel.findOne({ actorId: f.owner.id });
  expect(await PublicationReviewModel.countDocuments({ actorId: f.owner.id })).toBe(1);
  await request(app).get('/api/v1/publication-reviews').expect(401);
  expect((await request(app).get('/api/v1/publication-reviews').set('Authorization', f.other.auth).expect(200)).body.data.items).toEqual([]);
  const mine = await request(app).get('/api/v1/publication-reviews').set('Authorization', f.owner.auth).expect(200);
  expect(mine.headers['cache-control']).toBe('private, no-store');
  expect(mine.body.data.items[0]).not.toHaveProperty('fingerprint');
  const path = `/api/v1/admin/publication-reviews/${review!.id}/review`;
  await request(app).put(path).set('Authorization', f.owner.auth).send({ decision: 'approved', notes }).expect(403);
  await request(app).put(path).set('Authorization', f.admin.auth).send({ decision: 'approved', notes }).expect(200);
  const restarted = await createTestApp({ publicationAdmission: new MongoPublicationAdmission({ screen }) });
  await request(restarted).post(f.comments).set('Authorization', f.owner.auth).send(input).expect(201);
  await request(app).post(f.comments).set('Authorization', f.owner.auth).send({ content: 'Different text cannot reuse approval' }).expect(409);
  await request(app).post(f.comments).set('Authorization', f.other.auth).send(input).expect(409);
  expect(await CampaignCommentModel.countDocuments({ campaignId: f.campaign.id })).toBe(1);
  expect(await AuditLogModel.exists({ action: 'publication.approved', resource: review!.id })).toBeTruthy();
});
it('screens only opted-in public text and holds flagged, failed or media submissions', async () => {
  const f = await fixture();
  await request(app).post(f.comments).set('Authorization', f.owner.auth).send({ content: 'Allowed public text', automatedReviewConsent: true }).expect(201);
  expect(screen).toHaveBeenLastCalledWith('Allowed public text');
  screen.mockResolvedValueOnce('flagged');
  await request(app).post(f.comments).set('Authorization', f.owner.auth).send({ content: 'Flagged fixture text', automatedReviewConsent: true }).expect(409);
  screen.mockRejectedValueOnce(new Error('Provider unavailable'));
  await request(app).post(f.comments).set('Authorization', f.owner.auth).send({ content: 'Unavailable fixture text', automatedReviewConsent: true }).expect(409);
  const calls = screen.mock.calls.length;
  await request(app).post(f.updates).set('Authorization', f.owner.auth).send({ title: 'Media update', content: 'Review the photo too', type: 'general', mediaUrls: ['https://media.example.test/photo.jpg'], automatedReviewConsent: true }).expect(409);
  expect(screen).toHaveBeenCalledTimes(calls);
  expect(await CampaignUpdateModel.countDocuments({ campaignId: f.campaign.id })).toBe(0);
  expect(await CampaignCommentModel.countDocuments({ campaignId: f.campaign.id })).toBe(1);
  expect((await PublicationReviewModel.find({ actorId: f.owner.id, status: 'pending' })).map(row => row.reason).sort()).toEqual(['flagged', 'media', 'unavailable']);
});
it('screens merged edits, leaves existing text public while held, and fences concurrent edits', async () => {
  const f = await fixture();
  const original = await CampaignUpdateModel.create({ campaignId: f.campaign.id, authorId: f.owner.id, title: 'Original title', content: 'Original story', type: 'general', mediaUrls: [] });
  const path = `${f.updates}/${original.id}`;
  await request(app).put(path).set('Authorization', f.owner.auth).send({ title: 'Replacement title' }).expect(409);
  expect((await CampaignUpdateModel.findById(original.id))?.title).toBe('Original title');
  const held = await PublicationReviewModel.findOne({ actorId: f.owner.id });
  expect(held!.text).toContain('Original story');
  await request(app).put(`/api/v1/admin/publication-reviews/${held!.id}/review`).set('Authorization', f.admin.auth).send({ decision: 'approved', notes }).expect(200);
  await request(app).put(path).set('Authorization', f.owner.auth).send({ title: 'Replacement title' }).expect(200);
  screen.mockImplementationOnce(async () => {
    await CampaignUpdateModel.updateOne({ _id: original.id }, { $set: { content: 'A concurrently published version' } });
    return 'allowed';
  });
  await request(app).put(path).set('Authorization', f.owner.auth).send({ title: 'Concurrent replacement', automatedReviewConsent: true }).expect(409);
  expect((await CampaignUpdateModel.findById(original.id))?.content).toBe('A concurrently published version');
});
it('atomically audits staff decisions and preserves them across retries and restrictions', async () => {
  const f = await fixture();
  const input = { content: 'A held comment for review' };
  await request(app).post(f.comments).set('Authorization', f.owner.auth).send(input).expect(409);
  const review = await PublicationReviewModel.findOne({ actorId: f.owner.id });
  const path = `/api/v1/admin/publication-reviews/${review!.id}/review`;
  const fault = vi.spyOn(AuditLogModel, 'create').mockRejectedValueOnce(new Error('Injected audit failure') as never);
  try { await request(app).put(path).set('Authorization', f.admin.auth).send({ decision: 'approved', notes }).expect(500); } finally { fault.mockRestore(); }
  expect((await PublicationReviewModel.findById(review!.id))?.status).toBe('pending');
  await request(app).put(path).set('Authorization', f.admin.auth).send({ decision: 'approved', notes }).expect(200);
  await request(app).put(path).set('Authorization', f.admin.auth).send({ decision: 'approved', notes }).expect(200);
  await request(app).put(path).set('Authorization', f.admin.auth).send({ decision: 'rejected', notes }).expect(409);
  await ContentRestrictionModel.create({ userId: f.owner.id, reason: 'Restricted fixture author', restrictedBy: f.admin.id });
  await request(app).post(f.comments).set('Authorization', f.owner.auth).send(input).expect(403);
  expect(await CampaignCommentModel.countDocuments({ campaignId: f.campaign.id })).toBe(0);
});
it('rechecks restrictions imposed while automated screening is in flight', async () => {
  const f = await fixture();
  screen.mockImplementationOnce(async () => {
    await ContentRestrictionModel.create({ userId: f.owner.id, reason: 'Restriction during screening', restrictedBy: f.admin.id });
    return 'allowed';
  });
  await request(app).post(f.comments).set('Authorization', f.owner.auth).send({ content: 'Do not publish after restriction', automatedReviewConsent: true }).expect(403);
  expect(await CampaignCommentModel.countDocuments({ campaignId: f.campaign.id })).toBe(0);
});
it('screens the organization-team update path and exposes pending work in the admin queue', async () => {
  const f = await fixture();
  await UserModel.findByIdAndUpdate(f.owner.id, { role: 'organization', organizationName: 'Verified organizer', verificationLevel: 2 });
  const path = `/api/v1/organization-team/${f.owner.id}/campaigns/${f.campaign.id}/updates`;
  const input = { title: 'Team update', content: 'Full proposed organization update' };
  await request(app).post(path).set('Authorization', f.owner.auth).send(input).expect(409);
  expect(await CampaignUpdateModel.countDocuments({ campaignId: f.campaign.id })).toBe(0);
  const review = await PublicationReviewModel.findOne({ actorId: f.owner.id });
  const counts = (await request(app).get('/api/v1/admin/action-center').set('Authorization', f.admin.auth).expect(200)).body.data.items;
  expect(counts.find((row: { id: string }) => row.id === 'publication-reviews').count).toBeGreaterThan(0);
  await request(app).put(`/api/v1/admin/publication-reviews/${review!.id}/review`).set('Authorization', f.admin.auth).send({ decision: 'approved', notes }).expect(200);
  await request(app).post(path).set('Authorization', f.owner.auth).send(input).expect(200);
  expect((await CampaignUpdateModel.findOne({ campaignId: f.campaign.id }))?.authorId).toBe(f.owner.id);
});
it('rejects declined and expired versions, refuses self-review and erases private review drafts on account closure', async () => {
  const f = await fixture();
  const input = { content: 'Review lifecycle fixture' };
  await request(app).post(f.comments).set('Authorization', f.owner.auth).send(input).expect(409);
  const review = await PublicationReviewModel.findOne({ actorId: f.owner.id });
  expect(review!.purgeAt.getTime() - review!.createdAt.getTime()).toBeGreaterThan(29 * 86400000);
  await UserModel.findByIdAndUpdate(f.owner.id, { role: 'admin' });
  const path = `/api/v1/admin/publication-reviews/${review!.id}/review`;
  await request(app).put(path).set('Authorization', f.owner.auth).send({ decision: 'approved', notes }).expect(403);
  await request(app).put(path).set('Authorization', f.admin.auth).send({ decision: 'rejected', notes }).expect(200);
  await request(app).post(f.comments).set('Authorization', f.owner.auth).send(input).expect(422);
  const clean = { content: 'Previously allowed content', automatedReviewConsent: true };
  await request(app).post(f.comments).set('Authorization', f.other.auth).send(clean).expect(201);
  await PublicationReviewModel.updateOne({ actorId: f.other.id }, { $set: { approvalExpiresAt: new Date(0) } });
  await request(app).post(f.comments).set('Authorization', f.other.auth).send(clean).expect(409);
  const { MongoAccountErasure } = await import('../../src/infrastructure/adapters/outbound/persistence/MongoAccountErasure.js');
  await new MongoAccountErasure().request(f.owner.id);
  expect(await PublicationReviewModel.countDocuments({ actorId: f.owner.id })).toBe(0);
  expect(await UserModel.exists({ _id: f.owner.id })).toBeTruthy();
  expect(await AuditLogModel.exists({ resource: review!.id })).toBeTruthy();
});
