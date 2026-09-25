import { MongoAccountProfileWrite } from '../../src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.js';
import { MongoUnitOfWork } from '../../src/infrastructure/adapters/outbound/persistence/MongoUnitOfWork.js';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { platformMediaUrl } from '../helpers/platformMedia.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { MongoPublicationAdmission } from '../../src/infrastructure/adapters/outbound/persistence/MongoPublicationAdmission.js';
import { PublicationReviewModel } from '../../src/infrastructure/database/models/PublicationReviewModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { ProfileModel } from '../../src/infrastructure/database/models/ProfileModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
import { SafetyReportModel } from '../../src/infrastructure/database/models/SafetyReportModel.js';
let app: Express;
const screen = vi.fn<(_: string) => Promise<'allowed' | 'flagged'>>();
beforeAll(async () => { await connectTestDatabase(); await Promise.all([PublicationReviewModel.init(), ProfileModel.init(), SafetyReportModel.init()]); app = await createTestApp({ publicationAdmission: new MongoPublicationAdmission({ screen }) }); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function account(admin = false) {
  const result = await request(app).post('/api/v1/auth/register').send({ name: 'Original account name', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const id = result.body.data.user.id;
  if (admin) await UserModel.findByIdAndUpdate(id, { role: 'admin' });
  return { id, auth: `Bearer ${result.body.data.tokens.accessToken}` };
}
type Account = Awaited<ReturnType<typeof account>>;
const save = (actor: Account, data: object) => request(app).put('/api/v1/profile').set('Authorization', actor.auth).send(data);
async function approve(owner: Account) {
  const admin = await account(true);
  const review = await PublicationReviewModel.findOne({ actorId: owner.id, action: 'account.profile', status: 'pending' }).sort({ createdAt: -1 });
  expect(review).toBeTruthy();
  await request(app).put(`/api/v1/admin/publication-reviews/${review!.id}/review`).set('Authorization', admin.auth).send({ decision: 'approved', notes: 'Reviewed the complete proposed public identity and profile visibility.' }).expect(200);
  return review!;
}
it('holds the full public identity but excludes private phone and biography from screening/evidence', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account();
  await save(owner, { phone: '0550000001', bio: 'Private personal biography' }).expect(200);
  await save(owner, { name: 'Proposed account name', phone: '0550000002', bio: 'Revised private biography' }).expect(409);
  expect(screen).not.toHaveBeenCalled();
  expect((await UserModel.findById(owner.id))?.name).toBe('Original account name');
  expect((await ProfileModel.findOne({ userId: owner.id }))?.phone).toBe('0550000001');
  const review = await approve(owner);
  expect(JSON.parse(review.text)).toEqual({ name: 'Proposed account name', country: '', avatarUrl: '', coverUrl: '', publicProfile: true });
  expect(review.text).not.toContain('055'); expect(review.text).not.toContain('biography');
  await save(owner, { name: 'Changed proposal' }).expect(409);
  await save(owner, { name: 'Proposed account name', phone: '0550000002', bio: 'Revised private biography' }).expect(200);
  expect((await ProfileModel.findOne({ userId: owner.id }))?.bio).toBe('Revised private biography');
});
it('requires a fresh review to expose an existing private profile and allows hiding without consent', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account();
  await save(owner, { publicProfile: false }).expect(200);
  await save(owner, { publicProfile: true }).expect(409);
  await request(app).get(`/api/v1/users/${owner.id}/public`).expect(404);
  await approve(owner);
  await save(owner, { publicProfile: true }).expect(200);
  await request(app).get(`/api/v1/users/${owner.id}/public`).expect(200);
  await ContentRestrictionModel.create({ userId: owner.id, reason: 'Fixture restriction', restrictedBy: 'fixture' });
  await UserModel.findByIdAndUpdate(owner.id, { $unset: { legalAcceptance: 1 } });
  await save(owner, { publicProfile: false, phone: '0551234567', bio: 'Still private' }).expect(200);
  await request(app).get(`/api/v1/users/${owner.id}/public`).expect(404);
});
it('holds media with exact image slots and never sends it to the text screener', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account(), image = platformMediaUrl('portrait.jpg');
  await save(owner, { avatarUrl: image, automatedReviewConsent: true }).expect(409);
  expect(screen).not.toHaveBeenCalled();
  await approve(owner);
  await save(owner, { coverUrl: image }).expect(409);
  await save(owner, { avatarUrl: image }).expect(200);
  expect((await UserModel.findById(owner.id))?.avatarUrl).toBe(image);
});
it('rejects concurrent identity/visibility changes without undoing independent private edits', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account();
  screen.mockImplementationOnce(async () => { await save(owner, { phone: '0557654321', publicProfile: false }).expect(200); return 'allowed'; });
  await save(owner, { name: 'Stale proposed name', automatedReviewConsent: true }).expect(409);
  expect((await UserModel.findById(owner.id))?.name).toBe('Original account name');
  expect(await ProfileModel.findOne({ userId: owner.id })).toMatchObject({ publicProfile: false, phone: '0557654321' });
  screen.mockImplementationOnce(async () => { await save(owner, { bio: 'Private concurrent edit' }).expect(200); return 'allowed'; });
  await save(owner, { name: 'Reviewed current name', automatedReviewConsent: true }).expect(200);
  expect((await ProfileModel.findOne({ userId: owner.id }))?.bio).toBe('Private concurrent edit');
});
it('does not allow stale approvals after another identity revision', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account();
  await save(owner, { name: 'Pending name' }).expect(409); await approve(owner);
  await save(owner, { country: 'Ghana', automatedReviewConsent: true }).expect(200);
  await save(owner, { name: 'Pending name' }).expect(409);
});
it('fails closed for provider outage, revoked credentials, restrictions and closure during review', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account();
  screen.mockRejectedValueOnce(new Error('Fixture unavailable provider'));
  await save(owner, { name: 'Provider failure name', automatedReviewConsent: true }).expect(409);
  screen.mockImplementationOnce(async () => { await UserModel.findByIdAndUpdate(owner.id, { authVersion: 'changed' }); return 'allowed'; });
  await save(owner, { name: 'Revoked request name', automatedReviewConsent: true }).expect(401);
  const restricted = await account();
  screen.mockImplementationOnce(async () => { await ContentRestrictionModel.create({ userId: restricted.id, reason: 'Restricted during screening', restrictedBy: 'fixture' }); return 'allowed'; });
  await save(restricted, { country: 'Ghana', automatedReviewConsent: true }).expect(403);
  const closing = await account();
  screen.mockImplementationOnce(async () => { await request(app).delete('/api/v1/profile').set('Authorization', closing.auth).send({ password: 'SecurePass123' }).expect(200); return 'allowed'; });
  await save(closing, { name: 'Closed request name', automatedReviewConsent: true }).expect(503);
  expect(await ProfileModel.countDocuments({ userId: closing.id })).toBe(0);
  expect(await PublicationReviewModel.countDocuments({ actorId: closing.id })).toBe(0);
});
it('keeps private biography out of user-report snapshots and profile responses out of caches', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account(), reporter = await account();
  const saved = await save(owner, { bio: 'Private biography must not be copied into a public report' }).expect(200);
  expect(saved.headers['cache-control']).toBe('private, no-store');
  await request(app).post('/api/v1/safety/reports').set('Authorization', reporter.auth).send({ targetType: 'user', targetId: owner.id, reason: 'other', description: 'Review this reported public account identity.' }).expect(201);
  const report = await SafetyReportModel.findOne({ targetId: owner.id });
  expect(report?.evidence).toBe('Original account name');
});

it('does not treat an unchanged identity payload as permission to overwrite a concurrent edit', async () => {
  const owner = await account();
  const admission = { assertAllowed: vi.fn(async () => {}) };
  const writer = new MongoAccountProfileWrite({ run: async work => {
    await UserModel.findByIdAndUpdate(owner.id, { $set: { name: 'Concurrent reviewed identity' }, $inc: { accountIdentityRevision: 1 } });
    return new MongoUnitOfWork().run(work);
  } }, admission);
  await expect(writer.write(owner.id, { name: 'Original account name' }, '')).rejects.toMatchObject({ statusCode: 409 });
  expect(admission.assertAllowed).not.toHaveBeenCalled();
  expect((await UserModel.findById(owner.id))?.name).toBe('Concurrent reviewed identity');
});

it('removes an avatar or cover at once, without review, consent, agreement or a lifted restriction', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account(), avatar = platformMediaUrl('avatar.jpg'), cover = platformMediaUrl('cover.jpg');
  await save(owner, { avatarUrl: avatar, coverUrl: cover }).expect(409);
  await approve(owner);
  await save(owner, { avatarUrl: avatar, coverUrl: cover }).expect(200);
  const reviews = await PublicationReviewModel.countDocuments({ actorId: owner.id });
  // Cover removal while the avatar remains publishes immediately.
  await save(owner, { coverUrl: '' }).expect(200);
  expect(await UserModel.findById(owner.id).lean()).toMatchObject({ avatarUrl: avatar, coverUrl: '' });
  // Even a restricted account without the current agreement can take its photo down.
  await ContentRestrictionModel.create({ userId: owner.id, reason: 'Fixture restriction', restrictedBy: 'fixture' });
  await UserModel.findByIdAndUpdate(owner.id, { $unset: { legalAcceptance: 1 } });
  await save(owner, { avatarUrl: '' }).expect(200);
  const saved = await UserModel.findById(owner.id).lean();
  expect(saved).toMatchObject({ avatarUrl: '' });
  expect(saved!.reviewedAvatarUrl).toBeUndefined();
  expect(await PublicationReviewModel.countDocuments({ actorId: owner.id })).toBe(reviews);
  expect(screen).not.toHaveBeenCalled();
  // A removal combined with a new public change is still reviewed.
  await ContentRestrictionModel.deleteMany({ userId: owner.id });
  await UserModel.findByIdAndUpdate(owner.id, { $set: { legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: new Date() } } });
  await save(owner, { name: 'Renamed while removing', coverUrl: '' }).expect(409);
});

it('screens a name change by an avatar user as text and never re-holds the unchanged avatar as media', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const owner = await account(), avatar = platformMediaUrl('approved-avatar.jpg');
  await save(owner, { avatarUrl: avatar }).expect(409);
  await approve(owner);
  await save(owner, { avatarUrl: avatar }).expect(200);
  expect((await UserModel.findById(owner.id).lean())!.reviewedAvatarUrl).toBe(avatar);
  await save(owner, { name: 'Screened new name', automatedReviewConsent: true }).expect(200);
  expect(screen).toHaveBeenCalledTimes(1);
  const review = await PublicationReviewModel.findOne({ actorId: owner.id, status: 'approved', reviewedBy: 'automated:openai' }).lean();
  expect(review!.mediaUrls).toEqual([]);
  expect(JSON.parse(review!.text)).toMatchObject({ name: 'Screened new name', avatarUrl: avatar });
  // A new image is still media, held for staff even with consent.
  const next = platformMediaUrl('next-avatar.jpg');
  await save(owner, { avatarUrl: next, automatedReviewConsent: true }).expect(409);
  expect(await PublicationReviewModel.findOne({ actorId: owner.id, status: 'pending' }).lean()).toMatchObject({ reason: 'media', mediaUrls: [next] });
  expect(screen).toHaveBeenCalledTimes(1);
});

it('lets comments carry a staff-reviewed avatar through text screening but holds a legacy avatar as media', async () => {
  screen.mockReset(); screen.mockResolvedValue('allowed');
  const { CampaignModel } = await import('../../src/infrastructure/database/models/CampaignModel.js');
  const { CampaignCommentModel } = await import('../../src/infrastructure/database/models/CampaignCommentModel.js');
  const owner = await account(), reviewed = await account(), legacy = await account();
  const campaign = await CampaignModel.create({ title: 'Comment media fixture', description: 'A public campaign', goalAmount: 500, currency: 'GHS', category: 'education', status: 'active', creatorId: owner.id, startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
  const comments = `/api/v1/campaigns/${campaign.id}/comments`;
  const avatar = platformMediaUrl('reviewed-commenter.jpg');
  await save(reviewed, { avatarUrl: avatar }).expect(409);
  await approve(reviewed);
  await save(reviewed, { avatarUrl: avatar }).expect(200);
  const posted = await request(app).post(comments).set('Authorization', reviewed.auth).send({ content: 'Screened with a reviewed avatar', automatedReviewConsent: true }).expect(201);
  expect(posted.body.data.authorAvatarUrl).toBe(avatar);
  const review = await PublicationReviewModel.findOne({ actorId: reviewed.id, action: 'comment.create' }).lean();
  expect(review).toMatchObject({ status: 'approved', mediaUrls: [] });
  expect(JSON.parse(review!.text)).toMatchObject({ authorAvatarUrl: avatar });
  // Set outside the reviewed profile path: still inspected as media.
  await UserModel.findByIdAndUpdate(legacy.id, { $set: { avatarUrl: 'https://example.test/legacy.jpg' } });
  await request(app).post(comments).set('Authorization', legacy.auth).send({ content: 'Legacy avatar comment', automatedReviewConsent: true }).expect(409);
  expect(await PublicationReviewModel.findOne({ actorId: legacy.id, action: 'comment.create' }).lean()).toMatchObject({ status: 'pending', reason: 'media', mediaUrls: ['https://example.test/legacy.jpg'] });
  expect(await CampaignCommentModel.countDocuments({ authorId: legacy.id })).toBe(0);
  expect(screen).toHaveBeenCalledTimes(1);
});
