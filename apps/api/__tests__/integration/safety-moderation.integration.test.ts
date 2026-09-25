import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { CampaignCommentModel } from '../../src/infrastructure/database/models/CampaignCommentModel.js';
import { CampaignUpdateModel } from '../../src/infrastructure/database/models/CampaignUpdateModel.js';
import { SafetyReportModel } from '../../src/infrastructure/database/models/SafetyReportModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
import { ContentRestrictionEventModel } from '../../src/infrastructure/database/models/ContentRestrictionEventModel.js';
import { PublicationReviewModel } from '../../src/infrastructure/database/models/PublicationReviewModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { MongoPublicationAdmission } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.js';

let app: Express;
const screen = vi.fn<(_: string) => Promise<'allowed' | 'flagged'>>();
beforeAll(async () => {
  await connectTestDatabase();
  await Promise.all([SafetyReportModel.init(), PublicationReviewModel.init(), ContentRestrictionEventModel.init()]);
  // Real admission, so approval revocation is exercised end to end.
  app = await createTestApp({ publicationAdmission: new MongoPublicationAdmission({ screen }) });
  screen.mockResolvedValue('allowed');
});
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

async function user(name = 'Safety fixture', role?: 'admin') {
  const r = await request(app).post('/api/v1/auth/register').send({ name, email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const id = r.body.data.user.id as string;
  if (role) await UserModel.findByIdAndUpdate(id, { role });
  return { id, token: `Bearer ${r.body.data.tokens.accessToken}` };
}
async function campaign(creatorId: string, status = 'active') {
  return (await CampaignModel.create({ title: 'Moderation fixture', description: 'A campaign', goalAmount: 500, currency: 'GHS', category: 'education', status, creatorId, startDate: new Date(), endDate: new Date(Date.now() + 86400000) })).id as string;
}
const notes = 'Reviewed the reported content against the community rules.';
const report = (token: string, body: object) => request(app).post('/api/v1/safety/reports').set('Authorization', token).send({ reason: 'harassment', description: 'Please review this reported content.', ...body });
const review = (token: string, id: string, action: string, extra: object = {}) => request(app).put(`/api/v1/admin/safety-reports/${id}/review`).set('Authorization', token).send({ action, notes, ...extra });

it('requires a second administrator when the reviewer filed the report, wrote the content or owns the campaign', async () => {
  const reporter = await user(), adminAuthor = await user('Admin author', 'admin'), adminOwner = await user('Admin owner', 'admin'), other = await user('Other admin', 'admin');
  const campaignId = await campaign(adminOwner.id);
  const comment = await CampaignCommentModel.create({ campaignId, authorId: adminAuthor.id, content: 'Comment by an administrator' });
  const filed = (await report(reporter.token, { targetType: 'comment', targetId: comment.id }).expect(201)).body.data.id;
  await review(adminAuthor.token, filed, 'dismiss').expect(403);
  await review(adminOwner.token, filed, 'dismiss').expect(403);
  expect((await SafetyReportModel.findById(filed))?.reviewAction).toBeUndefined();
  const selfFiled = (await report(other.token, { targetType: 'user', targetId: reporter.id }).expect(201)).body.data.id;
  await review(other.token, selfFiled, 'dismiss').expect(403);
  await review(adminOwner.token, selfFiled, 'dismiss').expect(200);
  await review(other.token, filed, 'dismiss').expect(200);
});

it('refuses reports on removed comments or comments on campaigns the reporter cannot see, and keeps the original removal time', async () => {
  const reporter = await user(), author = await user(), admin = await user('Moderator', 'admin');
  const removed = await CampaignCommentModel.create({ campaignId: await campaign(author.id), authorId: author.id, content: 'Already removed', deletedAt: new Date() });
  await report(reporter.token, { targetType: 'comment', targetId: removed.id }).expect(404);
  const hiddenCampaign = await CampaignCommentModel.create({ campaignId: await campaign(author.id, 'pending_review'), authorId: author.id, content: 'On a pending campaign' });
  await report(reporter.token, { targetType: 'comment', targetId: hiddenCampaign.id }).expect(404);

  const live = await CampaignCommentModel.create({ campaignId: await campaign(author.id), authorId: author.id, content: 'Reported then deleted' });
  const id = (await report(reporter.token, { targetType: 'comment', targetId: live.id }).expect(201)).body.data.id;
  const deletedAt = new Date(Date.now() - 60_000);
  await CampaignCommentModel.updateOne({ _id: live.id }, { $set: { deletedAt } });
  await review(admin.token, id, 'hide_comment').expect(200);
  expect((await CampaignCommentModel.findById(live.id))?.deletedAt?.getTime()).toBe(deletedAt.getTime());
});

it('accepts intellectual-property and privacy reports', async () => {
  const reporter = await user(), target = await user();
  for (const reason of ['intellectual_property', 'privacy']) {
    await report(reporter.token, { targetType: 'user', targetId: target.id, reason }).expect(201);
    await SafetyReportModel.deleteMany({ reporterId: reporter.id });
  }
  const campaignId = await campaign(target.id);
  for (const reason of ['intellectual_property', 'privacy']) {
    const campaignReporter = await user();
    await request(app).post(`/api/v1/campaigns/${campaignId}/report`).set('Authorization', campaignReporter.token).send({ reason, description: 'This campaign uses my photographs without permission.' }).expect(201);
  }
});

it('keeps restriction history, lifts only an active restriction once, and guards restores from older reports', async () => {
  const reporterA = await user(), reporterB = await user(), author = await user(), admin = await user('Moderator', 'admin');
  const first = (await report(reporterA.token, { targetType: 'user', targetId: author.id }).expect(201)).body.data.id;
  const second = (await report(reporterB.token, { targetType: 'user', targetId: author.id }).expect(201)).body.data.id;
  await review(admin.token, first, 'restrict_user').expect(200);
  await review(admin.token, second, 'restrict_user', { notes: 'A second, later harassment finding for the same account.' }).expect(200);
  // Retrying a finished review does not duplicate history.
  expect(await ContentRestrictionEventModel.countDocuments({ userId: author.id, action: 'restrict' })).toBe(2);
  expect((await ContentRestrictionModel.findOne({ userId: author.id }))?.reportId).toBe(second);

  const listed = await request(app).get('/api/v1/admin/safety-reports/restrictions').set('Authorization', admin.token).expect(200);
  expect(listed.body.data.items.find((row: { userId: string }) => row.userId === author.id)).toMatchObject({ name: 'Safety fixture', reportId: second });
  await request(app).get('/api/v1/admin/safety-reports/restrictions').set('Authorization', author.token).expect(403);

  const restore = (body: object) => request(app).post(`/api/v1/admin/safety-reports/restrictions/${author.id}/restore`).set('Authorization', admin.token).send({ notes: 'Appeal reviewed and the restriction was lifted.', ...body });
  const refused = await restore({ reportId: first }).expect(409);
  // The refusal is marked and names the decision that governs the account now.
  expect(refused.body.errors).toMatchObject({ supersede: ['required'], currentReportId: [second] });
  expect(refused.body.errors.currentReason).toHaveLength(1);
  expect(await ContentRestrictionModel.exists({ userId: author.id })).toBeTruthy();
  // A confirmation for a different decision than the one governing now is refused.
  const stale = await restore({ reportId: first, confirmSupersede: true, supersedeReportId: first }).expect(409);
  expect(stale.body.errors).toMatchObject({ supersede: ['required'], currentReportId: [second] });
  expect(await ContentRestrictionModel.exists({ userId: author.id })).toBeTruthy();
  await restore({ reportId: first, confirmSupersede: true, supersedeReportId: second }).expect(200);
  await restore({}).expect(404);
  expect(await AuditLogModel.countDocuments({ action: 'safety.restore_public_content', resource: `user:${author.id}` })).toBe(1);
  expect(await ContentRestrictionEventModel.findOne({ userId: author.id, action: 'restore' }).lean()).toMatchObject({ liftedReportId: second });
});

it('lets staff restrict an account directly and never themselves', async () => {
  const author = await user(), admin = await user('Moderator', 'admin');
  const direct = (userId: string, token = admin.token) => request(app).post(`/api/v1/admin/safety-reports/restrictions/${userId}`).set('Authorization', token).send({ notes: 'Direct restriction after reviewing repeated abuse.' });
  await direct(author.id, author.token).expect(403);
  await direct(admin.id).expect(403);
  await direct('64b000000000000000000000').expect(404);
  await direct(author.id).expect(201);
  expect(await ContentRestrictionModel.findOne({ userId: author.id }).lean()).toMatchObject({ restrictedBy: admin.id });
  expect(await AuditLogModel.exists({ action: 'safety.restrict_user', resource: `user:${author.id}` })).toBeTruthy();
  await request(app).post(`/api/v1/admin/safety-reports/restrictions/${admin.id}/restore`).set('Authorization', admin.token).send({ notes: 'Attempting to lift my own restriction.' }).expect(403);
});

it('restricts the author of an edited update while still refusing to hide the unreviewed version', async () => {
  const owner = await user(), reporter = await user(), admin = await user('Moderator', 'admin');
  const campaignId = await campaign(owner.id);
  const update = await CampaignUpdateModel.create({ campaignId, authorId: owner.id, title: 'Progress', content: 'Reported version' });
  const hideId = (await report(reporter.token, { targetType: 'campaign_update', targetId: update.id }).expect(201)).body.data.id;
  await CampaignUpdateModel.updateOne({ _id: update.id }, { $set: { content: 'Edited after the report' } });
  await review(admin.token, hideId, 'hide_update').expect(409);
  await review(admin.token, hideId, 'restrict_user').expect(200);
  expect(await ContentRestrictionModel.exists({ userId: owner.id })).toBeTruthy();
  expect((await CampaignUpdateModel.findById(update.id))?.deletedAt).toBeUndefined();
  expect((await SafetyReportModel.findById(hideId))?.status).toBe('resolved');
});

it('withdraws the approval of removed content so the identical text cannot be reposted', async () => {
  const owner = await user(), author = await user('Commenter'), reporter = await user(), admin = await user('Moderator', 'admin');
  const campaignId = await campaign(owner.id);
  const body = { content: 'Identical text that moderation removed', automatedReviewConsent: true };
  const posted = await request(app).post(`/api/v1/campaigns/${campaignId}/comments`).set('Authorization', author.token).send(body).expect(201);
  const stored = await CampaignCommentModel.findById(posted.body.data.id).lean();
  expect(stored?.publicationFingerprint).toMatch(/^[a-f0-9]{64}$/);
  const id = (await report(reporter.token, { targetType: 'comment', targetId: posted.body.data.id }).expect(201)).body.data.id;
  await review(admin.token, id, 'hide_comment').expect(200);
  expect(await PublicationReviewModel.findOne({ fingerprint: stored!.publicationFingerprint }).lean()).toMatchObject({ status: 'rejected', reviewNotes: `Removed after safety report ${id}` });
  await request(app).post(`/api/v1/campaigns/${campaignId}/comments`).set('Authorization', author.token).send(body).expect(422);
  expect(await CampaignCommentModel.countDocuments({ campaignId, deletedAt: { $exists: false } })).toBe(0);

  // Updates: the hidden update's approval is withdrawn too.
  const update = { title: 'Weekly progress', content: 'Update text that moderation removed', type: 'general', automatedReviewConsent: true };
  const created = await request(app).post(`/api/v1/campaigns/${campaignId}/updates`).set('Authorization', owner.token).send(update).expect(201);
  const updateReport = (await report(reporter.token, { targetType: 'campaign_update', targetId: created.body.data.id }).expect(201)).body.data.id;
  await review(admin.token, updateReport, 'hide_update').expect(200);
  await request(app).post(`/api/v1/campaigns/${campaignId}/updates`).set('Authorization', owner.token).send(update).expect(422);
});
