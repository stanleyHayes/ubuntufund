import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { DonationModel } from '../../src/infrastructure/database/models/DonationModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { ProfileModel } from '../../src/infrastructure/database/models/ProfileModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function register() {
  const response = await request(app).post('/api/v1/auth/register').send({ email: `${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Leaderboard fixture', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { id: response.body.data.user.id as string, token: response.body.data.tokens.accessToken as string };
}
async function setup() {
  await DonationModel.deleteMany({});
  const owner = await register(); const viewer = await register();
  const campaign = await CampaignModel.create({ title: 'Leaderboard fixture', description: 'Fixture', goalAmount: 10000, raisedAmount: 8000, currency: 'GHS', category: 'education', status: 'active', creatorId: owner.id, startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
  const donate = (donorId: string, amount: number, extra = {}) => DonationModel.create({ campaignId: campaign.id, donorId, amount, currency: 'GHS', isAnonymous: false, ...extra });
  return { owner, viewer, campaign, donate };
}
async function board(token?: string) {
  const read = request(app).get('/api/v1/leaderboard?limit=1');
  if (token) read.set('Authorization', `Bearer ${token}`);
  const response = await read.expect(200);
  expect(response.headers['cache-control']).toBe('private, no-store');
  return response.body.data;
}
it('excludes anonymous gifts and mixed currencies before named aggregation, keeping public guest totals separate', async () => {
  const f = await setup();
  await f.donate(f.owner.id, 50);
  await f.donate(f.owner.id, 9000, { isAnonymous: true });
  await f.donate(f.owner.id, 6000, { currency: 'USD' });
  await f.donate('guest', 20);
  const rows = await board();
  expect(rows).toEqual([expect.objectContaining({ userId: f.owner.id, totalDonated: 50, donationCount: 1, isAnonymous: false, currency: 'GHS' })]);
  const stats = await request(app).get('/api/v1/leaderboard/stats').expect(200);
  expect(stats.body.data).toEqual({ totalAmount: 70, totalDonations: 2, totalDonors: 1 });
});
it('honors leaderboard opt-out before ranking and featured limits without deleting gifts', async () => {
  const f = await setup();
  await f.donate(f.owner.id, 500); await f.donate(f.viewer.id, 100);
  await request(app).put('/api/v1/profile').set('Authorization', `Bearer ${f.owner.token}`).send({ showLeaderboards: false }).expect(200);
  expect((await board())[0]).toMatchObject({ userId: f.viewer.id, rank: 1 });
  const featured = await request(app).get('/api/v1/leaderboard/featured?limit=1').expect(200);
  expect(featured.body.data.topAllTime[0].userId).toBe(f.viewer.id);
  expect(featured.body.data.topThisMonth[0].userId).toBe(f.viewer.id);
  expect((await request(app).get('/api/v1/leaderboard/stats')).body.data.totalAmount).toBe(100);
  expect(await DonationModel.countDocuments({ donorId: f.owner.id })).toBe(1);
  await ProfileModel.updateOne({ userId: f.owner.id }, { $set: { showLeaderboards: true, publicProfile: false } });
  expect((await board())[0].userId).toBe(f.owner.id);
});
it('filters blocked, restricted, closed and admin identities consistently from rows and totals', async () => {
  const f = await setup(); await f.donate(f.owner.id, 500); await f.donate(f.viewer.id, 100);
  await request(app).put(`/api/v1/safety/blocks/${f.owner.id}`).set('Authorization', `Bearer ${f.viewer.token}`).expect(200);
  expect((await board(f.viewer.token))[0].userId).toBe(f.viewer.id);
  expect((await request(app).get('/api/v1/leaderboard/stats').set('Authorization', `Bearer ${f.viewer.token}`)).body.data.totalAmount).toBe(100);
  await ContentRestrictionModel.create({ userId: f.owner.id, restrictedBy: f.viewer.id, reason: 'Restricted leaderboard fixture' });
  expect((await board())[0].userId).toBe(f.viewer.id);
  await ContentRestrictionModel.deleteOne({ userId: f.owner.id });
  await UserModel.updateOne({ _id: f.owner.id }, { $set: { deletedAt: new Date() } });
  expect((await board())[0].userId).toBe(f.viewer.id);
  await UserModel.updateOne({ _id: f.viewer.id }, { $set: { role: 'admin' } });
  expect(await board()).toEqual([]);
  expect((await request(app).get('/api/v1/leaderboard/stats')).body.data.totalAmount).toBe(0);
});
it('does not expose donations to unpublished campaigns or anonymous-only donor identities', async () => {
  const f = await setup(); await f.donate(f.owner.id, 500, { isAnonymous: true });
  expect(await board()).toEqual([]);
  await f.donate(f.viewer.id, 200);
  await CampaignModel.updateOne({ _id: f.campaign.id }, { $set: { status: 'pending_review' } });
  expect(await board()).toEqual([]);
  expect((await request(app).get('/api/v1/leaderboard/stats')).body.data.totalAmount).toBe(0);
  expect((await CampaignModel.findById(f.campaign.id))?.raisedAmount).toBe(8000);
});
