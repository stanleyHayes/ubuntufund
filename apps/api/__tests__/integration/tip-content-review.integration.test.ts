import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { CreatorProfileModel } from '../../src/infrastructure/database/models/CreatorProfileModel.js';
import { TipModel } from '../../src/infrastructure/database/models/TipModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function account(admin = false) {
  const email = `${randomUUID()}@example.com`;
  const registered = await request(app).post('/api/v1/auth/register').send({ email, password: 'SecurePass123', name: 'Review fixture', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const id = registered.body.data.user.id;
  if (admin) await UserModel.updateOne({ _id: id }, { $set: { role: 'admin' } });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'SecurePass123' }).expect(200);
  return { id, auth: `Bearer ${login.body.data.tokens.accessToken}` };
}
it('holds guest attribution independently of settlement, reviews exact text and preserves funds', async () => {
  const owner = await account(), staff = await account(true);
  await CreatorProfileModel.create({ userId: owner.id, handle: 'review-tip', displayName: 'Creator' });
  const tip = await TipModel.create({ creatorUserId: owner.id, supporterName: 'Guest name', supporterEmail: 'private@example.com', message: 'Supporter message', settlementApplied: true, providerRef: `tip-${randomUUID()}`, amount: 30, netAmount: 30, currency: 'GHS', status: 'SUCCEEDED' });
  const publicPath = '/api/v1/creators/review-tip';
  const before = (await request(app).get(publicPath).expect(200)).body.data;
  expect(before.recentTips[0]).toMatchObject({ supporterName: 'Supporter', amount: 30 });
  expect(before.recentTips[0].message).toBeUndefined();
  const confirmation = await request(app).post('/api/v1/creators/tips/verify').send({ reference: tip.providerRef }).expect(200);
  expect(confirmation.body.data.contentReviewStatus).toBe('pending');
  expect(JSON.stringify(confirmation.body)).not.toContain('private@example.com');
  const reviewPath = '/api/v1/admin/tip-content-reviews';
  await request(app).get(reviewPath).expect(401);
  await request(app).get(reviewPath).set('Authorization', owner.auth).expect(403);
  const queue = await request(app).get(reviewPath).set('Authorization', staff.auth).expect(200);
  expect(JSON.stringify(queue.body)).not.toContain('private@example.com');
  const actions = (await request(app).get('/api/v1/admin/action-center').set('Authorization', staff.auth).expect(200)).body.data.items;
  expect(actions.find((item: { id: string }) => item.id === 'tip-content-reviews')).toMatchObject({ count: 1, href: '/publication-reviews?queue=tip-content-reviews' });
  const item = queue.body.data.items.find((value: { id: string }) => value.id === tip.id);
  const decision = { version: item.version, decision: 'approved', notes: 'Reviewed the exact supporter name and message.' };
  await TipModel.updateOne({ _id: tip.id }, { $set: { message: 'Changed text' } });
  await request(app).put(`${reviewPath}/${tip.id}/review`).set('Authorization', staff.auth).send(decision).expect(409);
  const current = (await request(app).get(reviewPath).set('Authorization', staff.auth).expect(200)).body.data.items.find((value: { id: string }) => value.id === tip.id);
  await request(app).put(`${reviewPath}/${tip.id}/review`).set('Authorization', staff.auth).send({ ...decision, version: current.version }).expect(200);
  const after = (await request(app).get(publicPath).expect(200)).body.data;
  expect(after.recentTips[0]).toMatchObject({ supporterName: 'Guest name', message: 'Changed text', amount: 30 });
  expect(after.totalReceived).toBe(before.totalReceived);
  expect(after.supporterCount).toBe(before.supporterCount);
  expect((await request(app).post('/api/v1/creators/tips/verify').send({ reference: tip.providerRef }).expect(200)).body.data.contentReviewStatus).toBe('approved');
  expect((await TipModel.findById(tip.id))?.status).toBe('SUCCEEDED');
  expect(await AuditLogModel.countDocuments({ resource: tip.id, action: 'tip.content.approved' })).toBe(1);
  await TipModel.updateOne({ _id: tip.id }, { $set: { supporterName: 'Unreviewed replacement' } });
  const changed = (await request(app).get(publicPath).expect(200)).body.data;
  expect(changed.recentTips[0]).toMatchObject({ supporterName: 'Supporter', amount: 30 });
  expect(changed.recentTips[0].message).toBeUndefined();
  expect(changed.totalReceived).toBe(before.totalReceived);
});

it('queues legacy approvals lacking evidence and rolls back approval if audit persistence fails', async () => {
  const owner = await account(), staff = await account(true);
  const tip = await TipModel.create({ creatorUserId: owner.id, supporterName: 'Legacy alias', amount: 25, currency: 'GHS', status: 'SUCCEEDED', publicContentStatus: 'approved' });
  const path = '/api/v1/admin/tip-content-reviews';
  const item = (await request(app).get(path).set('Authorization', staff.auth).expect(200)).body.data.items.find((value: { id: string }) => value.id === tip.id);
  expect(item.status).toBe('pending');
  const failure = vi.spyOn(AuditLogModel, 'create').mockImplementationOnce(() => { throw new Error('Audit persistence failed'); });
  try {
    await request(app).put(`${path}/${tip.id}/review`).set('Authorization', staff.auth).send({ version: item.version, decision: 'approved', notes: 'Reviewed the exact legacy public supporter alias.' }).expect(500);
  } finally { failure.mockRestore(); }
  expect((await TipModel.findById(tip.id))?.publicContentFingerprint).toBeUndefined();
  await request(app).put(`${path}/${tip.id}/review`).set('Authorization', staff.auth).send({ version: item.version, decision: 'rejected', notes: 'Declined this public supporter alias after review.' }).expect(200);
  expect((await TipModel.findById(tip.id))?.publicContentStatus).toBe('rejected');
  expect((await TipModel.findById(tip.id))?.status).toBe('SUCCEEDED');
});

it('denies self-review, restricted supporters, closed accounts and demoted staff', async () => {
  const staff = await account(true), reviewer = await account(true), supporter = await account();
  const tip = await TipModel.create({ creatorUserId: staff.id, supporterUserId: supporter.id, supporterName: 'Linked supporter', amount: 25, currency: 'GHS', status: 'SUCCEEDED' });
  const path = '/api/v1/admin/tip-content-reviews';
  const item = (await request(app).get(path).set('Authorization', reviewer.auth).expect(200)).body.data.items.find((value: { id: string }) => value.id === tip.id);
  const input = { version: item.version, decision: 'approved', notes: 'Reviewed the exact linked supporter attribution.' };
  await request(app).put(`${path}/${tip.id}/review`).set('Authorization', staff.auth).send(input).expect(403);
  await ContentRestrictionModel.create({ userId: supporter.id, restrictedBy: reviewer.id, reason: 'Public content restriction' });
  await request(app).put(`${path}/${tip.id}/review`).set('Authorization', reviewer.auth).send(input).expect(409);
  await ContentRestrictionModel.deleteOne({ userId: supporter.id });
  await request(app).delete('/api/v1/profile').set('Authorization', supporter.auth).expect(200);
  await request(app).put(`${path}/${tip.id}/review`).set('Authorization', reviewer.auth).send(input).expect(404);
  await UserModel.updateOne({ _id: reviewer.id }, { $set: { role: 'user' } });
  await request(app).put(`${path}/${tip.id}/review`).set('Authorization', reviewer.auth).send(input).expect(403);
  expect((await TipModel.findById(tip.id))?.status).toBe('SUCCEEDED');
  expect((await TipModel.findById(tip.id))?.publicContentFingerprint).toBeUndefined();
  expect(await AuditLogModel.countDocuments({ resource: tip.id, action: 'tip.content.approved' })).toBe(0);
});
it('commits only one of two conflicting concurrent staff decisions', async () => {
  const owner = await account(), first = await account(true), second = await account(true);
  const tip = await TipModel.create({ creatorUserId: owner.id, supporterName: 'Concurrent guest', amount: 25, currency: 'GHS', status: 'SUCCEEDED' });
  const path = '/api/v1/admin/tip-content-reviews';
  const item = (await request(app).get(path).set('Authorization', first.auth).expect(200)).body.data.items.find((value: { id: string }) => value.id === tip.id);
  const replies = await Promise.all([
    request(app).put(`${path}/${tip.id}/review`).set('Authorization', first.auth).send({ version: item.version, decision: 'approved', notes: 'First reviewer approves this exact public version.' }),
    request(app).put(`${path}/${tip.id}/review`).set('Authorization', second.auth).send({ version: item.version, decision: 'rejected', notes: 'Second reviewer declines this exact public version.' }),
  ]);
  expect(replies.map(reply => reply.status).sort()).toEqual([200, 409]);
  expect(await AuditLogModel.countDocuments({ resource: tip.id, action: { $in: ['tip.content.approved', 'tip.content.rejected'] } })).toBe(1);
  expect((await TipModel.findById(tip.id))?.amount).toBe(25);
});
