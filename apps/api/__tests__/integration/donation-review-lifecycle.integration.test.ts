import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { DonationModel } from '../../src/infrastructure/database/models/DonationModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
import { donationContentVersion } from '../../src/domain/entities/donationPublicContent.js';
let app: Express;
const path = '/api/v1/admin/donation-content-reviews';
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function account() {
  const result = await request(app).post('/api/v1/auth/register').send({ email: `${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Lifecycle fixture', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const id = result.body.data.user.id;
  await UserModel.updateOne({ _id: id }, { $set: { role: 'admin' } });
  return { id, auth: `Bearer ${result.body.data.tokens.accessToken}` };
}
async function gift(owner: string, donorId = 'guest') {
  const campaign = await CampaignModel.create({ title: 'Lifecycle', description: 'Attribution review fixture', goalAmount: 1000, raisedAmount: 25, currency: 'GHS', category: 'education', status: 'active', creatorId: owner, startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
  return DonationModel.create({ campaignId: campaign.id, donorId, donorName: 'Submitted alias', message: 'Submitted message', amount: 25, currency: 'GHS', isAnonymous: false });
}
it('rejects donor/owner self-review, restricted or erased donors, and demoted staff', async () => {
  const owner = await account(), donor = await account(), staff = await account();
  const donation = await gift(owner.id, donor.id);
  const body = { version: donationContentVersion(donation), decision: 'approved', notes: 'Reviewed this exact donor name and message.' };
  for (const actor of [owner, donor]) await request(app).put(`${path}/${donation.id}/review`).set('Authorization', actor.auth).send(body).expect(403);
  await ContentRestrictionModel.create({ userId: donor.id, restrictedBy: staff.id, reason: 'Publishing restricted' });
  await request(app).put(`${path}/${donation.id}/review`).set('Authorization', staff.auth).send(body).expect(409);
  await ContentRestrictionModel.deleteOne({ userId: donor.id });
  await request(app).delete('/api/v1/profile').set('Authorization', donor.auth).expect(200);
  await request(app).put(`${path}/${donation.id}/review`).set('Authorization', staff.auth).send(body).expect(404);
  await UserModel.updateOne({ _id: staff.id }, { $set: { role: 'user' } });
  await request(app).put(`${path}/${donation.id}/review`).set('Authorization', staff.auth).send(body).expect(403);
  expect((await DonationModel.findById(donation.id))?.amount).toBe(25);
  expect((await DonationModel.findById(donation.id))?.publicContentFingerprint).toBeUndefined();
});
it('rolls back on audit failure and commits only one conflicting concurrent decision', async () => {
  const owner = await account(), first = await account(), second = await account();
  const donation = await gift(owner.id);
  const body = { version: donationContentVersion(donation), decision: 'approved', notes: 'Reviewed this exact guest name and message.' };
  const failure = vi.spyOn(AuditLogModel, 'create').mockImplementationOnce(() => { throw new Error('Audit failed'); });
  try { await request(app).put(`${path}/${donation.id}/review`).set('Authorization', first.auth).send(body).expect(500); }
  finally { failure.mockRestore(); }
  expect((await DonationModel.findById(donation.id))?.publicContentStatus).toBe('pending');
  const replies = await Promise.all([
    request(app).put(`${path}/${donation.id}/review`).set('Authorization', first.auth).send(body),
    request(app).put(`${path}/${donation.id}/review`).set('Authorization', second.auth).send({ ...body, decision: 'rejected' }),
  ]);
  expect(replies.map(reply => reply.status).sort()).toEqual([200, 409]);
  expect(await AuditLogModel.countDocuments({ resource: donation.id, action: { $in: ['donation.content.approved', 'donation.content.rejected'] } })).toBe(1);
  expect((await CampaignModel.findById(donation.campaignId))?.raisedAmount).toBe(25);
});
it('requeues a remaining donor name after message removal without restoring the message', async () => {
  const owner = await account(), staff = await account(), reporter = await account();
  const donation = await gift(owner.id);
  const decision = { decision: 'approved', notes: 'Reviewed the exact donor attribution for publication.' };
  await request(app).put(`${path}/${donation.id}/review`).set('Authorization', staff.auth).send({ ...decision, version: donationContentVersion(donation) }).expect(200);
  const report = await request(app).post('/api/v1/safety/reports').set('Authorization', reporter.auth).send({ targetType: 'donation_message', targetId: donation.id, reason: 'spam', description: 'Please review this public donation message.' }).expect(201);
  await request(app).put(`/api/v1/admin/safety-reports/${report.body.data.id}/review`).set('Authorization', staff.auth).send({ action: 'hide_message', notes: 'Removed the reported donor message after review.' }).expect(200);
  const pending = (await request(app).get(path).set('Authorization', staff.auth).expect(200)).body.data.items.find((row: { id: string }) => row.id === donation.id);
  expect(pending.status).toBe('pending');
  expect(pending.text).not.toContain('Submitted message');
  await request(app).put(`${path}/${donation.id}/review`).set('Authorization', staff.auth).send({ ...decision, version: pending.version }).expect(200);
  const current = await DonationModel.findById(donation.id);
  expect(current?.message).toBeUndefined();
  expect(current?.messageHiddenAt).toBeInstanceOf(Date);
  expect(current?.amount).toBe(25);
});
