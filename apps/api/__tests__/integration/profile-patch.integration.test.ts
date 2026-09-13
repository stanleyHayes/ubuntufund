import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { ProfileModel } from '../../src/infrastructure/database/models/ProfileModel.js';
import { MongoUserRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoUserRepository.js';
import { MongoAccountProfileWrite } from '../../src/infrastructure/adapters/outbound/persistence/MongoAccountProfileWrite.js';
import { MongoUnitOfWork } from '../../src/infrastructure/adapters/outbound/persistence/MongoUnitOfWork.js';
let app: Express;
beforeAll(async () => { await connectTestDatabase(); await ProfileModel.init(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function account() {
  const response = await request(app).post('/api/v1/auth/register').send({ name: 'Original name', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { id: response.body.data.user.id as string, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
const patch = (owner: Awaited<ReturnType<typeof account>>, body: object) => request(app).put('/api/v1/profile').set('Authorization', owner.auth).send(body);
it('preserves concurrent privacy, contact, appearance and notification patches on first save', async () => {
  const owner = await account();
  const changes = [{ publicProfile: false }, { phone: '0551234567' }, { language: 'French' }, { darkMode: true }, { notificationPreferences: { email: false } }, { notificationPreferences: { donationReceipts: false } }];
  const results = await Promise.all(changes.map(body => patch(owner, body)));
  expect(results.map(result => result.status)).toEqual(changes.map(() => 200));
  const saved = (await request(app).get('/api/v1/profile').set('Authorization', owner.auth).expect(200)).body.data;
  expect(saved).toMatchObject({ publicProfile: false, phone: '0551234567', language: 'French', darkMode: true, notificationPreferences: { email: false, donationReceipts: false, marketingEmails: false } });
  expect(await ProfileModel.countDocuments({ userId: owner.id })).toBe(1);
});
it('keeps omitted values and explicit empty strings without restoring a public profile', async () => {
  const owner = await account();
  await patch(owner, { publicProfile: false, phone: '0551234567', bio: 'Private account biography', avatarUrl: 'https://example.test/avatar.png', coverUrl: 'https://example.test/cover.png', name: 'Updated name' }).expect(200);
  await patch(owner, { phone: '', coverUrl: '' }).expect(200);
  const saved = (await request(app).get('/api/v1/profile').set('Authorization', owner.auth).expect(200)).body.data;
  expect(saved).toMatchObject({ name: 'Updated name', publicProfile: false, phone: '', bio: 'Private account biography', avatarUrl: 'https://example.test/avatar.png', coverUrl: '' });
  await request(app).get(`/api/v1/users/${owner.id}/public`).expect(404);
});
it('does not let stale general account saves undo identity patches', async () => {
  const owner = await account(), repo = new MongoUserRepository();
  const stale = await repo.findById(owner.id);
  const identity = { name: 'Current name', country: 'Ghana', avatarUrl: 'https://example.test/new.png', coverUrl: 'https://example.test/new-cover.png' };
  await patch(owner, identity).expect(200);
  await repo.update(stale!);
  expect(await UserModel.findById(owner.id)).toMatchObject(identity);
});
it('rolls back account identity changes when profile persistence fails', async () => {
  const owner = await account();
  const write = vi.spyOn(ProfileModel, 'findOneAndUpdate').mockRejectedValueOnce(new Error('Fixture profile write failure'));
  try { await patch(owner, { name: 'Must roll back', phone: '0551234567' }).expect(500); } finally { write.mockRestore(); }
  expect((await UserModel.findById(owner.id))?.name).toBe('Original name');
  expect((await UserModel.findById(owner.id))?.profileWriteVersion).toBeUndefined();
  expect(await ProfileModel.countDocuments({ userId: owner.id })).toBe(0);
});
it('rejects already-authorized writes after credentials change or the account closes', async () => {
  const owner = await account(), writer = new MongoAccountProfileWrite(new MongoUnitOfWork());
  await UserModel.findByIdAndUpdate(owner.id, { authVersion: 'rotated-fixture' });
  await expect(writer.write(owner.id, { publicProfile: true }, '')).rejects.toMatchObject({ statusCode: 401 });
  await UserModel.findByIdAndUpdate(owner.id, { deletedAt: new Date() });
  await expect(writer.write(owner.id, { publicProfile: true }, 'rotated-fixture')).rejects.toMatchObject({ statusCode: 401 });
  expect(await ProfileModel.countDocuments({ userId: owner.id })).toBe(0);
});
it('does not change staff role, verification or agreement through a profile patch', async () => {
  const owner = await account();
  await UserModel.findByIdAndUpdate(owner.id, { verificationLevel: 3, emailVerified: true });
  await patch(owner, { name: 'Safe identity patch', verificationLevel: 0, role: 'admin', emailVerified: false, legalAcceptance: null }).expect(200);
  const saved = await UserModel.findById(owner.id);
  expect(saved).toMatchObject({ role: 'user', verificationLevel: 3, emailVerified: true });
  expect(saved?.legalAcceptance?.version).toBe('2026-09-12');
});
