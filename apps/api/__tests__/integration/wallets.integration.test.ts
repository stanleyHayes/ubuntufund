import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testServer.js';
import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { WalletModel } from '../../src/infrastructure/database/models/WalletModel.js';
import { UserPermissionsModel } from '../../src/infrastructure/database/models/UserPermissionsModel.js';
import { authRateLimiter, apiRateLimiter, donationRateLimiter } from '../../src/infrastructure/adapters/inbound/middleware/rateLimiter.js';

describe('Wallets Integration', () => {
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

  describe('GET /api/v1/wallets', () => {
    it('returns my wallets', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'wallet@example.com', password: 'SecurePass123', name: 'Wallet User' });

      const token = registerRes.body.data.tokens.accessToken;

      const res = await request(app)
        .get('/api/v1/wallets')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].userId).toBe(registerRes.body.data.user.id);
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/v1/wallets');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/wallets/deposit', () => {
    it('deposits into my wallet', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'deposit@example.com', password: 'SecurePass123', name: 'Deposit User' });

      const token = registerRes.body.data.tokens.accessToken;
      const userId = registerRes.body.data.user.id;

      // Grant wallet deposit permission
      await UserPermissionsModel.create({
        userId,
        roleId: 'test-role',
        permissions: ['wallets:update'],
      });

      const res = await request(app)
        .post('/api/v1/wallets/deposit')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId, amount: 500, currency: 'ZAR', paymentMethod: 'wallet' });

      expect(res.status).toBe(200);
      expect(res.body.data.balance).toBe(500);
    });

    it('rejects deposit without wallets:update permission', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'nodeposit@example.com', password: 'SecurePass123', name: 'No Deposit User' });

      const token = registerRes.body.data.tokens.accessToken;
      const userId = registerRes.body.data.user.id;

      const res = await request(app)
        .post('/api/v1/wallets/deposit')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId, amount: 500, currency: 'ZAR', paymentMethod: 'wallet' });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/wallets/transfer', () => {
    it('returns 404 when sender wallet does not exist for currency', async () => {
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'transfer@example.com', password: 'SecurePass123', name: 'Transfer User' });

      const token = registerRes.body.data.tokens.accessToken;

      const res = await request(app)
        .post('/api/v1/wallets/transfer')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 100, currency: 'USD', toUserId: 'some-id' });

      expect(res.status).toBe(404);
    });
  });
});
