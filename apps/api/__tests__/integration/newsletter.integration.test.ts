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
import { NewsletterSubscriptionModel } from '../../src/infrastructure/database/models/NewsletterSubscriptionModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

async function registerUser(app: Express, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SecurePass123', name: 'Newsletter Test User' })
    .expect(201);

  return {
    userId: res.body.data.user.id as string,
    token: res.body.data.tokens.accessToken as string,
  };
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

describe('Newsletter Integration', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  describe('POST /api/v1/newsletter/subscribe', () => {
    it('is public and returns a { data: { message } } envelope on success', async () => {
      const res = await request(app)
        .post('/api/v1/newsletter/subscribe')
        .send({ email: uniqueEmail('subscriber') });

      expect(res.status).toBe(200);
      expect(typeof res.body.data.message).toBe('string');
      expect(res.body.data.message.length).toBeGreaterThan(0);
    });

    it('persists the email lowercased', async () => {
      const email = uniqueEmail('Mixed.Case');
      await request(app)
        .post('/api/v1/newsletter/subscribe')
        .send({ email })
        .expect(200);

      const doc = await NewsletterSubscriptionModel.findOne({
        email: email.toLowerCase(),
      });
      expect(doc).not.toBeNull();
      expect(doc?.email).toBe(email.toLowerCase());
      expect(doc?.createdAt).toBeInstanceOf(Date);
    });

    it('is idempotent: re-subscribing does not create a duplicate', async () => {
      const email = uniqueEmail('repeat');

      await request(app)
        .post('/api/v1/newsletter/subscribe')
        .send({ email })
        .expect(200);
      await request(app)
        .post('/api/v1/newsletter/subscribe')
        .send({ email: email.toUpperCase() })
        .expect(200);

      const count = await NewsletterSubscriptionModel.countDocuments({
        email: email.toLowerCase(),
      });
      expect(count).toBe(1);
    });

    it('rejects an invalid email with 400', async () => {
      const res = await request(app)
        .post('/api/v1/newsletter/subscribe')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
    });

    it('rejects a missing email with 400', async () => {
      const res = await request(app)
        .post('/api/v1/newsletter/subscribe')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/newsletter/subscribers (admin)', () => {
    it('lists a subscriber created via the public subscribe endpoint, newest-first, for an admin', async () => {
      const email = uniqueEmail('admin-listed');
      await request(app)
        .post('/api/v1/newsletter/subscribe')
        .send({ email })
        .expect(200);

      const { token: adminToken } = await createAdmin(app, uniqueEmail('newsletteradmin'));

      const res = await request(app)
        .get('/api/v1/newsletter/subscribers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      const found = res.body.data.find(
        (s: { email: string }) => s.email === email.toLowerCase()
      );
      expect(found).toBeDefined();
      expect(typeof found.id).toBe('string');
      expect(typeof found.createdAt).toBe('string');

      // Newest-first ordering: createdAt is non-increasing down the list.
      const timestamps = res.body.data.map((s: { createdAt: string }) =>
        new Date(s.createdAt).getTime()
      );
      const sorted = [...timestamps].sort((a, b) => b - a);
      expect(timestamps).toEqual(sorted);
    });

    it('returns 403 for a non-admin token', async () => {
      const { token } = await registerUser(app, uniqueEmail('newsletternonadmin'));

      const res = await request(app)
        .get('/api/v1/newsletter/subscribers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/newsletter/subscribers');
      expect(res.status).toBe(401);
    });
  });
});
