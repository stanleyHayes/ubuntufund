import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { DonationModel } from '../../src/infrastructure/database/models/DonationModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { LiveSessionModel } from '../../src/infrastructure/database/models/LiveSessionModel.js';
let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
beforeEach(async () => { await CampaignModel.deleteMany({}); });
async function account() {
  const response = await request(app).post('/api/v1/auth/register').send({ name: 'Campaign reader', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { id: response.body.data.user.id, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
async function fixture() {
  const owner = await account(), reader = await account(), admin = await account();
  await UserModel.findByIdAndUpdate(owner.id, { role: 'organization', organizationName: 'Campaign privacy organization' });
  await UserModel.findByIdAndUpdate(admin.id, { role: 'admin' });
  const campaigns = await Promise.all(['draft', 'pending_review', 'blocked', 'active', 'funded', 'expired'].map(status => CampaignModel.create({ slug: `${status}-${randomUUID()}`, title: `${status} campaign`, description: `${status} description`, goalAmount: 100, raisedAmount: 10, currency: 'GHS', category: 'education', creatorId: owner.id, status, imageUrls: [`https://media.example.test/${status}.jpg`], startDate: new Date(), endDate: new Date(Date.now() + 86400000) })));
  return { owner, reader, admin, campaigns };
}
it('returns nonpublic detail only to the current owner or administrator and never exposes it through share previews', async () => {
  const f = await fixture();
  for (const campaign of f.campaigns.slice(0, 3)) {
    const path = `/api/v1/campaigns/${campaign.id}`;
    const denied = await request(app).get(path).expect(404);
    expect(denied.headers['cache-control']).toBe('private, no-store');
    expect(JSON.stringify(denied.body)).not.toContain(campaign.description);
    await request(app).get(path).set('Authorization', f.reader.auth).expect(404);
    expect((await request(app).get(path).set('Authorization', f.owner.auth).expect(200)).body.data.description).toBe(campaign.description);
    await request(app).get(path).set('Authorization', f.admin.auth).expect(200);
    for (const child of ['donations', 'collaborators', 'comments', 'updates']) {
      await request(app).get(`${path}/${child}`).expect(404);
      await request(app).get(`${path}/${child}`).set('Authorization', f.reader.auth).expect(404);
      await request(app).get(`${path}/${child}`).set('Authorization', f.owner.auth).expect(200);
      await request(app).get(`${path}/${child}`).set('Authorization', f.admin.auth).expect(200);
    }
    await request(app).get(`${path}/events`).expect(404);
    const live = await LiveSessionModel.create({ campaignId: campaign.id, title: 'Private broadcast', overlayToken: randomUUID() });
    await request(app).get(`${path}/active-live`).expect(404);
    for (const child of ['public', 'overlay', 'overlay/view', 'events']) {
      await request(app).get(`/api/v1/live-sessions/${live.id}/${child}`).query({ token: live.overlayToken }).expect(404);
    }
    await request(app).post(`/api/v1/live-sessions/${live.id}/video/viewer-token`).expect(404);
    for (const slug of [campaign.slug, campaign.id]) {
      await request(app).get(`/api/v1/campaigns/slug/${slug}/public`).expect(404);
      await request(app).get(`/api/v1/campaigns/slug/${slug}/public`).set('Authorization', f.owner.auth).expect(404);
    }
  }
  for (const campaign of f.campaigns.slice(3)) {
    await request(app).get(`/api/v1/campaigns/${campaign.id}`).expect(200);
    await request(app).get(`/api/v1/campaigns/slug/${campaign.slug}/public`).expect(200);
  }
  await UserModel.findByIdAndUpdate(f.admin.id, { role: 'user' });
  await request(app).get(`/api/v1/campaigns/${f.campaigns[0].id}`).set('Authorization', f.admin.auth).expect(404);
});
it('filters before public pagination/counts, ignores spoofed visibility flags and preserves staff and owner queues', async () => {
  const f = await fixture();
  const first = await request(app).get('/api/v1/campaigns?pageSize=2&page=1&includeNonPublic=true&status=draft').expect(200);
  expect(first.body.data).toMatchObject({ total: 3, totalPages: 2 });
  expect(first.body.data.items).toHaveLength(2);
  const second = await request(app).get('/api/v1/campaigns?pageSize=2&page=2').set('Authorization', f.reader.auth).expect(200);
  expect(second.body.data.items).toHaveLength(1);
  const ids = [...first.body.data.items, ...second.body.data.items].map((row: { id: string }) => row.id).sort();
  expect(ids).toEqual(f.campaigns.slice(3).map(row => row.id).sort());
  const staff = await request(app).get('/api/v1/campaigns?pageSize=20').set('Authorization', f.admin.auth).expect(200);
  expect(staff.headers['cache-control']).toBe('private, no-store');
  expect(staff.body.data.total).toBe(6);
  const mine = await request(app).get('/api/v1/campaigns/mine').set('Authorization', f.owner.auth).expect(200);
  expect(mine.body.data).toHaveLength(6);
});
it('removes newly blocked content from public detail, share cards and organization projections without changing finances', async () => {
  const f = await fixture();
  const active = f.campaigns[3];
  const live = await LiveSessionModel.create({ campaignId: active.id, overlayToken: randomUUID() });
  const livePath = `/api/v1/live-sessions/${live.id}`;
  const sheet = await request(app).get(`${livePath}/public`).expect(200);
  expect(sheet.headers['cache-control']).toBe('private, no-store');
  await request(app).get(`/api/v1/campaigns/${active.id}/active-live`).expect(200);
  const org = `/api/v1/organizations/${f.owner.id}`;
  expect((await request(app).get(`${org}/campaigns`).expect(200)).body.data).toHaveLength(3);
  const summary = await request(app).get(org).expect(200);
  expect(summary.body.data).toMatchObject({ campaignCount: 3, totalRaised: 30 });
  await CampaignModel.findByIdAndUpdate(active.id, { status: 'blocked' });
  await request(app).get(`${livePath}/public`).expect(404);
  await request(app).get(`${livePath}/overlay`).query({ token: live.overlayToken }).expect(404);
  await request(app).get(`/api/v1/campaigns/${active.id}/active-live`).expect(404);
  await request(app).get(`/api/v1/campaigns/${active.id}`).expect(404);
  await request(app).get(`/api/v1/campaigns/slug/${active.slug}/public`).expect(404);
  expect((await request(app).get(`${org}/campaigns`).expect(200)).body.data).toHaveLength(2);
  expect((await request(app).get(org).expect(200)).body.data).toMatchObject({ campaignCount: 2, totalRaised: 20 });
  expect((await CampaignModel.findById(active.id))?.raisedAmount).toBe(10);
  expect((await CampaignModel.findById(active.id))?.description).toBe(active.description);
  await CampaignModel.findByIdAndUpdate(active.id, { deletedAt: new Date() });
  await request(app).get(`/api/v1/campaigns/${active.id}`).set('Authorization', f.owner.auth).expect(404);
  await request(app).get(`/api/v1/campaigns/${active.id}`).set('Authorization', f.admin.auth).expect(404);
});

it('excludes nonpublic campaign metadata from the public recent-donation feed', async () => {
  const f = await fixture();
  await Promise.all(f.campaigns.map(campaign => DonationModel.create({ campaignId: campaign.id, donorId: f.reader.id, amount: 10, currency: 'GHS', paymentMethod: 'wallet', isAnonymous: true })));
  const recent = await request(app).get('/api/v1/donations').expect(200);
  const ids = recent.body.data.map((row: { campaignId: string }) => row.campaignId);
  expect(ids.sort()).toEqual(f.campaigns.slice(3).map(row => row.id).sort());
  expect(await DonationModel.countDocuments({ campaignId: { $in: f.campaigns.map(row => row.id) } })).toBe(6);
});
