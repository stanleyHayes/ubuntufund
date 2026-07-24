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

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

async function registerUser(app: Express, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SecurePass123', name: 'Test User' })
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

describe('Payment Providers Integration', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  describe('GET /api/v1/payment-providers/enabled', () => {
    it('is public and returns only enabled providers', async () => {
      const res = await request(app).get('/api/v1/payment-providers/enabled');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      // The wallet provider is seeded enabled-by-default the first time the
      // collection is read; every provider returned here must be enabled.
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const provider of res.body.data) {
        expect(provider.enabled).toBe(true);
      }
      expect(res.body.data.some((p: { slug: string }) => p.slug === 'wallet')).toBe(true);
    });
  });

  describe('GET /api/v1/payment-providers', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/payment-providers');
      expect(res.status).toBe(401);
    });

    it('rejects non-admin users with 403', async () => {
      const { token } = await registerUser(app, uniqueEmail('nonadmin'));

      const res = await request(app)
        .get('/api/v1/payment-providers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('returns the full provider list for an admin, including disabled ones', async () => {
      const { token } = await createAdmin(app, uniqueEmail('admin'));

      const res = await request(app)
        .get('/api/v1/payment-providers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      // Defaults seeded on first read: wallet, M-Pesa, Stripe, bank transfer.
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
      expect(res.body.data.some((p: { enabled: boolean }) => p.enabled === false)).toBe(true);
    });
  });
});
