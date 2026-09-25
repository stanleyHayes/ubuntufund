import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { reviewVersion } from '../helpers/kycReviewVersion.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { CampaignReviewModel } from '../../src/infrastructure/database/models/CampaignReviewModel.js';
import { CampaignCommentModel } from '../../src/infrastructure/database/models/CampaignCommentModel.js';
import { KYCVerificationModel } from '../../src/infrastructure/database/models/KYCVerificationModel.js';
import { NotificationModel } from '../../src/infrastructure/database/models/NotificationModel.js';
import { PrivateKycDocumentModel } from '../../src/infrastructure/database/models/PrivateKycDocumentModel.js';
import { ReportModel } from '../../src/infrastructure/database/models/ReportModel.js';
import { SafetyReportModel } from '../../src/infrastructure/database/models/SafetyReportModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { createAdminSafetyReportRoutes } from '../../src/infrastructure/adapters/inbound/http/routes/safetyReportRoutes.js';
import { errorHandler } from '../../src/infrastructure/adapters/inbound/middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../../src/infrastructure/adapters/inbound/middleware/authMiddleware.js';

/**
 * Staff decisions used to change a campaign, verification or report silently:
 * the affected user only found out by reopening the right screen. Each
 * decision now writes one in-app service notice, inside the decision's
 * transaction where there is one.
 */
let app: Express;
beforeAll(async () => { await connectTestDatabase(); await CampaignReviewModel.init(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

async function account(admin = false) {
  const response = await request(app).post('/api/v1/auth/register').send({ name: 'Decision notice fixture', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const id = response.body.data.user.id as string;
  await UserModel.findByIdAndUpdate(id, { verificationLevel: 3, ...(admin ? { role: 'admin' } : {}) });
  return { id, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
const notices = (userId: string) => NotificationModel.find({ userId, type: 'staff_decision' }).lean();

async function campaignFixture() {
  const owner = await account(), admin = await account(true);
  const campaign = await CampaignModel.create({ title: 'Notice school fundraiser', description: 'The complete public story being reviewed.', goalAmount: 3000, currency: 'GHS', category: 'education', status: 'pending_review', creatorId: owner.id, beneficiaries: ['School community'], imageUrls: ['https://media.example.test/photo.jpg'], startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
  const path = `/api/v1/campaigns/${campaign.id}`;
  const version = async () => (await request(app).get(path).set('Authorization', admin.auth).expect(200)).body.data.reviewVersion as string;
  return { owner, admin, campaign, path, version };
}
const internalNotes = 'Internal: organizer documents look doctored; escalate to trust team.';
const decision = (expectedVersion: string, action = 'approve') => ({ expectedVersion, action, reason: internalNotes, contentReviewed: true, fundraisingReviewed: true });

it('tells the organizer once when their campaign is approved, even when the decision is retried', async () => {
  const f = await campaignFixture(), input = decision(await f.version());
  await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(input).expect(200);
  await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(input).expect(200);
  const inbox = await notices(f.owner.id);
  expect(inbox).toHaveLength(1);
  expect(inbox[0]).toMatchObject({ title: 'Your campaign is live', path: `/campaigns/${f.campaign.id}`, read: false });
  expect(inbox[0].body).toContain('Notice school fundraiser');
  expect(await notices(f.admin.id)).toHaveLength(0);
});

it('writes no notice when the review decision rolls back', async () => {
  const f = await campaignFixture(), input = decision(await f.version(), 'reject');
  const fault = vi.spyOn(AuditLogModel, 'create').mockRejectedValueOnce(new Error('Injected audit fault') as never);
  try { await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(input).expect(500); } finally { fault.mockRestore(); }
  expect((await CampaignModel.findById(f.campaign.id))?.status).toBe('pending_review');
  expect(await notices(f.owner.id)).toHaveLength(0);
  await request(app).put(`${f.path}/review`).set('Authorization', f.admin.auth).send(input).expect(200);
  const inbox = await notices(f.owner.id);
  expect(inbox).toHaveLength(1);
  expect(inbox[0].title).toBe('Your campaign was not approved');
  // Staff decision notes are an internal record and are never copied to the organizer.
  expect(inbox[0].body).not.toContain('doctored');
  expect(inbox[0].body).toContain('support@ujimora.com');
});

async function kycSubmission(userId: string) {
  const document = await PrivateKycDocumentModel.create({ userId, publicId: `identity-${randomUUID()}`, resourceType: 'image', format: 'png', mimeType: 'image/png' });
  return KYCVerificationModel.create({ userId, verificationType: 'identity', status: 'pending', personalInfo: { fullName: 'Decision notice fixture', dateOfBirth: new Date('1990-01-01') }, documents: [{ type: 'id_card', url: `kyc://${document.id}`, uploadedAt: new Date() }] });
}

it('tells applicants about information requests, rejections (with the applicant-facing reason) and approvals', async () => {
  const applicant = await account(), staff = await account(true);
  const first = await kycSubmission(applicant.id);
  await request(app).put(`/api/v1/kyc/${first.id}/request-info`).set('Authorization', staff.auth).send({ prompt: 'Please upload the back of your Ghana Card as well.', reviewVersion: await reviewVersion(first.id) }).expect(200);
  let inbox = await notices(applicant.id);
  expect(inbox).toHaveLength(1);
  expect(inbox[0]).toMatchObject({ title: 'More information needed for your verification', path: '/kyc' });

  const reason = 'The identity document photo is too blurred to read.';
  await KYCVerificationModel.updateOne({ _id: first.id }, { $set: { status: 'pending', informationRequests: [] } });
  await request(app).put(`/api/v1/kyc/${first.id}/reject`).set('Authorization', staff.auth).send({ rejectionReason: reason, reviewVersion: await reviewVersion(first.id) }).expect(200);
  inbox = await notices(applicant.id);
  const rejected = inbox.find(n => n.title === 'Your identity verification was not approved');
  expect(rejected?.body).toContain(reason);

  const second = await kycSubmission(applicant.id);
  await request(app).put(`/api/v1/kyc/${second.id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.', reviewVersion: await reviewVersion(second.id) }).expect(200);
  inbox = await notices(applicant.id);
  expect(inbox.map(n => n.title)).toContain('Your identity verification is approved');
  expect(inbox).toHaveLength(3);
});

it('writes no verification notice when the decision rolls back', async () => {
  const applicant = await account(), staff = await account(true), row = await kycSubmission(applicant.id);
  const fault = vi.spyOn(AuditLogModel, 'create').mockRejectedValueOnce(new Error('audit unavailable') as never);
  try { await request(app).put(`/api/v1/kyc/${row.id}/reject`).set('Authorization', staff.auth).send({ rejectionReason: 'Please provide a clearer identity document.', reviewVersion: await reviewVersion(row.id) }).expect(500); } finally { fault.mockRestore(); }
  expect((await KYCVerificationModel.findById(row.id))?.status).toBe('pending');
  expect(await notices(applicant.id)).toHaveLength(0);
});

it('acknowledges campaign reports to the reporter once', async () => {
  const reporter = await account(), admin = await account(true);
  const report = await ReportModel.create({ campaignId: 'aaaaaaaaaaaaaaaaaaaaaaaa', reporterId: reporter.id, reason: 'fraudulent', status: 'pending' });
  // Every campaign-report decision now carries staff notes (min 20 chars).
  const review = { status: 'dismissed', notes: 'Internal: checked the evidence; no policy breach found.' };
  await request(app).put(`/api/v1/reports/${report.id}/review`).set('Authorization', admin.auth).send(review).expect(200);
  await request(app).put(`/api/v1/reports/${report.id}/review`).set('Authorization', admin.auth).send(review).expect(409);
  const inbox = await notices(reporter.id);
  expect(inbox).toHaveLength(1);
  expect(inbox[0]).toMatchObject({ title: 'We reviewed your report', path: '/campaigns/aaaaaaaaaaaaaaaaaaaaaaaa' });
  // Staff notes are an internal record and are never copied to the reporter.
  expect(inbox[0].body).not.toContain('policy breach');
});

function moderationApp() {
  const server = express(); server.use(express.json());
  server.use(createAdminSafetyReportRoutes((req: AuthenticatedRequest, _res, next) => { req.userId = 'moderator'; req.userRole = 'admin'; next(); }, (_req, _res, next) => next(), async () => {}, async () => {}));
  server.use(errorHandler); return server;
}
const user = async () => (await UserModel.create({ name: 'Safety fixture', email: `${randomUUID()}@example.test`, passwordHash: 'unused' })).id as string;

it('tells the reported author only when their content is actioned, and the reporter neutrally', async () => {
  const reporterId = await user(), authorId = await user(), server = moderationApp();
  const comment = await CampaignCommentModel.create({ campaignId: 'bbbbbbbbbbbbbbbbbbbbbbbb', authorId, content: 'Reported comment' });
  const hidden = await SafetyReportModel.create({ reporterId, targetType: 'comment', targetId: comment.id, targetUserId: authorId, reason: 'harassment', description: 'Harassing comment on a campaign.' });
  await request(server).put(`/${hidden.id}/review`).send({ action: 'hide_comment', notes: 'Comment breaches the harassment policy; removing it.' }).expect(200);
  const authorInbox = await notices(authorId);
  expect(authorInbox).toHaveLength(1);
  expect(authorInbox[0].title).toBe('Your comment was removed');
  expect(authorInbox[0].body).not.toContain('harassment policy');
  expect((await notices(reporterId)).map(n => n.title)).toEqual(['We reviewed your report']);

  const other = await CampaignCommentModel.create({ campaignId: 'bbbbbbbbbbbbbbbbbbbbbbbb', authorId, content: 'Another comment' });
  const dismissed = await SafetyReportModel.create({ reporterId, targetType: 'comment', targetId: other.id, targetUserId: authorId, reason: 'spam', description: 'Looks like spam to me.' });
  await request(server).put(`/${dismissed.id}/review`).send({ action: 'dismiss', notes: 'Not spam; ordinary supporter comment.' }).expect(200);
  expect(await notices(authorId)).toHaveLength(1);
  expect(await notices(reporterId)).toHaveLength(2);
});
