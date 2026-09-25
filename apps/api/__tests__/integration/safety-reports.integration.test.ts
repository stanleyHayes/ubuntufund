import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignCommentModel } from '../../src/infrastructure/database/models/CampaignCommentModel.js';
import { SafetyReportModel } from '../../src/infrastructure/database/models/SafetyReportModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types';
let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); await SafetyReportModel.init(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
/** Reported comments must sit on a campaign the reporter can see. */
async function publicCampaign(creatorId = 'campaign-owner-fixture') {
  const campaign = await CampaignModel.create({ title: 'Safety fixture campaign', description: 'A public campaign', goalAmount: 500, currency: 'GHS', category: 'education', status: 'active', creatorId, startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
  return campaign.id as string;
}
async function user(name: string) {
  const r = await request(app).post('/api/v1/auth/register').send({ name, email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { id: r.body.data.user.id, token: `Bearer ${r.body.data.tokens.accessToken}` };
}
it('captures the displayed comment identity independently of later profile changes', async () => {
  const reporter = await user('Reporter'), author = await user('Current profile name');
  const comment = await CampaignCommentModel.create({ campaignId: await publicCampaign(), authorId: author.id, content: 'Reported comment', authorName: 'Reviewed author', authorAvatarUrl: 'https://example.test/reviewed.png' });
  await UserModel.updateOne({ _id: author.id }, { $set: { name: 'Changed profile name', avatarUrl: 'https://example.test/changed.png' } });
  const report = await request(app).post('/api/v1/safety/reports').set('Authorization', reporter.token).send({ targetType: 'comment', targetId: comment.id, reason: 'harassment', description: 'Review the displayed attribution and comment.' }).expect(201);
  const evidence = (await SafetyReportModel.findById(report.body.data.id))!.evidence;
  expect(JSON.parse(evidence!)).toEqual({ authorName: 'Reviewed author', authorAvatarUrl: 'https://example.test/reviewed.png', comment: 'Reported comment' });
  expect(evidence).not.toContain('Changed profile name');
});

it('protects reporter identity, keeps evidence after removal, prioritizes urgency and audits moderation', async () => {
  const reporter = await user('Reporter'), author = await user('Author'), admin = await user('Moderator');
  await UserModel.findByIdAndUpdate(admin.id, { role: 'admin' });
  const comment = await CampaignCommentModel.create({ campaignId: await publicCampaign(), authorId: author.id, content: 'Content for moderation review' });
  const input = { targetType: 'comment', targetId: comment.id, reason: 'credible_threat', description: 'Please review the threat in this comment.' };
  await request(app).post('/api/v1/safety/reports').send(input).expect(401);
  await request(app).post('/api/v1/safety/reports').set('Authorization', author.token).send(input).expect(400);
  const report = await request(app).post('/api/v1/safety/reports').set('Authorization', reporter.token).send(input).expect(201);
  expect(report.body.data).not.toHaveProperty('reporterId');
  const retry = await request(app).post('/api/v1/safety/reports').set('Authorization', reporter.token).send(input).expect(201);
  expect(retry.body.data.id).toBe(report.body.data.id);
  expect(await SafetyReportModel.countDocuments({ reporterId: reporter.id, targetId: comment.id })).toBe(1);
  await request(app).get('/api/v1/admin/safety-reports').set('Authorization', author.token).expect(403);
  const queue = await request(app).get('/api/v1/admin/safety-reports').set('Authorization', admin.token).expect(200);
  expect(queue.body.data.items.find((item: { targetId: string }) => item.targetId === comment.id)).toMatchObject({ priority: 'urgent', evidence: comment.content, reporterId: reporter.id });
  const path = `/api/v1/admin/safety-reports/${report.body.data.id}/review`;
  await request(app).put(path).set('Authorization', admin.token).send({ action: 'hide_comment', notes: 'short' }).expect(400);
  await request(app).put(path).set('Authorization', admin.token).send({ action: 'hide_comment', notes: 'Comment reviewed and removed for threatening language.' }).expect(200);
  expect((await CampaignCommentModel.findById(comment.id))?.deletedAt).toBeInstanceOf(Date);
  expect((await SafetyReportModel.findById(report.body.data.id))?.evidence).toBe(comment.content);
  expect(await AuditLogModel.exists({ action: 'safety.hide_comment', actorId: admin.id })).toBeTruthy();
  await request(app).put(path).set('Authorization', admin.token).send({ action: 'dismiss', notes: 'Trying to overwrite an existing review.' }).expect(409);
});
it('restricts publishing after a user report, preserves settings and allows an audited appeal', async () => {
  const reporter = await user('Another reporter'), author = await user('Another author'), admin = await user('Appeal moderator');
  await UserModel.findByIdAndUpdate(admin.id, { role: 'admin' });
  const report = await request(app).post('/api/v1/safety/reports').set('Authorization', reporter.token).send({ targetType: 'user', targetId: author.id, reason: 'harassment', description: 'Repeated harassment across several discussions.' }).expect(201);
  await request(app).put(`/api/v1/admin/safety-reports/${report.body.data.id}/review`).set('Authorization', admin.token).send({ action: 'restrict_user', notes: 'Repeated harassment confirmed. Publishing restricted pending appeal.' }).expect(200);
  expect(await ContentRestrictionModel.exists({ userId: author.id })).toBeTruthy();
  const otherInstance = await createTestApp();
  await request(otherInstance).post('/api/v1/creators/profile').set('Authorization', author.token).send({}).expect(403);
  await request(otherInstance).get('/api/v1/profile').set('Authorization', author.token).expect(200);
  await request(otherInstance).put('/api/v1/profile').set('Authorization', author.token).send({ notificationPreferences: { marketingEmails: false } }).expect(200);
  await request(app).post(`/api/v1/admin/safety-reports/restrictions/${author.id}/restore`).set('Authorization', author.token).send({ notes: 'An unauthorized attempt to remove restriction.' }).expect(403);
  await request(app).post(`/api/v1/admin/safety-reports/restrictions/${author.id}/restore`).set('Authorization', admin.token).send({ notes: 'Appeal reviewed and publishing restriction lifted.' }).expect(200);
  expect(await ContentRestrictionModel.exists({ userId: author.id })).toBeFalsy();
  expect(await AuditLogModel.exists({ action: 'safety.restore_public_content', actorId: admin.id })).toBeTruthy();
});
