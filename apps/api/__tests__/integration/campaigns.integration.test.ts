import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testServer.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { authRateLimiter, apiRateLimiter, donationRateLimiter } from '../../src/infrastructure/adapters/inbound/middleware/rateLimiter.js';
import {
  VerificationLevel,
  CampaignStatus,
  SubscriptionTier,
  BillingCycle,
  CampaignCategory,
  CampaignPriority,
} from '@ubuntu-fund/types';

async function registerAndReadyUser(app: Express, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SecurePass123', name: 'Test User' });

  const userId = res.body.data.user.id;
  const token = res.body.data.tokens.accessToken;

  await UserModel.findByIdAndUpdate(userId, { verificationLevel: VerificationLevel.EMAIL_PHONE });
  await SubscriptionModel.create({
    userId,
    tier: SubscriptionTier.FREE,
    status: 'active',
    billingCycle: BillingCycle.MONTHLY,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return { userId, token };
}

describe('Campaigns Integration', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    const { app: testApp } = await createTestApp();
    app = testApp;
  });

  beforeEach(async () => {
    await clearTestDatabase();
    (authRateLimiter as unknown as { reset: () => void }).reset();
    (apiRateLimiter as unknown as { reset: () => void }).reset();
    (donationRateLimiter as unknown as { reset: () => void }).reset();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe('POST /api/v1/campaigns', () => {
    it('creates a campaign when authenticated', async () => {
      const { token } = await registerAndReadyUser(app, 'creator@example.com');

      const res = await request(app)
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Test Campaign',
          description: 'A test campaign for integration testing',
          goalAmount: 1000,
          currency: 'ZAR',
          category: CampaignCategory.EDUCATION,
          priority: CampaignPriority.NORMAL,
          beneficiaries: ['Test Beneficiary'],
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Test Campaign');
      expect(res.body.data.status).toBe(CampaignStatus.PENDING_REVIEW);
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/v1/campaigns')
        .send({
          title: 'Test Campaign',
          description: 'A test campaign',
          goalAmount: 1000,
          currency: 'ZAR',
          category: CampaignCategory.EDUCATION,
          priority: CampaignPriority.NORMAL,
          beneficiaries: [],
          endDate: new Date().toISOString(),
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/campaigns/:id', () => {
    it('returns a campaign by id', async () => {
      const { token } = await registerAndReadyUser(app, 'getcampaign@example.com');

      const createRes = await request(app)
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Get Campaign',
          description: 'A campaign to retrieve',
          goalAmount: 500,
          currency: 'ZAR',
          category: CampaignCategory.MEDICAL,
          priority: CampaignPriority.URGENT,
          beneficiaries: [],
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      const campaignId = createRes.body.data.id;

      const res = await request(app).get(`/api/v1/campaigns/${campaignId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(campaignId);
      expect(res.body.data.title).toBe('Get Campaign');
    });

    it('returns 404 for non-existent campaign', async () => {
      const res = await request(app).get('/api/v1/campaigns/000000000000000000000000');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/campaigns/search', () => {
    it('searches campaigns by query', async () => {
      const { token } = await registerAndReadyUser(app, 'search@example.com');

      await request(app)
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Unique Search Campaign',
          description: 'This is a unique campaign for search',
          goalAmount: 500,
          currency: 'ZAR',
          category: CampaignCategory.MEDICAL,
          priority: CampaignPriority.NORMAL,
          beneficiaries: [],
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      const res = await request(app)
        .get('/api/v1/campaigns/search')
        .query({ query: 'Unique Search' });

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBeGreaterThan(0);
    });
  });

  describe('PUT /api/v1/campaigns/:id', () => {
    it('update campaign endpoint is not implemented', async () => {
      const { token } = await registerAndReadyUser(app, 'update@example.com');
      const res = await request(app)
        .put('/api/v1/campaigns/000000000000000000000000')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/campaigns/:id', () => {
    it('delete campaign endpoint is not implemented', async () => {
      const { token } = await registerAndReadyUser(app, 'delete@example.com');
      const res = await request(app)
        .delete('/api/v1/campaigns/000000000000000000000000')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
