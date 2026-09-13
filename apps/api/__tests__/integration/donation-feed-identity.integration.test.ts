import { createReviewedDonation } from '../helpers/reviewedDonation.js';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { DonationModel } from '../../src/infrastructure/database/models/DonationModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function account() {
  const response = await request(app).post('/api/v1/auth/register').send({ email: `${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Donor identity fixture', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { id: response.body.data.user.id as string, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
async function fixture() {
  const owner = await account(), viewer = await account();
  const campaign = await CampaignModel.create({ title: 'Donation feed fixture', description: 'Public campaign', goalAmount: 1000, raisedAmount: 100, currency: 'GHS', category: 'education', status: 'active', creatorId: viewer.id, startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
  const donation = await createReviewedDonation({ donorName: 'Donor identity fixture', campaignId: campaign.id, donorId: owner.id, amount: 100, currency: 'GHS', isAnonymous: false, message: 'A public message from this donor' });
  return { owner, viewer, campaign, donation };
}
async function feeds(f: Awaited<ReturnType<typeof fixture>>, auth?: string) {
  const recent = request(app).get('/api/v1/donations');
  const campaign = request(app).get(`/api/v1/campaigns/${f.campaign.id}/donations`);
  if (auth) { recent.set('Authorization', auth); campaign.set('Authorization', auth); }
  const responses = await Promise.all([recent.expect(200), campaign.expect(200)]);
  for (const response of responses) expect(response.headers['cache-control']).toBe('private, no-store');
  return { recent: responses[0].body.data.find((item: { id: string }) => item.id === f.donation.id), campaign: responses[1].body.data };
}
it('does not disclose an anonymous donor account ID in recent or campaign feeds', async () => {
  const f = await fixture();
  await DonationModel.updateOne({ _id: f.donation.id }, { $set: { isAnonymous: true } });
  const result = await feeds(f);
  expect(result.recent).not.toHaveProperty('donorId');
  expect(result.recent).not.toHaveProperty('donorName');
  expect(result.campaign.items[0]).toMatchObject({ donorName: 'Anonymous', amount: 100, isAnonymous: true });
  expect(result.campaign.items[0]).not.toHaveProperty('donorId');
  expect(result.campaign.total).toBe(1);
});
it('redacts blocked donor identity and messages without changing financial rows or guest views', async () => {
  const f = await fixture();
  await request(app).put(`/api/v1/safety/blocks/${f.owner.id}`).set('Authorization', f.viewer.auth).expect(200);
  const hidden = await feeds(f, f.viewer.auth);
  expect(hidden.recent).not.toHaveProperty('donorId');
  expect(hidden.recent).not.toHaveProperty('donorName');
  expect(hidden.campaign.items[0]).toMatchObject({ donorName: 'Anonymous', isAnonymous: true, amount: 100 });
  expect(hidden.campaign.items[0]).not.toHaveProperty('message');
  expect(hidden.campaign.total).toBe(1);
  expect((await feeds(f)).recent).toMatchObject({ donorId: f.owner.id, donorName: 'Donor identity fixture' });
  expect((await DonationModel.findById(f.donation.id))?.message).toBe(f.donation.message);
});
it('suppresses restricted and closed donor identities while preserving owner history and campaign balances', async () => {
  const f = await fixture();
  await ContentRestrictionModel.create({ userId: f.owner.id, restrictedBy: f.viewer.id, reason: 'Donation identity moderation fixture' });
  const restricted = await feeds(f);
  expect(restricted.recent).not.toHaveProperty('donorId');
  expect(restricted.campaign.items[0]).not.toHaveProperty('message');
  await request(app).get(`/api/v1/donations/${f.donation.id}`).set('Authorization', f.owner.auth).expect(200);
  expect((await CampaignModel.findById(f.campaign.id))?.raisedAmount).toBe(100);
  await ContentRestrictionModel.deleteOne({ userId: f.owner.id });
  expect((await feeds(f)).recent.donorId).toBe(f.owner.id);
  await UserModel.updateOne({ _id: f.owner.id }, { $set: { deletedAt: new Date() } });
  expect((await feeds(f)).recent).not.toHaveProperty('donorId');
  expect(await DonationModel.exists({ _id: f.donation.id })).toBeTruthy();
});
