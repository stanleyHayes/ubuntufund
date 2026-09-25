import { KYCVerificationModel } from '../../src/infrastructure/database/models/KYCVerificationModel.js';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { ProfileModel } from '../../src/infrastructure/database/models/ProfileModel.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { deriveOrganizationSlug } from '../../src/domain/entities/Organization.js';

let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function register(organization = true) {
  const name = `Organization ${randomUUID()}`;
  const email = `org-access-${randomUUID()}@example.com`;
  const result = await request(app).post('/api/v1/auth/register').send({
    legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
    email, password: 'SecurePass123', name: 'Private login owner',
    ...(organization ? { role: 'organization', organizationName: name, organizationType: 'ngo' } : {}),
  }).expect(201);
  return { id: result.body.data.user.id as string, token: result.body.data.tokens.accessToken as string, name, email };
}
async function assertHidden(owner: Awaited<ReturnType<typeof register>>, token?: string) {
  for (const path of [`/organizations/${owner.id}`, `/organizations/${deriveOrganizationSlug(owner.name)}`, `/organizations/${owner.id}/campaigns`, `/users/${owner.id}/public`]) {
    const read = request(app).get(`/api/v1${path}`);
    if (token) read.set('Authorization', `Bearer ${token}`);
    const response = await read.expect(404);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(JSON.stringify(response.body)).not.toContain(owner.email);
  }
  const read = request(app).get('/api/v1/organizations');
  if (token) read.set('Authorization', `Bearer ${token}`);
  const response = await read.expect(200);
  expect(response.body.data.some((item: { id: string }) => item.id === owner.id)).toBe(false);
}

it('returns public organization identity without the login email or registration details', async () => {
  const owner = await register();
  for (const path of ['/organizations', `/organizations/${owner.id}`]) {
    const response = await request(app).get(`/api/v1${path}`).expect(200);
    expect(JSON.stringify(response.body)).not.toContain(owner.email);
    const item = Array.isArray(response.body.data) ? response.body.data.find((item: { id: string }) => item.id === owner.id) : response.body.data;
    expect(item).toMatchObject({ id: owner.id, name: owner.name });
    expect(item).not.toHaveProperty('email');
    expect(item).not.toHaveProperty('registrationNumber');
  }
});

it('applies privacy to lists, slug/id details, campaigns and member profiles without denying owner settings', async () => {
  const owner = await register();
  await request(app).put('/api/v1/profile').set('Authorization', `Bearer ${owner.token}`).send({ publicProfile: false }).expect(200);
  await assertHidden(owner);
  await assertHidden(owner, owner.token);
  await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${owner.token}`).expect(200);
  await ProfileModel.updateOne({ userId: owner.id }, { $set: { publicProfile: true } });
  await request(app).get(`/api/v1/organizations/${owner.id}`).expect(200);
});

it('enforces viewer blocks across all organization reads while retaining guest discovery', async () => {
  const owner = await register(); const viewer = await register(false);
  await request(app).put(`/api/v1/safety/blocks/${viewer.id}`).set('Authorization', `Bearer ${owner.token}`).expect(200);
  await assertHidden(owner, viewer.token);
  await request(app).get(`/api/v1/organizations/${owner.id}`).expect(200);
  await request(app).delete(`/api/v1/safety/blocks/${viewer.id}`).set('Authorization', `Bearer ${owner.token}`).expect(200);
  await request(app).get(`/api/v1/organizations/${owner.id}`).set('Authorization', `Bearer ${viewer.token}`).expect(200);
});

it('hides restricted identity until restriction removal and leaves the account intact', async () => {
  const owner = await register();
  const before = await UserModel.findById(owner.id).lean();
  await ContentRestrictionModel.create({ userId: owner.id, restrictedBy: owner.id, reason: 'Moderation fixture restricting public identity' });
  await assertHidden(owner);
  await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${owner.token}`).expect(200);
  expect(await UserModel.findById(owner.id).lean()).toEqual(before);
  await ContentRestrictionModel.deleteOne({ userId: owner.id });
  await request(app).get(`/api/v1/organizations/${owner.id}`).expect(200);
  await request(app).get(`/api/v1/users/${owner.id}/public`).expect(200);
  await UserModel.updateOne({ _id: owner.id }, { $set: { deletedAt: new Date() } });
  await assertHidden(owner);
});


it('shows verification only for the latest approved unexpired business review without exposing evidence', async () => {
  const owner = await register();
  await UserModel.updateOne({ _id: owner.id }, { $set: { verificationLevel: 3 } });
  async function assertBadge(verified: boolean) {
    for (const path of ['/organizations', `/organizations/${owner.id}`, `/organizations/${deriveOrganizationSlug(owner.name)}`]) {
      const response = await request(app).get(`/api/v1${path}`).expect(200);
      const item = Array.isArray(response.body.data) ? response.body.data.find((item: { id: string }) => item.id === owner.id) : response.body.data;
      expect(item.verified).toBe(verified);
      expect(JSON.stringify(response.body)).not.toContain('Private review evidence');
      expect(item).not.toHaveProperty('documents');
      expect(item).not.toHaveProperty('businessInfo');
    }
  }
  await assertBadge(false);
  const review = await KYCVerificationModel.create({ userId: owner.id, verificationType: 'business', status: 'approved', documents: [], riskLevel: 'low', reviewNotes: 'Private review evidence', expiryDate: new Date(Date.now() + 86400000), createdAt: new Date(Date.now() - 60000) });
  await assertBadge(true);
  await KYCVerificationModel.updateOne({ _id: review.id }, { $set: { expiryDate: new Date(Date.now() - 1000) } });
  await assertBadge(false);
  await KYCVerificationModel.updateOne({ _id: review.id }, { $unset: { expiryDate: 1 } });
  await assertBadge(false);
  await KYCVerificationModel.updateOne({ _id: review.id }, { $set: { expiryDate: new Date(Date.now() + 86400000) } });
  const renewal = await KYCVerificationModel.create({ userId: owner.id, verificationType: 'business', status: 'pending', documents: [], riskLevel: 'low' });
  await assertBadge(false);
  await KYCVerificationModel.updateOne({ _id: renewal.id }, { $set: { status: 'rejected' } });
  await assertBadge(false);
  await KYCVerificationModel.updateOne({ _id: renewal.id }, { $set: { status: 'approved', expiryDate: new Date(Date.now() + 86400000) } });
  await assertBadge(true);
  expect((await UserModel.findById(owner.id))?.verificationLevel).toBe(3);
});

it('totals every public campaign in one currency on the server and resolves a shared slug to the oldest organization', async () => {
  const { CampaignModel } = await import('../../src/infrastructure/database/models/CampaignModel.js');
  const owner = await register();
  const base = { description: 'Organization campaign', goalAmount: 1000, category: 'community', creatorId: owner.id, startDate: new Date(), endDate: new Date(Date.now() + 86400000) };
  await CampaignModel.create([
    { ...base, title: 'Cedi campaign one', currency: 'GHS', raisedAmount: 300, status: 'active' },
    { ...base, title: 'Cedi campaign two', currency: 'GHS', raisedAmount: 200, status: 'expired' },
    // A legacy foreign-currency amount must not be added to cedis.
    { ...base, title: 'Legacy dollar campaign', currency: 'USD', raisedAmount: 999, status: 'funded' },
    { ...base, title: 'Held campaign', currency: 'GHS', raisedAmount: 5000, status: 'pending_review' },
  ]);
  const list = await request(app).get('/api/v1/organizations').expect(200);
  expect(list.body.data.find((item: { id: string }) => item.id === owner.id)).toMatchObject({ campaignCount: 3, totalRaised: 500, currency: 'GHS' });
  const detail = await request(app).get(`/api/v1/organizations/${owner.id}`).expect(200);
  expect(detail.body.data).toMatchObject({ campaignCount: 3, totalRaised: 500, currency: 'GHS' });

  // A newer organization registering the same name does not take over the slug URL.
  const newer = await register();
  await UserModel.updateOne({ _id: newer.id }, { $set: { organizationName: owner.name } });
  const bySlug = await request(app).get(`/api/v1/organizations/${deriveOrganizationSlug(owner.name)}`).expect(200);
  expect(bySlug.body.data.id).toBe(owner.id);
});
