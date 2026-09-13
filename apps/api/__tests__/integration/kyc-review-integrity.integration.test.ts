import { MongoKYCWorkflowTransaction } from '../../src/infrastructure/adapters/outbound/persistence/MongoKYCWorkflowTransaction.js';
import * as privateKycLocks from '../../src/infrastructure/adapters/outbound/persistence/lockPrivateKycDocuments.js';
import { reviewVersion } from '../helpers/kycReviewVersion.js';
import { PrivateKycDocumentModel } from '../../src/infrastructure/database/models/PrivateKycDocumentModel.js';
import { MongoUserRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoUserRepository.js';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { KYCVerificationModel } from '../../src/infrastructure/database/models/KYCVerificationModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function account(admin = false) {
  const res = await request(app).post('/api/v1/auth/register').send({ name: 'Review fixture', email: `${randomUUID()}@example.com`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const id = res.body.data.user.id;
  if (admin) await UserModel.updateOne({ _id: id }, { $set: { role: 'admin' } });
  return { id, auth: `Bearer ${res.body.data.tokens.accessToken}` };
}
async function submission(userId: string) {
  const document = await PrivateKycDocumentModel.create({ userId, publicId: `identity-${randomUUID()}`, resourceType: 'image', format: 'png', mimeType: 'image/png' });
  return KYCVerificationModel.create({ userId, verificationType: 'identity', status: 'pending', personalInfo: { fullName: 'Review fixture', dateOfBirth: new Date('1990-01-01') }, documents: [{ type: 'id_card', url: `kyc://${document.id}`, uploadedAt: new Date() }] });
}
it('rolls back approval and verification level if the decision audit fails', async () => {
  const owner = await account(), staff = await account(true), row = await submission(owner.id);
  const before = (await UserModel.findById(owner.id))!.verificationLevel;
  const spy = vi.spyOn(AuditLogModel, 'create').mockRejectedValueOnce(new Error('audit unavailable'));
  try { await request(app).put(`/api/v1/kyc/${row.id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.', reviewVersion: await reviewVersion(row.id) }).expect(500); }
  finally { spy.mockRestore(); }
  expect((await KYCVerificationModel.findById(row.id))!.status).toBe('pending');
  expect((await UserModel.findById(owner.id))!.verificationLevel).toBe(before);
  expect(await AuditLogModel.countDocuments({ resource: row.id, action: 'kyc.approved' })).toBe(0);
  await request(app).put(`/api/v1/kyc/${row.id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.', reviewVersion: await reviewVersion(row.id) }).expect(200);
  expect((await UserModel.findById(owner.id))!.verificationLevel).toBeGreaterThan(before);
  expect(await AuditLogModel.countDocuments({ resource: row.id, action: 'kyc.approved' })).toBe(1);
});
it('commits one of two competing decisions and denies self-review and closed applicants', async () => {
  const owner = await account(), staff = await account(true), other = await account(true), row = await submission(owner.id);
  const responses = await Promise.all([
    request(app).put(`/api/v1/kyc/${row.id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.', reviewVersion: await reviewVersion(row.id) }),
    request(app).put(`/api/v1/kyc/${row.id}/reject`).set('Authorization', other.auth).send({ rejectionReason: 'Please provide a clearer identity document.', reviewVersion: await reviewVersion(row.id) }),
  ]);
  expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
  expect(await AuditLogModel.countDocuments({ resource: row.id, action: { $in: ['kyc.approved', 'kyc.rejected'] } })).toBe(1);
  const self = await submission(staff.id);
  await request(app).put(`/api/v1/kyc/${self.id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.', reviewVersion: await reviewVersion(self.id) }).expect(403);
  const closed = await submission(owner.id);
  await UserModel.updateOne({ _id: owner.id }, { $set: { deletedAt: new Date() } });
  await request(app).put(`/api/v1/kyc/${closed.id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.', reviewVersion: await reviewVersion(closed.id) }).expect(409);
  expect((await KYCVerificationModel.findById(closed.id))!.status).toBe('pending');
});
it('serializes simultaneous identity submissions and permits a new attempt only after a terminal review', async () => {
  const owner = await account(), staff = await account(true);
  const submit = () => request(app).post('/api/v1/kyc/identity').set('Authorization', owner.auth).send({ personalInfo: { fullName: 'Review fixture', dateOfBirth: '1990-01-01T00:00:00.000Z' } });
  const responses = await Promise.all([submit(), submit()]);
  expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
  const rows = await KYCVerificationModel.find({ userId: owner.id });
  expect(rows).toHaveLength(1);
  await request(app).put(`/api/v1/kyc/${rows[0].id}/reject`).set('Authorization', staff.auth).send({ reviewVersion: await reviewVersion(rows[0].id), rejectionReason: 'Please submit the requested evidence.' }).expect(200);
  await submit().expect(201);
  expect(await KYCVerificationModel.countDocuments({ userId: owner.id, status: 'pending' })).toBe(1);
  expect(await KYCVerificationModel.countDocuments({ userId: owner.id, status: 'rejected' })).toBe(1);
});

it('raises only verification level, never demotes it, and refuses closed accounts', async () => {
  const owner = await account();
  await UserModel.updateOne({ _id: owner.id }, { $set: { verificationLevel: 3, trustScore: 87, complianceApprovedCampaignLimit: 900000, needsWebsite: true, authVersion: 'unchanged-credential' } });
  const before = (await UserModel.findById(owner.id).lean())!;
  const repo = new MongoUserRepository();
  expect(await repo.raiseVerificationLevel(owner.id, 2)).toBe(true);
  const after = (await UserModel.findById(owner.id).lean())!;
  expect(after.verificationLevel).toBe(3);
  for (const field of ['trustScore', 'complianceApprovedCampaignLimit', 'needsWebsite', 'authVersion', 'passwordHash', 'legalAcceptance'] as const) expect(after[field]).toEqual(before[field]);
  await UserModel.updateOne({ _id: owner.id }, { $set: { deletedAt: new Date() } });
  expect(await repo.raiseVerificationLevel(owner.id, 4)).toBe(false);
  expect((await UserModel.findById(owner.id))!.verificationLevel).toBe(3);
});


it('persists private information requests, rejects stale responses, and returns answered applications to review', async () => {
  const owner = await account(), stranger = await account(), staff = await account(true), row = await submission(owner.id);
  const prompt = 'Please clarify the address shown in your identity document.';
  const result = await request(app).put(`/api/v1/kyc/${row.id}/request-info`).set('Authorization', staff.auth).send({ prompt, reviewVersion: await reviewVersion(row.id) }).expect(200);
  const requestId = result.body.data.id;
  await request(app).put(`/api/v1/kyc/${row.id}/request-info`).set('Authorization', staff.auth).send({ prompt, reviewVersion: await reviewVersion(row.id) }).expect(409);
  await request(app).put(`/api/v1/kyc/${row.id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.', reviewVersion: await reviewVersion(row.id) }).expect(409);
  const status = await request(app).get('/api/v1/kyc/status').set('Authorization', owner.auth).expect(200);
  expect(status.headers['cache-control']).toBe('private, no-store');
  expect(status.body.data.verifications[0].informationRequests).toEqual([expect.objectContaining({ id: requestId, prompt })]);
  const others = await request(app).get('/api/v1/kyc/status').set('Authorization', stranger.auth).expect(200);
  expect(JSON.stringify(others.body)).not.toContain(prompt);
  const queue = await request(app).get('/api/v1/kyc/pending').set('Authorization', staff.auth).expect(200);
  expect(JSON.stringify(queue.body)).toContain(requestId);
  const respond = (auth: string, id = requestId, documents: unknown[] = []) => request(app).post(`/api/v1/kyc/${row.id}/respond-info`).set('Authorization', auth).send({ requestId: id, response: 'The current address is in Accra.', documents });
  await respond(stranger.auth).expect(404);
  await respond(owner.auth, randomUUID()).expect(409);
  await respond(owner.auth, requestId, [{ type: 'utility_bill', url: 'kyc://aaaaaaaaaaaaaaaaaaaaaaaa' }]).expect(400);
  const document = await PrivateKycDocumentModel.create({ userId: stranger.id, publicId: 'synthetic-private-proof', resourceType: 'image', format: 'png', mimeType: 'image/png' });
  const attachment = [{ type: 'utility_bill', url: `kyc://${document.id}` }];
  await respond(owner.auth, requestId, attachment).expect(400);
  await PrivateKycDocumentModel.updateOne({ _id: document.id }, { $set: { userId: owner.id, deletedAt: new Date() } });
  await respond(owner.auth, requestId, attachment).expect(400);
  await PrivateKycDocumentModel.updateOne({ _id: document.id }, { $unset: { deletedAt: 1 } });
  const races = await Promise.all([respond(owner.auth, requestId, attachment), respond(owner.auth, requestId, attachment)]);
  expect(races.map(item => item.status).sort()).toEqual([200, 409]);
  const saved = (await KYCVerificationModel.findById(row.id))!;
  expect(saved.status).toBe('pending');
  expect(saved.informationRequests).toHaveLength(1);
  expect(saved.documents).toHaveLength(2);
  expect(saved.documents[1].url).toBe(attachment[0].url);
  expect(saved.informationRequests![0]).toMatchObject({ prompt, response: 'The current address is in Accra.', respondedAt: expect.any(Date) });
  expect(await AuditLogModel.countDocuments({ resource: row.id, action: 'kyc.information_responded' })).toBe(1);
  await request(app).put(`/api/v1/kyc/${row.id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.', reviewVersion: await reviewVersion(row.id) }).expect(200);
});

it('rolls back both information requests and responses when their audit cannot be saved', async () => {
  const owner = await account(), staff = await account(true), row = await submission(owner.id);
  const initialVersion = await reviewVersion(row.id);
  const sendRequest = () => request(app).put(`/api/v1/kyc/${row.id}/request-info`).set('Authorization', staff.auth).send({ reviewVersion: initialVersion, prompt: 'Please clarify your current residential address.' });
  const spy = vi.spyOn(AuditLogModel, 'create').mockRejectedValueOnce(new Error('audit unavailable'));
  try { await sendRequest().expect(500); } finally { spy.mockRestore(); }
  expect((await KYCVerificationModel.findById(row.id))!.status).toBe('pending');
  expect((await KYCVerificationModel.findById(row.id))!.informationRequests).toHaveLength(0);
  const result = await sendRequest().expect(200);
  const sendResponse = () => request(app).post(`/api/v1/kyc/${row.id}/respond-info`).set('Authorization', owner.auth).send({ requestId: result.body.data.id, response: 'My residential address is unchanged.' });
  const responseSpy = vi.spyOn(AuditLogModel, 'create').mockRejectedValueOnce(new Error('audit unavailable'));
  try { await sendResponse().expect(500); } finally { responseSpy.mockRestore(); }
  const unchanged = (await KYCVerificationModel.findById(row.id))!;
  expect(unchanged.status).toBe('in_review');
  expect(unchanged.informationRequests![0].respondedAt).toBeUndefined();
  expect(unchanged.informationRequests![0].response).toBeUndefined();
  await sendResponse().expect(200);
});

it('requires the reviewed HTTP queue version and refuses unseen applicant replies or evidence edits', async () => {
  const owner = await account(), staff = await account(true), row = await submission(owner.id);
  const getVersion = async () => {
    const response = await request(app).get('/api/v1/kyc/pending').set('Authorization', staff.auth).expect(200);
    return response.body.data.find((item: { id: string }) => item.id === row.id).reviewVersion as string;
  };
  const originalVersion = await getVersion();
  expect(originalVersion).toMatch(/^[a-f0-9]{64}$/);
  await request(app).put(`/api/v1/kyc/${row.id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.',}).expect(428);
  const info = await request(app).put(`/api/v1/kyc/${row.id}/request-info`).set('Authorization', staff.auth).send({ reviewVersion: originalVersion, prompt: 'Please clarify your residential address.' }).expect(200);
  await request(app).post(`/api/v1/kyc/${row.id}/respond-info`).set('Authorization', owner.auth).send({ requestId: info.body.data.id, response: 'My residential address is unchanged.' }).expect(200);
  for (const action of ['approve', 'reject', 'request-info']) {
    await request(app).put(`/api/v1/kyc/${row.id}/${action}`).set('Authorization', staff.auth).send({ reviewVersion: originalVersion, prompt: 'Please clarify your residential address.' }).expect(409);
  }
  expect((await KYCVerificationModel.findById(row.id))!.status).toBe('pending');
  expect(await AuditLogModel.countDocuments({ resource: row.id, action: { $in: ['kyc.approved', 'kyc.rejected'] } })).toBe(0);
  const replyVersion = await getVersion();
  expect(replyVersion).not.toBe(originalVersion);
  // Even a repair that retains timestamps must invalidate the reviewed evidence.
  await KYCVerificationModel.updateOne({ _id: row.id }, { $set: { 'personalInfo.fullName': 'Corrected fixture name' } }, { timestamps: false });
  await request(app).put(`/api/v1/kyc/${row.id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.', reviewVersion: replyVersion }).expect(409);
  const currentVersion = await getVersion();
  await request(app).put(`/api/v1/kyc/${row.id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.', reviewVersion: currentVersion }).expect(200);
  const audit = await AuditLogModel.findOne({ resource: row.id, action: 'kyc.approved' });
  expect(audit!.details).toContain(currentVersion);
});


it('rechecks every private document before approval and rolls back document locks on failure', async () => {
  const owner = await account(), stranger = await account(), staff = await account(true), row = await submission(owner.id);
  const good = await PrivateKycDocumentModel.create({ userId: owner.id, publicId: 'owned-proof', resourceType: 'image', format: 'png', mimeType: 'image/png' });
  const foreign = await PrivateKycDocumentModel.create({ userId: stranger.id, publicId: 'foreign-proof', resourceType: 'image', format: 'png', mimeType: 'image/png' });
  const deleted = await PrivateKycDocumentModel.create({ userId: owner.id, publicId: 'withdrawn-proof', resourceType: 'image', format: 'png', mimeType: 'image/png', deletedAt: new Date() });
  for (const unavailable of ['https://legacy.example.invalid/id.png', 'kyc://aaaaaaaaaaaaaaaaaaaaaaaa', `kyc://${foreign.id}`, `kyc://${deleted.id}`]) {
    await KYCVerificationModel.updateOne({ _id: row.id }, { $set: { documents: [{ type: 'id_card', url: `kyc://${good.id}`, uploadedAt: new Date() }, { type: 'id_card', url: unavailable, uploadedAt: new Date() }] } });
    await request(app).put(`/api/v1/kyc/${row.id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.', reviewVersion: await reviewVersion(row.id) }).expect(422);
    expect((await KYCVerificationModel.findById(row.id))!.status).toBe('pending');
    expect((await PrivateKycDocumentModel.findById(good.id))!.reviewWriteVersion).toBe(0);
  }
  expect(await AuditLogModel.countDocuments({ resource: row.id, action: 'kyc.approved' })).toBe(0);
  await KYCVerificationModel.updateOne({ _id: row.id }, { $set: { documents: [{ type: 'id_card', url: `kyc://${good.id}`, uploadedAt: new Date() }] } });
  await request(app).put(`/api/v1/kyc/${row.id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.', reviewVersion: await reviewVersion(row.id) }).expect(200);
  expect((await PrivateKycDocumentModel.findById(good.id))!.reviewWriteVersion).toBe(1);
});

it('refuses approval when a private document is withdrawn after the application snapshot was read', async () => {
  const owner = await account(), staff = await account(true), row = await submission(owner.id);
  const document = await PrivateKycDocumentModel.create({ userId: owner.id, publicId: 'race-proof', resourceType: 'image', format: 'png', mimeType: 'image/png' });
  await KYCVerificationModel.updateOne({ _id: row.id }, { $set: { documents: [{ type: 'id_card', url: `kyc://${document.id}`, uploadedAt: new Date() }] } });
  const version = await reviewVersion(row.id);
  let release!: () => void;
  let entered = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const original = privateKycLocks.lockPrivateKycDocuments;
  const spy = vi.spyOn(privateKycLocks, 'lockPrivateKycDocuments').mockImplementationOnce(async (...args) => { entered = true; await gate; return original(...args); });
  const approval = request(app).put(`/api/v1/kyc/${row.id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.', reviewVersion: version }).then(response => response);
  try {
    await vi.waitFor(() => expect(entered).toBe(true));
    await PrivateKycDocumentModel.updateOne({ _id: document.id }, { $set: { deletedAt: new Date() } });
  } finally { release(); }
  try { expect((await approval).status).toBe(422); } finally { spy.mockRestore(); }
  expect((await KYCVerificationModel.findById(row.id))!.status).toBe('pending');
  expect(await AuditLogModel.countDocuments({ resource: row.id, action: 'kyc.approved' })).toBe(0);
});

it('keeps selfies separate and requires identity evidence before approval, including after a request response', async () => {
  const owner = await account(), staff = await account(true);
  const selfie = await PrivateKycDocumentModel.create({ userId: owner.id, publicId: 'selfie-proof', resourceType: 'image', format: 'png', mimeType: 'image/png' });
  const submitted = await request(app).post('/api/v1/kyc/identity').set('Authorization', owner.auth).send({ personalInfo: { fullName: 'Applicant fixture', dateOfBirth: '1990-01-01T00:00:00.000Z' }, documents: [{ type: 'selfie', url: `kyc://${selfie.id}` }] }).expect(201);
  const id = submitted.body.data.id;
  expect(submitted.body.data.documents[0].type).toBe('selfie');
  const before = (await UserModel.findById(owner.id))!.verificationLevel;
  for (const documents of [[], [{ type: 'selfie', url: `kyc://${selfie.id}`, uploadedAt: new Date() }], [{ type: 'utility_bill', url: `kyc://${selfie.id}`, uploadedAt: new Date() }]]) {
    await KYCVerificationModel.updateOne({ _id: id }, { $set: { documents } });
    const denied = await request(app).put(`/api/v1/kyc/${id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.', reviewVersion: await reviewVersion(id) }).expect(422);
    expect(denied.body.message).toContain('requires an identity document');
    expect((await UserModel.findById(owner.id))!.verificationLevel).toBe(before);
  }
  const needed = await request(app).put(`/api/v1/kyc/${id}/request-info`).set('Authorization', staff.auth).send({ reviewVersion: await reviewVersion(id), prompt: 'Please upload your identity document for review.' }).expect(200);
  const identity = await PrivateKycDocumentModel.create({ userId: owner.id, publicId: 'identity-proof', resourceType: 'image', format: 'png', mimeType: 'image/png' });
  await request(app).post(`/api/v1/kyc/${id}/respond-info`).set('Authorization', owner.auth).send({ requestId: needed.body.data.id, response: 'I have attached my identity document and selfie.', documents: [{ type: 'id_card', url: `kyc://${identity.id}` }, { type: 'selfie', url: `kyc://${selfie.id}` }] }).expect(200);
  await KYCVerificationModel.updateOne({ _id: id }, { $set: { 'personalInfo.fullName': '  ' } });
  await request(app).put(`/api/v1/kyc/${id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.', reviewVersion: await reviewVersion(id) }).expect(422);
  await KYCVerificationModel.updateOne({ _id: id }, { $set: { 'personalInfo.fullName': 'Applicant fixture' } });
  await request(app).put(`/api/v1/kyc/${id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.', reviewVersion: await reviewVersion(id) }).expect(200);
  expect((await KYCVerificationModel.findById(id))!.documents.map(doc => doc.type)).toContain('selfie');
});

it('requires a useful rejection reason and exposes it only to the applicant without staff notes', async () => {
  const owner = await account(), stranger = await account(), staff = await account(true), row = await submission(owner.id);
  await request(app).put(`/api/v1/kyc/${row.id}/reject`).set('Authorization', staff.auth).send({ reviewVersion: await reviewVersion(row.id) }).expect(422);
  expect((await KYCVerificationModel.findById(row.id))!.status).toBe('pending');
  const rejectionReason = 'The ID image is unreadable. Submit a clear front and back image.';
  await request(app).put(`/api/v1/kyc/${row.id}/reject`).set('Authorization', staff.auth).send({ reviewVersion: await reviewVersion(row.id), rejectionReason, reviewNotes: 'Internal reviewer-only fixture note.' }).expect(200);
  const status = await request(app).get('/api/v1/kyc/status').set('Authorization', owner.auth).expect(200);
  expect(status.body.data.verifications[0]).toMatchObject({ status: 'rejected', rejectionReason });
  expect(status.body.data.verifications[0]).not.toHaveProperty('reviewNotes');
  expect(status.body.data.verifications[0]).not.toHaveProperty('reviewedBy');
  const otherStatus = await request(app).get('/api/v1/kyc/status').set('Authorization', stranger.auth).expect(200);
  expect(JSON.stringify(otherStatus.body)).not.toContain(rejectionReason);
});

it('requires explicit evidence review and meaningful findings before approval', async () => {
  const owner = await account(), staff = await account(true), row = await submission(owner.id);
  const version = await reviewVersion(row.id);
  const before = (await UserModel.findById(owner.id))!.verificationLevel;
  for (const review of [{}, { evidenceReviewed: false, reviewNotes: 'Identity evidence reviewed against the application.' }, { evidenceReviewed: true, reviewNotes: 'Checked' }]) {
    await request(app).put(`/api/v1/kyc/${row.id}/approve`).set('Authorization', staff.auth).send({ reviewVersion: version, ...review }).expect(422);
    expect((await KYCVerificationModel.findById(row.id))!.status).toBe('pending');
    expect((await UserModel.findById(owner.id))!.verificationLevel).toBe(before);
  }
  expect(await AuditLogModel.countDocuments({ resource: row.id, action: 'kyc.approved' })).toBe(0);
  const reviewNotes = 'The identity document is readable and matches the application details.';
  await request(app).put(`/api/v1/kyc/${row.id}/approve`).set('Authorization', staff.auth).send({ reviewVersion: version, evidenceReviewed: true, reviewNotes }).expect(200);
  expect((await KYCVerificationModel.findById(row.id))!.reviewNotes).toBe(reviewNotes);
  expect((await AuditLogModel.findOne({ resource: row.id, action: 'kyc.approved' }))!.details).toContain('staff attested evidence review');
  const status = await request(app).get('/api/v1/kyc/status').set('Authorization', owner.auth).expect(200);
  expect(JSON.stringify(status.body)).not.toContain(reviewNotes);
});


const reviewRevocations = ['staff_role', 'staff_closed', 'staff_credentials', 'applicant_closed'] as const;
it.each(reviewRevocations.flatMap(change => ['approve', 'reject', 'request-info'].map(action => ({ change, action }))))('denies $action after $change between authentication and the transaction', async ({ change, action }) => {
  const owner = await account(), staff = await account(true), row = await submission(owner.id);
  const before = (await UserModel.findById(owner.id))!.verificationLevel;
  const version = await reviewVersion(row.id);
  let entered = false;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const original = MongoKYCWorkflowTransaction.prototype.run;
  const spy = vi.spyOn(MongoKYCWorkflowTransaction.prototype, 'run').mockImplementationOnce(async function<T>(...args: Parameters<typeof original>): Promise<T> {
    entered = true;
    await gate;
    return original.apply(this, args) as Promise<T>;
  });
  const pending = request(app).put(`/api/v1/kyc/${row.id}/${action}`).set('Authorization', staff.auth).send({ reviewVersion: version, evidenceReviewed: true, reviewNotes: 'Identity evidence reviewed against the application.', rejectionReason: 'Please provide clearer identity document images.', prompt: 'Please clarify your residential address.' }).then(response => response);
  let response;
  try {
    await vi.waitFor(() => expect(entered).toBe(true), { timeout: 5000 });
    const target = change === 'applicant_closed' ? owner.id : staff.id;
    const mutation = change === 'staff_role' ? { role: 'user' } : change === 'staff_credentials' ? { authVersion: randomUUID() } : { deletedAt: new Date() };
    await UserModel.updateOne({ _id: target }, { $set: mutation });
  } finally {
    release();
    try { response = await pending; } finally { spy.mockRestore(); }
  }
  expect(response.status).toBe(change === 'applicant_closed' ? 409 : 401);
  expect((await KYCVerificationModel.findById(row.id))!.status).toBe('pending');
  expect((await KYCVerificationModel.findById(row.id))!.informationRequests).toHaveLength(0);
  expect((await UserModel.findById(owner.id))!.verificationLevel).toBe(before);
  expect(await AuditLogModel.countDocuments({ resource: row.id, action: { $in: ['kyc.approved', 'kyc.rejected', 'kyc.information_requested'] } })).toBe(0);
});

it.each(['closed', 'credentials'] as const)('refuses applicant responses after the account is %s during the request', async change => {
  const owner = await account(), staff = await account(true), row = await submission(owner.id);
  const info = await request(app).put(`/api/v1/kyc/${row.id}/request-info`).set('Authorization', staff.auth).send({ reviewVersion: await reviewVersion(row.id), prompt: 'Please clarify your residential address.' }).expect(200);
  let entered = false;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const original = MongoKYCWorkflowTransaction.prototype.submit;
  const spy = vi.spyOn(MongoKYCWorkflowTransaction.prototype, 'submit').mockImplementationOnce(async function<T>(...args: Parameters<typeof original>): Promise<T> {
    entered = true;
    await gate;
    return original.apply(this, args) as Promise<T>;
  });
  const pending = request(app).post(`/api/v1/kyc/${row.id}/respond-info`).set('Authorization', owner.auth).send({ requestId: info.body.data.id, response: 'My address is unchanged.' }).then(response => response);
  let response;
  try {
    await vi.waitFor(() => expect(entered).toBe(true), { timeout: 5000 });
    await UserModel.updateOne({ _id: owner.id }, { $set: change === 'closed' ? { deletedAt: new Date() } : { authVersion: randomUUID() } });
  } finally {
    release();
    try { response = await pending; } finally { spy.mockRestore(); }
  }
  expect(response.status).toBe(401);
  const unchanged = (await KYCVerificationModel.findById(row.id))!;
  expect(unchanged.status).toBe('in_review');
  expect(unchanged.informationRequests![0].respondedAt).toBeUndefined();
  expect(unchanged.informationRequests![0].response).toBeUndefined();
  expect(await AuditLogModel.countDocuments({ resource: row.id, action: 'kyc.information_responded' })).toBe(0);
});

it('requires registration evidence for organization approval', async () => {
  const owner = await account(), staff = await account(true);
  await UserModel.updateOne({ _id: owner.id }, { $set: { role: 'organization' } });
  const document = await PrivateKycDocumentModel.create({ userId: owner.id, publicId: 'organization-registration', resourceType: 'image', format: 'png', mimeType: 'image/png' });
  const row = await KYCVerificationModel.create({ userId: owner.id, verificationType: 'business', status: 'pending', documents: [] });
  const before = (await UserModel.findById(owner.id))!.verificationLevel;
  const approve = async () => request(app).put(`/api/v1/kyc/${row.id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Organization registration reviewed against the application.', reviewVersion: await reviewVersion(row.id) });
  for (const evidence of [
    { businessInfo: {}, documents: [] },
    { businessInfo: { businessName: 'Organization fixture' }, documents: [] },
    { businessInfo: { businessName: 'Organization fixture', registrationNumber: 'REG-fixture' }, documents: [{ type: 'passport', url: `kyc://${document.id}`, uploadedAt: new Date() }] },
  ]) {
    await KYCVerificationModel.updateOne({ _id: row.id }, { $set: evidence });
    expect((await approve()).status).toBe(422);
    expect((await KYCVerificationModel.findById(row.id))!.status).toBe('pending');
    expect((await UserModel.findById(owner.id))!.verificationLevel).toBe(before);
  }
  await KYCVerificationModel.updateOne({ _id: row.id }, { $set: { documents: [{ type: 'business_registration', url: `kyc://${document.id}`, uploadedAt: new Date() }] } });
  expect((await approve()).status).toBe(422);
  const info = { businessName: 'Organization fixture', registrationNumber: 'REG-fixture', businessType: 'Charity', registeredAddress: { street: 'Fixture street', city: 'Accra', country: 'Ghana' }, representativeCapacity: 'Director', controlPersons: [{ fullName: 'Controller', country: 'Ghana', role: 'director' }], ownershipExplanation: 'The declared directors control this organization.', declaration: { authorized: true, accurate: true, acceptedAt: new Date() } };
  const personalInfo = { fullName: 'Representative', nationality: 'Ghana', idNumber: 'FIXTURE-ID', dateOfBirth: new Date('1990-01-01') };
  const documents = await Promise.all(['business_registration', 'authorization_letter', 'id_card'].map(async type => {
    const file = await PrivateKycDocumentModel.create({ userId: owner.id, publicId: randomUUID(), resourceType: 'image', format: 'png', mimeType: 'image/png' });
    return { type, url: `kyc://${file.id}`, uploadedAt: new Date() };
  }));
  for (const change of [
    { businessInfo: { ...info, registeredAddress: {} }, personalInfo, documents },
    { businessInfo: { ...info, representativeCapacity: '' }, personalInfo, documents },
    { businessInfo: { ...info, controlPersons: [] }, personalInfo, documents },
    { businessInfo: { ...info, declaration: { ...info.declaration, authorized: false } }, personalInfo, documents },
    { businessInfo: info, personalInfo: { ...personalInfo, dateOfBirth: new Date('2020-01-01') }, documents },
    { businessInfo: info, personalInfo, documents: documents.filter(doc => doc.type !== 'authorization_letter') },
  ]) {
    await KYCVerificationModel.updateOne({ _id: row.id }, { $set: change });
    expect((await approve()).status).toBe(422);
    expect((await KYCVerificationModel.findById(row.id))!.status).toBe('pending');
    expect((await UserModel.findById(owner.id))!.verificationLevel).toBe(before);
    expect(await AuditLogModel.countDocuments({ resource: row.id, action: 'kyc.approved' })).toBe(0);
  }
  await KYCVerificationModel.updateOne({ _id: row.id }, { $set: { businessInfo: info, personalInfo, documents } });
  await UserModel.updateOne({ _id: owner.id }, { $set: { role: 'user' } });
  expect((await approve()).status).toBe(422);
  await UserModel.updateOne({ _id: owner.id }, { $set: { role: 'organization' } });
  expect((await approve()).status).toBe(200);
  expect((await UserModel.findById(owner.id))!.verificationLevel).toBe(3);
});

it('validates address proof without granting identity privileges', async () => {
  const owner = await account(), staff = await account(true);
  const before = (await UserModel.findById(owner.id))!.verificationLevel;
  const row = await KYCVerificationModel.create({ userId: owner.id, verificationType: 'address', status: 'pending', documents: [] });
  const approve = async () => request(app).put(`/api/v1/kyc/${row.id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Address evidence reviewed against the application.', reviewVersion: await reviewVersion(row.id) });
  for (const address of [{}, { country: 'Ghana', city: 'Accra' }, { country: 'Nigeria', city: 'Lagos', proofMethod: 'ghana_post_gps', gpsAddress: 'GA-123-4567' }, { country: 'Ghana', city: 'Accra', proofMethod: 'document', street: 'Fixture street' }]) {
    await KYCVerificationModel.updateOne({ _id: row.id }, { $set: { 'personalInfo.address': address } });
    expect((await approve()).status).toBe(422);
  }
  await KYCVerificationModel.updateOne({ _id: row.id }, { $set: { 'personalInfo.address': { country: 'Ghana', city: 'Accra', proofMethod: 'ghana_post_gps', gpsAddress: 'GA-123-4567' } } });
  expect((await approve()).status).toBe(200);
  expect((await UserModel.findById(owner.id))!.verificationLevel).toBe(before);
  const document = await PrivateKycDocumentModel.create({ userId: owner.id, publicId: 'address-proof', resourceType: 'image', format: 'png', mimeType: 'image/png' });
  const second = await KYCVerificationModel.create({ userId: owner.id, verificationType: 'address', status: 'pending', personalInfo: { address: { country: 'Nigeria', city: 'Lagos', proofMethod: 'document', street: 'Fixture street' } }, documents: [{ type: 'utility_bill', url: `kyc://${document.id}`, uploadedAt: new Date() }] });
  await request(app).put(`/api/v1/kyc/${second.id}/approve`).set('Authorization', staff.auth).send({ evidenceReviewed: true, reviewNotes: 'Address evidence reviewed against the application.', reviewVersion: await reviewVersion(second.id) }).expect(200);
  expect((await UserModel.findById(owner.id))!.verificationLevel).toBe(before);
});

it('reports expired evidence without rewriting the historical approval and permits renewal', async () => {
  const owner = await account();
  const expired = await KYCVerificationModel.create({ userId: owner.id, verificationType: 'identity', status: 'approved', expiryDate: new Date('2020-01-01'), documents: [] });
  const status = await request(app).get('/api/v1/kyc/status').set('Authorization', owner.auth).expect(200);
  expect(status.body.data.kycStatus).toBe('expired');
  expect(status.body.data.kycLevel).toBe(0);
  expect(status.body.data.verifications[0]).toMatchObject({ status: 'expired', expiresAt: '2020-01-01T00:00:00.000Z' });
  expect((await KYCVerificationModel.findById(expired.id))!.status).toBe('approved');
  await request(app).post('/api/v1/kyc/identity').set('Authorization', owner.auth).send({ personalInfo: { fullName: 'Renewal fixture', dateOfBirth: '1990-01-01T00:00:00.000Z' } }).expect(201);
  const renewed = await request(app).get('/api/v1/kyc/status').set('Authorization', owner.auth).expect(200);
  expect(renewed.body.data.kycStatus).toBe('pending');
  expect(renewed.body.data.verifications).toHaveLength(2);
});


it.each(['pending', 'rejected', 'expired'] as const)('does not let an older approval mask the latest %s review in account status', async latestStatus => {
  const owner = await account();
  const old = await KYCVerificationModel.create({ userId: owner.id, verificationType: 'identity', status: 'approved', expiryDate: new Date(Date.now() + 86400000), documents: [], createdAt: new Date(Date.now() - 60000) });
  const latest = await KYCVerificationModel.create({ userId: owner.id, verificationType: 'identity', status: latestStatus, documents: [] });
  const read = () => request(app).get('/api/v1/kyc/status').set('Authorization', owner.auth).expect(200);
  const response = await read();
  expect(response.body.data).toMatchObject({ kycStatus: latestStatus, kycLevel: 0 });
  expect(response.body.data.verifications).toHaveLength(2);
  expect(response.body.data.verifications.find((row: { id: string }) => row.id === old.id).status).toBe('approved');
  expect((await KYCVerificationModel.findById(old.id))!.status).toBe('approved');
  await KYCVerificationModel.updateOne({ _id: latest.id }, { $set: { status: 'approved', expiryDate: new Date(Date.now() + 86400000) } });
  expect((await read()).body.data).toMatchObject({ kycStatus: 'verified', kycLevel: 1 });
  await KYCVerificationModel.create({ userId: owner.id, verificationType: 'address', status: 'pending', documents: [] });
  expect((await read()).body.data).toMatchObject({ kycStatus: 'verified', kycLevel: 1 });
});
