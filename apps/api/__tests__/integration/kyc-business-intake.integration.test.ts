import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { KYCVerificationModel } from '../../src/infrastructure/database/models/KYCVerificationModel.js';
import { PrivateKycDocumentModel } from '../../src/infrastructure/database/models/PrivateKycDocumentModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function account(role = 'organization') {
  const res = await request(app).post('/api/v1/auth/register').send({ name: 'Organization fixture', email: `${randomUUID()}@example.com`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const id = res.body.data.user.id;
  await UserModel.updateOne({ _id: id }, { $set: { role } });
  return { id, auth: `Bearer ${res.body.data.tokens.accessToken}` };
}
async function application(userId: string) {
  const documents = await Promise.all(['business_registration', 'authorization_letter', 'id_card'].map(async type => {
    const doc = await PrivateKycDocumentModel.create({ userId, publicId: `business-${randomUUID()}`, resourceType: 'image', format: 'png', mimeType: 'image/png' });
    return { type, url: `kyc://${doc.id}` };
  }));
  return {
    personalInfo: { fullName: 'Representative fixture', dateOfBirth: '1990-01-01T00:00:00.000Z', nationality: 'Ghana', idNumber: 'SYNTHETIC-ID' },
    businessInfo: { businessName: 'Synthetic organization', registrationNumber: 'SYNTHETIC-REG', businessType: 'Charity', registeredAddress: { street: 'Synthetic street', city: 'Accra', country: 'Ghana' }, representativeCapacity: 'Authorized director', controlPersons: [{ fullName: 'Controller fixture', role: 'trustee', country: 'Ghana' }], ownershipExplanation: 'The organization is controlled by its declared trustees.' },
    documents, declaration: { authorized: true, accurate: true },
  };
}
it('persists one concurrent application and exposes evidence only to authorized staff', async () => {
  const owner = await account(), staff = await account('admin'), stranger = await account();
  const input = await application(owner.id);
  const submit = () => request(app).post('/api/v1/kyc/business').set('Authorization', owner.auth).send(input);
  const results = await Promise.all([submit(), submit()]);
  expect(results.map(r => r.status).sort()).toEqual([201, 409]);
  const response = results.find(r => r.status === 201)!;
  expect(response.headers['cache-control']).toBe('private, no-store');
  expect(response.body.data).toEqual({ id: expect.any(String), status: 'pending', verificationType: 'business' });
  const row = (await KYCVerificationModel.findById(response.body.data.id))!;
  expect(row.businessInfo?.controlPersons?.[0].fullName).toBe('Controller fixture');
  expect(row.businessInfo?.declaration?.acceptedAt).toBeInstanceOf(Date);
  expect(await AuditLogModel.countDocuments({ resource: row.id, action: 'kyc.business_submitted' })).toBe(1);
  const queue = await request(app).get('/api/v1/kyc/pending').set('Authorization', staff.auth).expect(200);
  expect(JSON.stringify(queue.body)).toContain('Controller fixture');
  await request(app).get('/api/v1/kyc/pending').set('Authorization', stranger.auth).expect(403);
  const status = await request(app).get('/api/v1/kyc/status').set('Authorization', stranger.auth).expect(200);
  expect(JSON.stringify(status.body)).not.toContain('Controller fixture');
});
it('requires organization role, complete declarations, adult representative and required document types', async () => {
  const owner = await account(), individual = await account('user');
  const input = await application(owner.id);
  const submit = (body: unknown, auth = owner.auth) => request(app).post('/api/v1/kyc/business').set('Authorization', auth).send(body);
  await submit(input, individual.auth).expect(403);
  await submit({ ...input, declaration: { authorized: false, accurate: true } }).expect(400);
  await submit({ ...input, businessInfo: { ...input.businessInfo, controlPersons: [] } }).expect(400);
  await submit({ ...input, personalInfo: { ...input.personalInfo, dateOfBirth: '2020-01-01T00:00:00.000Z' } }).expect(422);
  await submit({ ...input, documents: input.documents.map(doc => ({ ...doc, type: 'selfie' })) }).expect(422);
  expect(await KYCVerificationModel.countDocuments({ userId: owner.id })).toBe(0);
});
it('rejects foreign and withdrawn files and rolls back all writes when audit storage fails', async () => {
  const owner = await account(), stranger = await account();
  const input = await application(owner.id), foreign = await application(stranger.id);
  const submit = (body = input) => request(app).post('/api/v1/kyc/business').set('Authorization', owner.auth).send(body);
  await submit({ ...input, documents: foreign.documents }).expect(422);
  const docId = input.documents[0].url.slice(6);
  await PrivateKycDocumentModel.updateOne({ _id: docId }, { $set: { deletedAt: new Date() } });
  await submit().expect(422);
  await PrivateKycDocumentModel.updateOne({ _id: docId }, { $unset: { deletedAt: 1 } });
  const spy = vi.spyOn(AuditLogModel, 'create').mockRejectedValueOnce(new Error('audit unavailable'));
  try { await submit().expect(500); } finally { spy.mockRestore(); }
  expect(await KYCVerificationModel.countDocuments({ userId: owner.id })).toBe(0);
  expect((await PrivateKycDocumentModel.findById(docId))!.reviewWriteVersion).toBe(0);
  await submit().expect(201);
});
