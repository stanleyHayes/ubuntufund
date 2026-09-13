import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { DataRightsRequestModel, DataRightsEventModel } from '../../src/infrastructure/database/models/DataRightsRequestModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { resetRateLimiters } from '../../src/infrastructure/adapters/inbound/middleware/rateLimiter.js';
import { MongoUnitOfWork } from '../../src/infrastructure/adapters/outbound/persistence/MongoUnitOfWork.js';
let app: Express, owner: { id: string; token: string }, other: { id: string; token: string }, admin: { id: string; token: string };
async function register() {
  const result = await request(app).post('/api/v1/auth/register').send({ email: `rights-${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Rights test', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { id: result.body.data.user.id as string, token: result.body.data.tokens.accessToken as string };
}
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); owner = await register(); other = await register(); admin = await register(); await UserModel.findByIdAndUpdate(admin.id, { role: 'admin' }); });
beforeEach(async () => { resetRateLimiters(); vi.restoreAllMocks(); await DataRightsEventModel.deleteMany({}); await DataRightsRequestModel.deleteMany({}); await UserModel.findByIdAndUpdate(owner.id, { $unset: { deletedAt: 1 } }); await UserModel.findByIdAndUpdate(admin.id, { role: 'admin' }); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
const body = { kind: 'access', details: 'Please provide a copy of all of my personal data.' };
const submit = () => request(app).post('/api/v1/data-rights').set('Authorization', `Bearer ${owner.token}`).send(body);
const review = (id: string, overrides = {}) => request(app).put(`/api/v1/admin/data-rights/${id}/review`).set('Authorization', `Bearer ${admin.token}`).send({ revision: 0, status: 'responded', response: 'Your requested information is included in this response.', evidence: 'Internal evidence: all relevant systems reviewed.', ...overrides });
it.each(['role', 'credentials', 'closure'] as const)('denies a privacy review when staff %s changes after authentication', async kind => {
  const created = await submit().expect(201);
  const before = await UserModel.findById(admin.id);
  const original = MongoUnitOfWork.prototype.run;
  const run = vi.spyOn(MongoUnitOfWork.prototype, 'run').mockImplementation(async function (this: MongoUnitOfWork, work) {
    await UserModel.updateOne({ _id: admin.id }, { $set: kind === 'role' ? { role: 'user' } : kind === 'credentials' ? { authVersion: randomUUID() } : { deletedAt: new Date() } });
    return original.call(this, work);
  });
  try {
    await review(created.body.data._id).expect(403);
    const saved = await DataRightsRequestModel.findById(created.body.data._id);
    expect(saved).toMatchObject({ status: 'open', active: true, revision: 0, response: '' });
    expect(await DataRightsEventModel.countDocuments({ requestId: created.body.data._id })).toBe(1);
  } finally {
    run.mockRestore();
    await UserModel.updateOne({ _id: admin.id }, { $set: { role: 'admin', authVersion: before?.authVersion ?? '' }, $unset: { deletedAt: 1 } });
  }
});

it('records a private request and target, prevents duplicates and rejects spoofed ownership', async () => {
  await request(app).post('/api/v1/data-rights').send(body).expect(401);
  await request(app).post('/api/v1/data-rights').set('Authorization', `Bearer ${owner.token}`).send({ ...body, userId: other.id }).expect(400);
  const results = await Promise.all([submit(), submit()]);
  expect(results.map(result => result.status).sort()).toEqual([201, 409]);
  const item = results.find(result => result.status === 201)!.body.data;
  expect(Date.parse(item.dueAt) - Date.parse(item.createdAt)).toBeGreaterThan(29 * 86400_000);
  expect(await DataRightsEventModel.countDocuments({ action: 'submitted' })).toBe(1);
  const mine = await request(app).get(`/api/v1/data-rights?userId=${other.id}`).set('Authorization', `Bearer ${owner.token}`).expect(200);
  expect(mine.headers['cache-control']).toContain('no-store');
  expect(mine.body.data.items.map((item: { _id: string }) => item._id)).toEqual([item._id]);
  expect(mine.body.data.items[0]).not.toHaveProperty('userId');
  const theirs = await request(app).get('/api/v1/data-rights').set('Authorization', `Bearer ${other.token}`).expect(200);
  expect(theirs.body.data.total).toBe(0);
});
it('publishes one response, preserves evidence privately and prevents stale overwrites', async () => {
  const created = await submit().expect(201), id = created.body.data._id;
  await request(app).get('/api/v1/admin/data-rights').set('Authorization', `Bearer ${owner.token}`).expect(403);
  await review(id, { response: '' }).expect(400);
  const results = await Promise.all([review(id), review(id)]);
  expect(results.map(result => result.status).sort()).toEqual([200, 409]);
  expect(await DataRightsEventModel.countDocuments({ requestId: id })).toBe(2);
  const mine = await request(app).get('/api/v1/data-rights').set('Authorization', `Bearer ${owner.token}`).expect(200);
  expect(mine.body.data.items[0].status).toBe('responded');
  expect(mine.body.data.items[0].response).toContain('requested information');
  expect(JSON.stringify(mine.body)).not.toContain('Internal evidence');
  await request(app).get(`/api/v1/admin/data-rights/${id}/events`).set('Authorization', `Bearer ${owner.token}`).expect(403);
  const events = await request(app).get(`/api/v1/admin/data-rights/${id}/events`).set('Authorization', `Bearer ${admin.token}`).expect(200);
  expect(events.body.data.items[0].evidence).toContain('Internal evidence');
  await submit().expect(201);
});
it('retains the original target during review and exposes outstanding work in the action center', async () => {
  const created = await submit().expect(201), id = created.body.data._id;
  const reviewed = await review(id, { status: 'in_review', response: '' }).expect(200);
  expect(reviewed.body.data.dueAt).toBe(created.body.data.dueAt);
  expect(reviewed.body.data.response).toBe('');
  const actions = await request(app).get('/api/v1/admin/action-center').set('Authorization', `Bearer ${admin.token}`).expect(200);
  expect(actions.body.data.items.find((item: { id: string }) => item.id === 'data-rights').count).toBe(1);
  await review(id).expect(409);
  await review(id, { revision: 1 }).expect(200);
});
it('rolls back a submission or response when its audit event fails', async () => {
  vi.spyOn(DataRightsEventModel, 'create').mockRejectedValueOnce(new Error('audit unavailable'));
  await submit().expect(500);
  expect(await DataRightsRequestModel.countDocuments()).toBe(0);
  vi.restoreAllMocks();
  const created = await submit().expect(201);
  vi.spyOn(DataRightsEventModel, 'create').mockRejectedValueOnce(new Error('audit unavailable'));
  await review(created.body.data._id).expect(500);
  const unchanged = await DataRightsRequestModel.findById(created.body.data._id);
  expect(unchanged?.status).toBe('open'); expect(unchanged?.revision).toBe(0); expect(unchanged?.response).toBe('');
});
it('uses current administrator authority and does not publish an unreadable response to a closed account', async () => {
  const created = await submit().expect(201);
  await UserModel.findByIdAndUpdate(admin.id, { role: 'user' });
  await review(created.body.data._id).expect(403);
  await UserModel.findByIdAndUpdate(admin.id, { role: 'admin' });
  await UserModel.findByIdAndUpdate(owner.id, { deletedAt: new Date() });
  await review(created.body.data._id).expect(409);
  await request(app).get('/api/v1/data-rights').set('Authorization', `Bearer ${owner.token}`).expect(401);
  await review(created.body.data._id, { status: 'in_review' }).expect(200);
  await review(created.body.data._id, { revision: 1, deliveryMethod: 'verified_external' }).expect(400);
  await review(created.body.data._id, { revision: 1, deliveryMethod: 'verified_external', deliveryReference: 'Verified identity under case TEST; secure delivery receipt TEST-123.' }).expect(200);
  const audit = await DataRightsEventModel.findOne({ requestId: created.body.data._id, action: 'responded' });
  expect(audit?.deliveryReference).toContain('TEST-123');
  await UserModel.findByIdAndUpdate(owner.id, { $unset: { deletedAt: 1 } });
});
