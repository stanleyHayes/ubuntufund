import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { CampaignCommentModel } from '../../src/infrastructure/database/models/CampaignCommentModel.js';
import { CampaignUpdateModel } from '../../src/infrastructure/database/models/CampaignUpdateModel.js';
import { SafetyReportModel } from '../../src/infrastructure/database/models/SafetyReportModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); await SafetyReportModel.init(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function account() {
  const result = await request(app).post('/api/v1/auth/register').send({ name: 'Update reviewer', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { id: result.body.data.user.id, auth: `Bearer ${result.body.data.tokens.accessToken}` };
}
async function fixture() {
  const owner = await account(), reader = await account(), admin = await account();
  await UserModel.findByIdAndUpdate(admin.id, { role: 'admin' });
  const campaign = await CampaignModel.create({ title: 'Campaign update safety', description: 'Fixture campaign', goalAmount: 500, raisedAmount: 125, currency: 'GHS', category: 'education', status: 'active', creatorId: owner.id, startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
  const update = await CampaignUpdateModel.create({ campaignId: campaign.id, authorId: owner.id, title: 'Progress report', content: 'Original content needing staff review', mediaUrls: ['https://media.example.test/progress.jpg'] });
  const input = { targetType: 'campaign_update', targetId: update.id, reason: 'harassment', description: 'Please review this campaign update.' };
  const report = () => request(app).post('/api/v1/safety/reports').set('Authorization', reader.auth).send(input);
  return { owner, reader, admin, campaign, update, input, report };
}

it('captures private update evidence and hides the update without deleting campaign funds or the source record', async () => {
  const f = await fixture();
  await request(app).post('/api/v1/safety/reports').send(f.input).expect(401);
  await request(app).post('/api/v1/safety/reports').set('Authorization', f.owner.auth).send(f.input).expect(400);
  const response = await f.report().expect(201);
  expect(Object.keys(response.body.data).sort()).toEqual(['id', 'status']);
  const id = response.body.data.id;
  const evidence = (await SafetyReportModel.findById(id))?.evidence;
  expect(evidence).toContain(f.update.content);
  expect(evidence).toContain(f.update.mediaUrls[0]);
  expect((await f.report().expect(201)).body.data.id).toBe(id);
  const review = `/api/v1/admin/safety-reports/${id}/review`;
  const decision = { action: 'hide_update', notes: 'Reviewed the reported update and confirmed removal is necessary.' };
  await request(app).put(review).set('Authorization', f.reader.auth).send(decision).expect(403);
  await request(app).put(review).set('Authorization', f.admin.auth).send(decision).expect(200);
  const list = await request(app).get(`/api/v1/campaigns/${f.campaign.id}/updates`).expect(200);
  expect(list.body.data.items).toEqual([]);
  expect((await CampaignUpdateModel.findById(f.update.id))?.moderationReportId).toBe(id);
  expect((await CampaignUpdateModel.findById(f.update.id))?.content).toBe(f.update.content);
  expect((await CampaignModel.findById(f.campaign.id))?.raisedAmount).toBe(125);
  expect((await SafetyReportModel.findById(id))?.evidence).toBe(evidence);
  expect(await AuditLogModel.exists({ action: 'safety.hide_update', actorId: f.admin.id })).toBeTruthy();
  await request(app).put(`/api/v1/campaigns/${f.campaign.id}/updates/${f.update.id}`).set('Authorization', f.owner.auth).send({ content: 'Attempted restoration' }).expect(404);
});

it('rejects a stale hide decision before claiming it, so staff can resolve the original report', async () => {
  const f = await fixture();
  const id = (await f.report().expect(201)).body.data.id;
  await request(app).put(`/api/v1/campaigns/${f.campaign.id}/updates/${f.update.id}`).set('Authorization', f.owner.auth).send({ content: 'A different edited version for review' }).expect(200);
  const path = `/api/v1/admin/safety-reports/${id}/review`;
  await request(app).put(path).set('Authorization', f.admin.auth).send({ action: 'hide_update', notes: 'This decision was based on the previous content snapshot.' }).expect(409);
  expect((await CampaignUpdateModel.findById(f.update.id))?.deletedAt).toBeUndefined();
  expect((await SafetyReportModel.findById(id))?.reviewAction).toBeUndefined();
  await request(app).put(path).set('Authorization', f.admin.auth).send({ action: 'resolve', notes: 'The author changed the update; reviewed the current content separately.' }).expect(200);
});

it('keeps nonpublic campaign updates private and excludes a blocked author for the signed-in reader', async () => {
  const f = await fixture();
  await CampaignModel.findByIdAndUpdate(f.campaign.id, { status: 'pending_review' });
  const path = `/api/v1/campaigns/${f.campaign.id}/updates`;
  await request(app).get(path).expect(404);
  await request(app).get(path).set('Authorization', f.reader.auth).expect(404);
  expect((await request(app).get(path).set('Authorization', f.owner.auth).expect(200)).body.data.items).toHaveLength(1);
  await f.report().expect(404);
  await CampaignModel.findByIdAndUpdate(f.campaign.id, { status: 'active' });
  await request(app).put(`/api/v1/safety/blocks/${f.owner.id}`).set('Authorization', f.reader.auth).send({}).expect(200);
  expect((await request(app).get(path).set('Authorization', f.reader.auth).expect(200)).body.data.items).toEqual([]);
  expect((await request(app).get(path).expect(200)).body.data.items).toHaveLength(1);
});

it('retries the same hide after a later audit failure without replacing the decision or evidence', async () => {
  const f = await fixture();
  const id = (await f.report().expect(201)).body.data.id;
  const original = AuditLogModel.create.bind(AuditLogModel);
  const failure = vi.spyOn(AuditLogModel, 'create').mockImplementation((...args) => {
    if ((args[0] as unknown as { action?: string })?.action === 'safety.hide_update') return Promise.reject(new Error('Injected audit failure')) as never;
    return original(...args) as never;
  });
  const path = `/api/v1/admin/safety-reports/${id}/review`;
  const notes = 'Reviewed the original campaign update and confirmed the hide decision.';
  try { await request(app).put(path).set('Authorization', f.admin.auth).send({ action: 'hide_update', notes }).expect(500); } finally { failure.mockRestore(); }
  expect((await SafetyReportModel.findById(id))?.status).toBe('pending');
  expect((await CampaignUpdateModel.findById(f.update.id))?.deletedAt).toBeTruthy();
  const restarted = await createTestApp();
  await request(restarted).put(path).set('Authorization', f.admin.auth).send({ action: 'hide_update', notes: 'Retry must preserve the original staff decision notes.' }).expect(200);
  expect(await SafetyReportModel.findById(id)).toMatchObject({ status: 'resolved', reviewNotes: notes, resolution: 'hide_update' });
});

it('protects comments on nonpublic campaigns and refuses outsider writes before saving', async () => {
  const f = await fixture();
  await CampaignCommentModel.create({ campaignId: f.campaign.id, authorId: f.owner.id, content: 'Private preparation notes' });
  const path = `/api/v1/campaigns/${f.campaign.id}/comments`;
  for (const status of ['draft', 'pending_review', 'blocked']) {
    await CampaignModel.findByIdAndUpdate(f.campaign.id, { status });
    expect((await request(app).get(path).expect(404)).headers['cache-control']).toBe('private, no-store');
    await request(app).get(path).set('Authorization', f.reader.auth).expect(404);
    expect((await request(app).get(path).set('Authorization', f.owner.auth).expect(200)).body.data.items).toHaveLength(1);
    expect((await request(app).get(path).set('Authorization', f.admin.auth).expect(200)).body.data.items).toHaveLength(1);
    await request(app).post(path).set('Authorization', f.reader.auth).send({ content: 'Unauthorized private campaign comment' }).expect(404);
  }
  expect(await CampaignCommentModel.countDocuments({ campaignId: f.campaign.id })).toBe(1);
  await CampaignModel.findByIdAndUpdate(f.campaign.id, { status: 'active' });
  expect((await request(app).get(path).expect(200)).body.data.items).toHaveLength(1);
  await request(app).post(path).set('Authorization', f.reader.auth).send({ content: 'Public campaign encouragement' }).expect(201);
  await request(app).put(`/api/v1/safety/blocks/${f.owner.id}`).set('Authorization', f.reader.auth).send({}).expect(200);
  const visible = (await request(app).get(path).set('Authorization', f.reader.auth).expect(200)).body.data.items;
  expect(visible).toHaveLength(1);
  expect(visible[0].authorId).toBe(f.reader.id);
});
