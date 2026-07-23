import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testServer.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { PaymentProviderModel } from '../../src/infrastructure/database/models/PaymentProviderModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { authRateLimiter, apiRateLimiter, donationRateLimiter } from '../../src/infrastructure/adapters/inbound/middleware/rateLimiter.js';
import { PaymentMethod } from '@ubuntu-fund/types';

async function createAdmin(app: Express, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SecurePass123', name: 'Admin User' });

  const userId = res.body.data.user.id;
  await UserModel.findByIdAndUpdate(userId, { role: 'admin' });

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'SecurePass123' });

  return { userId, token: loginRes.body.data.tokens.accessToken };
}

async function seedPaymentProviders() {
  await PaymentProviderModel.insertMany([
    {
      name: 'Wallet',
      slug: 'wallet',
      type: PaymentMethod.WALLET,
      enabled: true,
      isDefault: true,
      feePercent: 0,
      displayOrder: 1,
    },
    {
      name: 'Stripe',
      slug: 'stripe',
      type: PaymentMethod.CARD,
      enabled: false,
      isDefault: false,
      feePercent: 2.9,
      displayOrder: 2,
    },
  ]);
}

describe('Payment Providers Integration', () => {
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

  describe('GET /api/v1/payment-providers/enabled', () => {
    it('returns enabled providers publicly', async () => {
      const res = await request(app).get('/api/v1/payment-providers/enabled');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].slug).toBe('wallet');
    });
  });

  describe('GET /api/v1/payment-providers', () => {
    it('returns all providers for admin', async () => {
      const { token } = await createAdmin(app, 'admin@example.com');

      const res = await request(app)
        .get('/api/v1/payment-providers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(2);
    });

    it('rejects non-admin users', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'user@example.com', password: 'SecurePass123', name: 'Regular User' });

      const token = registerRes.body.data.tokens.accessToken;

      const res = await request(app)
        .get('/api/v1/payment-providers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/payment-providers');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/v1/payment-providers/:id/toggle', () => {
    it('toggles provider enabled state for admin', async () => {
      const { token } = await createAdmin(app, 'toggle@example.com');

      const stripe = await PaymentProviderModel.findOne({ slug: 'stripe' });
      const initialEnabled = stripe!.enabled;

      const res = await request(app)
        .patch(`/api/v1/payment-providers/${stripe!._id}/toggle`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.enabled).toBe(!initialEnabled);
    });

    it('rejects non-admin users', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'toggleuser@example.com', password: 'SecurePass123', name: 'Regular User' });

      const token = registerRes.body.data.tokens.accessToken;
      const stripe = await PaymentProviderModel.findOne({ slug: 'stripe' });

      const res = await request(app)
        .patch(`/api/v1/payment-providers/${stripe!._id}/toggle`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });
});
