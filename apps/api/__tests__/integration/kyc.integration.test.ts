import { reviewVersion } from '../helpers/kycReviewVersion.js';
import { PrivateKycDocumentModel } from '../../src/infrastructure/database/models/PrivateKycDocumentModel.js';
import { randomUUID } from 'node:crypto';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { KYCVerificationModel } from '../../src/infrastructure/database/models/KYCVerificationModel.js';
import { CampaignCategory, CampaignPriority } from '@ubuntu-fund/types';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

async function registerUser(app: Express, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email, password: 'SecurePass123', name: 'KYC Test User' })
    .expect(201);

  return { userId: res.body.data.user.id as string, token: res.body.data.tokens.accessToken as string };
}

async function createAdmin(app: Express, email: string) {
  const { userId } = await registerUser(app, email);
  await UserModel.findByIdAndUpdate(userId, { role: 'admin' });

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'SecurePass123' })
    .expect(200);

  return { userId, token: loginRes.body.data.tokens.accessToken as string };
}

describe('KYC Integration', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  it('submits identity verification, an admin approves it, and the user is unblocked to create campaigns', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('kycuser'));

    const document = await PrivateKycDocumentModel.create({ userId, publicId: 'private/test', resourceType: 'image', format: 'jpg', mimeType: 'image/jpeg' });
    const submitRes = await request(app)
      .post('/api/v1/kyc/identity')
      .set('Authorization', `Bearer ${token}`)
      .send({
        personalInfo: { fullName: 'Efua Asante', nationality: 'Ghanaian', dateOfBirth: '1995-01-01T00:00:00.000Z' },
        documents: [{ type: 'passport', url: `kyc://${document.id}` }],
      });

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.data.status).toBe('pending');
    const kycId = submitRes.body.data.id as string;

    const statusRes = await request(app)
      .get('/api/v1/kyc/status')
      .set('Authorization', `Bearer ${token}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.kycStatus).toBe('pending');
    expect(statusRes.body.data.verifications).toHaveLength(1);

    // A non-admin cannot approve.
    const rejectedApproval = await request(app)
      .put(`/api/v1/kyc/${kycId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(rejectedApproval.status).toBe(403);

    const { token: adminToken } = await createAdmin(app, uniqueEmail('kycadmin'));

    const approveRes = await request(app)
      .put(`/api/v1/kyc/${kycId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewVersion: await reviewVersion(kycId), evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('approved');

    const statusAfterApproval = await request(app)
      .get('/api/v1/kyc/status')
      .set('Authorization', `Bearer ${token}`);
    expect(statusAfterApproval.body.data.kycStatus).toBe('verified');

    const storedUser = await UserModel.findById(userId);
    expect(storedUser?.verificationLevel).toBe(2); // NATIONAL_ID

    // Proof the verificationLevel bump actually unblocks campaign creation.
    const createCampaignRes = await request(app)
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Campaign After KYC',
        description: 'Created once KYC-approved',
        goalAmount: 1000,
        currency: 'GHS',
        category: CampaignCategory.EDUCATION,
        priority: CampaignPriority.NORMAL,
        beneficiaries: [],
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

    expect(createCampaignRes.status).toBe(201);
  });

  it('rejects a supplied underage birth date before creating an identity record', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('underage-identity'));
    const birth = new Date();
    birth.setUTCFullYear(birth.getUTCFullYear() - 17);
    const response = await request(app).post('/api/v1/kyc/identity')
      .set('Authorization', `Bearer ${token}`).send({ personalInfo: { dateOfBirth: birth.toISOString() } }).expect(422);
    expect(response.body.message).toMatch(/at least 18/);
    expect(await KYCVerificationModel.countDocuments({ userId })).toBe(0);
  });

  it('blocks legacy identity approval with a missing or underage birth date without changing verification', async () => {
    const admin = await createAdmin(app, uniqueEmail('age-review-admin'));
    const birth = new Date();
    birth.setUTCFullYear(birth.getUTCFullYear() - 17);
    for (const dateOfBirth of [undefined, birth]) {
      const { userId } = await registerUser(app, uniqueEmail('legacy-age'));
      const record = await KYCVerificationModel.create({ userId, verificationType: 'identity', status: 'pending', personalInfo: { dateOfBirth }, documents: [] });
      const before = (await UserModel.findById(userId))?.verificationLevel;
      await request(app).put(`/api/v1/kyc/${record.id}/approve`).set('Authorization', `Bearer ${admin.token}`).send({ reviewVersion: await reviewVersion(record.id), evidenceReviewed: true, reviewNotes: 'Identity documents reviewed against the application.' }).expect(422);
      expect((await KYCVerificationModel.findById(record.id))?.status).toBe('pending');
      expect((await UserModel.findById(userId))?.verificationLevel).toBe(before);
    }
  });

  it('lists pending KYC verifications for admins only', async () => {
    const { token } = await registerUser(app, uniqueEmail('kycpendinguser'));
    await request(app)
      .post('/api/v1/kyc/identity')
      .set('Authorization', `Bearer ${token}`)
      .send({ documents: [] })
      .expect(201);

    const nonAdminRes = await request(app)
      .get('/api/v1/kyc/pending')
      .set('Authorization', `Bearer ${token}`);
    expect(nonAdminRes.status).toBe(403);

    const unauthenticatedRes = await request(app).get('/api/v1/kyc/pending');
    expect(unauthenticatedRes.status).toBe(401);
  });
});
