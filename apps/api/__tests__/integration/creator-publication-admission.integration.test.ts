import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { platformMediaUrl } from '../helpers/platformMedia.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { MongoPublicationAdmission } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.js';
import { MongoCreatorBalanceRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCreatorBalanceRepository.js';
import { PublicationReviewModel } from '../../src/infrastructure/database/models/PublicationReviewModel.js';
import { CreatorProfileModel } from '../../src/infrastructure/database/models/CreatorProfileModel.js';
import { CreatorBalanceModel } from '../../src/infrastructure/database/models/CreatorBalanceModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
let app: Express;
const screen = vi.fn<(_: string) => Promise<'allowed' | 'flagged'>>();
beforeAll(async () => {
  await connectTestDatabase(); await Promise.all([PublicationReviewModel.init(), CreatorProfileModel.init(), CreatorBalanceModel.init()]);
  app = await createTestApp({ publicationAdmission: new MongoPublicationAdmission({ screen }) });
});
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function account(admin = false) {
  const response = await request(app).post('/api/v1/auth/register').send({ name: 'Creator review fixture', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const id = response.body.data.user.id;
  if (admin) await UserModel.findByIdAndUpdate(id, { role: 'admin' });
  await SubscriptionModel.create({ userId: id, tier: 'starter', status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000) });
  return { id, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
const input = () => ({ handle: `creator-${randomUUID().slice(0, 8)}`, displayName: 'Ama Creator', tagline: 'Original tagline', bio: 'A complete proposed public creator biography.', tipsEnabled: false, presetAmounts: [15, 30], currency: 'GHS', thankYouMessage: 'Thank you for supporting this work.' });
const save = (owner: Awaited<ReturnType<typeof account>>, body: object) => request(app).post('/api/v1/creators/profile').set('Authorization', owner.auth).send(body);
async function approve(owner: Awaited<ReturnType<typeof account>>) {
  const admin = await account(true);
  const review = await PublicationReviewModel.findOne({ actorId: owner.id, action: 'creator.profile', status: 'pending' }).sort({ createdAt: -1 });
  expect(review).toBeTruthy();
  await request(app).put(`/api/v1/admin/publication-reviews/${review!.id}/review`).set('Authorization', admin.auth).send({ decision: 'approved', notes: 'Reviewed all proposed creator fields and each public image.' }).expect(200);
  return review!;
}
it('holds new pages without side effects, deduplicates and publishes only the approved complete version', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account(), body = input();
  await save(owner, body).expect(409); await save(owner, body).expect(409);
  expect(screen).not.toHaveBeenCalled();
  expect(await CreatorProfileModel.countDocuments({ userId: owner.id })).toBe(0);
  expect(await CreatorBalanceModel.countDocuments({ userId: owner.id })).toBe(0);
  expect(await PublicationReviewModel.countDocuments({ actorId: owner.id })).toBe(1);
  await request(app).get(`/api/v1/creators/${body.handle}`).expect(404);
  const review = await approve(owner);
  expect(JSON.parse(review.text)).toMatchObject(body);
  await save(owner, { ...body, bio: 'A different unapproved biography.' }).expect(409);
  const result = await save(owner, body).expect(200);
  expect(result.body.data).toMatchObject(body); expect(result.body.data.revision).toBeUndefined();
  const page = await request(app).get(`/api/v1/creators/${body.handle}`).expect(200);
  expect(page.headers['cache-control']).toBe('private, no-store');
});
it('reviews merged partial edits and retains omitted settings and current public content on a hold', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account(), body = input();
  await save(owner, { ...body, automatedReviewConsent: true }).expect(200);
  screen.mockResolvedValueOnce('flagged');
  await save(owner, { bio: 'Proposed replacement biography', automatedReviewConsent: true }).expect(409);
  expect((await CreatorProfileModel.findOne({ userId: owner.id }))?.bio).toBe(body.bio);
  const review = await approve(owner);
  expect(JSON.parse(review.text)).toMatchObject({ ...body, bio: 'Proposed replacement biography' });
  const result = await save(owner, { bio: 'Proposed replacement biography' }).expect(200);
  expect(result.body.data).toMatchObject({ ...body, bio: 'Proposed replacement biography' });
});
it('holds media without sending it to text screening and removes dynamic account-image fallback', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account(), body = input(), image = platformMediaUrl('photo.jpg');
  await UserModel.findByIdAndUpdate(owner.id, { avatarUrl: image, coverUrl: image });
  await save(owner, { ...body, automatedReviewConsent: true }).expect(200);
  const publicPage = await request(app).get(`/api/v1/creators/${body.handle}`).expect(200);
  expect(publicPage.body.data.avatarUrl).toBeFalsy(); expect(publicPage.body.data.coverUrl).toBeFalsy();
  screen.mockClear();
  await save(owner, { avatarUrl: image, automatedReviewConsent: true }).expect(409);
  expect(screen).not.toHaveBeenCalled();
  await approve(owner);
  // Moving the same image to a different slot requires its own exact-version review.
  await save(owner, { coverUrl: image }).expect(409);
  await save(owner, { avatarUrl: image }).expect(200);
  await UserModel.findByIdAndUpdate(owner.id, { avatarUrl: 'https://media.example.test/unreviewed.jpg' });
  expect((await request(app).get(`/api/v1/creators/${body.handle}`).expect(200)).body.data.avatarUrl).toBe(image);
});
it('allows exact pause with expired plan, restrictions and stale agreements, preserving money and page fields', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account(), body = { ...input(), tipsEnabled: true };
  await save(owner, { ...body, automatedReviewConsent: true }).expect(200);
  await CreatorBalanceModel.updateOne({ userId: owner.id }, { availableBalance: 123.45, totalReceived: 200 });
  await SubscriptionModel.updateOne({ userId: owner.id }, { currentPeriodEnd: new Date(0) });
  await UserModel.findByIdAndUpdate(owner.id, { $unset: { legalAcceptance: 1 } });
  await ContentRestrictionModel.create({ userId: owner.id, reason: 'Fixture restriction', restrictedBy: 'fixture' });
  screen.mockClear();
  const paused = await save(owner, { tipsEnabled: false }).expect(200);
  expect(paused.body.data).toMatchObject({ ...body, tipsEnabled: false });
  expect(screen).not.toHaveBeenCalled();
  const denied = await save(owner, { tipsEnabled: false, bio: 'Sneaked public edit' });
  expect([403, 428]).toContain(denied.status);
  expect((await CreatorBalanceModel.findOne({ userId: owner.id }))?.availableBalance).toBe(123.45);
});
it('rejects a stale write and approval after a concurrent creator revision', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account(), body = input();
  await save(owner, { ...body, automatedReviewConsent: true }).expect(200);
  screen.mockImplementationOnce(async () => { await CreatorProfileModel.updateOne({ userId: owner.id }, { $set: { bio: 'Concurrent approved edit' }, $inc: { revision: 1 } }); return 'allowed'; });
  await save(owner, { bio: 'Stale proposed edit', automatedReviewConsent: true }).expect(409);
  expect((await CreatorProfileModel.findOne({ userId: owner.id }))?.bio).toBe('Concurrent approved edit');
  await save(owner, { bio: 'Pending proposed edit' }).expect(409); await approve(owner);
  await CreatorProfileModel.updateOne({ userId: owner.id }, { $inc: { revision: 1 } });
  await save(owner, { bio: 'Pending proposed edit' }).expect(409);
});
it('fails closed on provider outage and revoked credentials or closure during screening', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account();
  screen.mockRejectedValueOnce(new Error('Fixture screening outage'));
  await save(owner, { ...input(), automatedReviewConsent: true }).expect(409);
  screen.mockImplementationOnce(async () => { await UserModel.findByIdAndUpdate(owner.id, { authVersion: 'rotated-fixture' }); return 'allowed'; });
  await save(owner, { ...input(), automatedReviewConsent: true }).expect(401);
  expect(await CreatorProfileModel.countDocuments({ userId: owner.id })).toBe(0);
  const closing = await account();
  screen.mockImplementationOnce(async () => { await UserModel.findByIdAndUpdate(closing.id, { deletedAt: new Date() }); return 'allowed'; });
  await save(closing, { ...input(), automatedReviewConsent: true }).expect(401);
  expect(await CreatorProfileModel.countDocuments({ userId: closing.id })).toBe(0);
});
it('rolls back the profile and account fence if balance persistence fails', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account();
  const before = (await UserModel.findById(owner.id))?.profileWriteVersion;
  const failure = vi.spyOn(MongoCreatorBalanceRepository.prototype, 'ensure').mockRejectedValueOnce(new Error('Fixture balance persistence failure'));
  try { await save(owner, { ...input(), automatedReviewConsent: true }).expect(500); } finally { failure.mockRestore(); }
  expect(await CreatorProfileModel.countDocuments({ userId: owner.id })).toBe(0);
  expect((await UserModel.findById(owner.id))?.profileWriteVersion).toBe(before);
});
it('rejects invalid public payloads before admission', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account();
  for (const invalid of [{ avatarUrl: 'javascript:alert(1)' }, { bio: 'x'.repeat(5001) }, { currency: 'USD' }, { presetAmounts: [-1] }, { unexpected: true }]) {
    await save(owner, { ...input(), ...invalid }).expect(400);
  }
  expect(screen).not.toHaveBeenCalled();
  expect(await PublicationReviewModel.countDocuments({ actorId: owner.id })).toBe(0);
});
