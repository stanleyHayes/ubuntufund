import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testServer.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { PaymentProviderModel } from '../../src/infrastructure/database/models/PaymentProviderModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { WalletModel } from '../../src/infrastructure/database/models/WalletModel.js';
import { UserPermissionsModel } from '../../src/infrastructure/database/models/UserPermissionsModel.js';
import { authRateLimiter, apiRateLimiter, donationRateLimiter } from '../../src/infrastructure/adapters/inbound/middleware/rateLimiter.js';
import {
  VerificationLevel,
  CampaignStatus,
  SubscriptionTier,
  BillingCycle,
  CampaignCategory,
  CampaignPriority,
  PaymentMethod,
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

async function seedPaymentProviders() {
  await PaymentProviderModel.create({
    name: 'UbuntuFund Wallet',
    slug: 'wallet',
    type: PaymentMethod.WALLET,
    enabled: true,
    isDefault: true,
    feePercent: 0,
    displayOrder: 1,
  });
}

describe('Donations Integration', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    const { app: testApp } = await createTestApp();
    app = testApp;
  });

  beforeEach(async () => {
    await clearTestDatabase();
    await seedPaymentProviders();
    (authRateLimiter as unknown as { reset: () => void }).reset();
    (apiRateLimiter as unknown as { reset: () => void }).reset();
    (donationRateLimiter as unknown as { reset: () => void }).reset();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe('POST /api/v1/campaigns/:id/donate', () => {
    it('donates to a campaign using wallet', async () => {
      const { token: creatorToken } = await registerAndReadyUser(app, 'creator@example.com');

      const campaignRes = await request(app)
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send({
          title: 'Donation Campaign',
          description: 'A campaign to receive donations',
          goalAmount: 5000,
          currency: 'ZAR',
          category: CampaignCategory.EDUCATION,
          priority: CampaignPriority.NORMAL,
          beneficiaries: [],
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      const campaignId = campaignRes.body.data.id;
      await CampaignModel.findByIdAndUpdate(campaignId, { status: CampaignStatus.ACTIVE });

      const { userId: donorId, token: donorToken } = await registerAndReadyUser(app, 'donor@example.com');

      // Grant wallet deposit permission
      await UserPermissionsModel.create({
        userId: donorId,
        roleId: 'test-role',
        permissions: ['wallets:update'],
      });

      await request(app)
        .post('/api/v1/wallets/deposit')
        .set('Authorization', `Bearer ${donorToken}`)
        .send({ userId: donorId, amount: 1000, currency: 'ZAR', paymentMethod: 'wallet' });

      const res = await request(app)
        .post(`/api/v1/campaigns/${campaignId}/donate`)
        .set('Authorization', `Bearer ${donorToken}`)
        .send({
          amount: 500,
          currency: 'ZAR',
          paymentMethod: 'wallet',
          message: 'Great cause!',
          isAnonymous: false,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Donation successful');
    });

    it('rejects donation without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/campaigns/some-id/donate')
        .send({ amount: 100, currency: 'ZAR' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/donations', () => {
    it('lists my donations', async () => {
      const { token } = await registerAndReadyUser(app, 'donorlist@example.com');

      const res = await request(app)
        .get('/api/v1/donations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toBeDefined();
      expect(Array.isArray(res.body.data.data)).toBe(true);
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/donations');
      expect(res.status).toBe(401);
    });
  });
});
