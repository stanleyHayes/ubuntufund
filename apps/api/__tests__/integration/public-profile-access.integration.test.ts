import { KYCVerificationModel } from '../../src/infrastructure/database/models/KYCVerificationModel.js';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { ProfileModel } from '../../src/infrastructure/database/models/ProfileModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';

let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function register() {
  const response = await request(app).post('/api/v1/auth/register').send({
    legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
    email: `profile-access-${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Public member',
  }).expect(201);
  return { id: response.body.data.user.id as string, token: response.body.data.tokens.accessToken as string };
}

it('honors blocks in both directions and restores access only after both blocks are removed', async () => {
  const first = await register(); const second = await register();
  const read = (target: string, token: string) => request(app).get(`/api/v1/users/${target}/public`).set('Authorization', `Bearer ${token}`);
  await read(second.id, first.token).expect(200);
  await request(app).put(`/api/v1/safety/blocks/${second.id}`).set('Authorization', `Bearer ${first.token}`).expect(200);
  const denied = await read(second.id, first.token).expect(404);
  expect(denied.headers['cache-control']).toBe('private, no-store');
  expect(denied.body.data).toBeUndefined();
  await read(first.id, second.token).expect(404);
  await request(app).get(`/api/v1/users/${second.id}/public`).expect(200);
  await request(app).put(`/api/v1/safety/blocks/${first.id}`).set('Authorization', `Bearer ${second.token}`).expect(200);
  await request(app).delete(`/api/v1/safety/blocks/${second.id}`).set('Authorization', `Bearer ${first.token}`).expect(200);
  await read(second.id, first.token).expect(404);
  await request(app).delete(`/api/v1/safety/blocks/${first.id}`).set('Authorization', `Bearer ${second.token}`).expect(200);
  await read(second.id, first.token).expect(200);
});

it('preserves privacy for guests and authenticated readers without disclosing contact data', async () => {
  const owner = await register(); const viewer = await register();
  const url = `/api/v1/users/${owner.id}/public`;
  await ProfileModel.updateOne({ userId: owner.id }, { $set: { publicProfile: false, bio: 'Private biography', phone: '0240000000' } }, { upsert: true });
  const denied = await request(app).get(url).expect(404);
  expect(denied.headers['cache-control']).toBe('private, no-store');
  await request(app).get(url).set('Authorization', `Bearer ${viewer.token}`).expect(404);
  await ProfileModel.updateOne({ userId: owner.id }, { $set: { publicProfile: true } });
  const visible = await request(app).get(url).expect(200);
  expect(visible.headers['cache-control']).toBe('private, no-store');
  expect(visible.body.data).not.toHaveProperty('email');
  expect(visible.body.data).not.toHaveProperty('phone');
  expect(visible.body.data).not.toHaveProperty('bio');
});

it('returns a noncacheable 404 for closed accounts and malformed identifiers', async () => {
  const owner = await register();
  await UserModel.updateOne({ _id: owner.id }, { $set: { deletedAt: new Date() } });
  for (const id of [owner.id, 'not-an-object-id']) {
    const response = await request(app).get(`/api/v1/users/${id}/public`).expect(404);
    expect(response.headers['cache-control']).toBe('private, no-store');
  }
});


it('projects current verification for public badges while preserving historical levels and private reviews', async () => {
  const owner = await register();
  await UserModel.updateOne({ _id: owner.id }, { $set: { verificationLevel: 3 } });
  const url = `/api/v1/users/${owner.id}/public`;
  async function assertLevel(level: number) {
    const response = await request(app).get(url).expect(200);
    expect(response.body.data.verificationLevel).toBe(level);
    expect(response.body.data).not.toHaveProperty('documents');
    expect(JSON.stringify(response.body)).not.toContain('Private identity review');
    expect(response.headers['cache-control']).toBe('private, no-store');
  }
  await assertLevel(1);
  const identity = await KYCVerificationModel.create({ userId: owner.id, verificationType: 'identity', status: 'approved', documents: [], riskLevel: 'low', reviewNotes: 'Private identity review', expiryDate: new Date(Date.now() + 86400000), createdAt: new Date(Date.now() - 60000) });
  await assertLevel(2);
  await KYCVerificationModel.updateOne({ _id: identity.id }, { $set: { expiryDate: new Date(Date.now() - 1000) } });
  await assertLevel(1);
  await KYCVerificationModel.updateOne({ _id: identity.id }, { $set: { expiryDate: new Date(Date.now() + 86400000) } });
  const renewal = await KYCVerificationModel.create({ userId: owner.id, verificationType: 'identity', status: 'pending', documents: [], riskLevel: 'low' });
  await assertLevel(1);
  await KYCVerificationModel.updateOne({ _id: renewal.id }, { $set: { status: 'approved', expiryDate: new Date(Date.now() + 86400000) } });
  await assertLevel(2);
  await KYCVerificationModel.create({ userId: owner.id, verificationType: 'business', status: 'approved', documents: [], riskLevel: 'low', expiryDate: new Date(Date.now() + 86400000) });
  await assertLevel(2);
  await UserModel.updateOne({ _id: owner.id }, { $set: { role: 'organization' } });
  await assertLevel(3);
  expect((await UserModel.findById(owner.id))?.verificationLevel).toBe(3);
});
