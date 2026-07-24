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
import { CampaignCategory, CampaignPriority } from '@ubuntu-fund/types';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

async function registerUser(app: Express, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SecurePass123', name: 'KYC Test User' })
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

    const submitRes = await request(app)
      .post('/api/v1/kyc/identity')
      .set('Authorization', `Bearer ${token}`)
      .send({
        personalInfo: { fullName: 'Jane Doe', nationality: 'Kenyan' },
        documents: [{ type: 'passport', url: 'https://example.com/passport.jpg' }],
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
      .send({ reviewNotes: 'Documents check out' });

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
        currency: 'ZAR',
        category: CampaignCategory.EDUCATION,
        priority: CampaignPriority.NORMAL,
        beneficiaries: [],
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

    expect(createCampaignRes.status).toBe(201);
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
