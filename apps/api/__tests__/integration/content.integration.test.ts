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
import { MongoSiteContentRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoSiteContentRepository.js';
import { seedSiteContentIfEmpty } from '../../src/infrastructure/database/seedSiteContent.js';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

async function registerUser(app: Express, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SecurePass123', name: 'Content Test User' })
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

describe('Site Content (CMS) Integration', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
    // Mirror the boot seed so the public reads have the marketing defaults.
    await seedSiteContentIfEmpty(new MongoSiteContentRepository());
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  describe('GET /api/v1/content (public)', () => {
    it('lists every seeded block, key-ordered', async () => {
      const res = await request(app).get('/api/v1/content');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      const keys = res.body.data.map((b: { key: string }) => b.key);
      expect(keys).toEqual(expect.arrayContaining([
        'about',
        'contact',
        'faq',
        'marketing.stats',
      ]));

      // Key-ordered ascending.
      const sorted = [...keys].sort();
      expect(keys).toEqual(sorted);
    });
  });

  describe('GET /api/v1/content/:key (public)', () => {
    it('returns the seeded marketing.stats block with the current values', async () => {
      const res = await request(app).get('/api/v1/content/marketing.stats');

      expect(res.status).toBe(200);
      expect(res.body.data.key).toBe('marketing.stats');
      expect(res.body.data.type).toBe('stats');
      const items = res.body.data.data.items as { value: string; label: string }[];
      expect(items).toHaveLength(4);
      expect(items[0]).toEqual({ value: 'GH₵ 120M+', label: 'Raised on platform' });
    });

    it('returns the seeded faq block with question/answer items', async () => {
      const res = await request(app).get('/api/v1/content/faq');

      expect(res.status).toBe(200);
      const items = res.body.data.data.items as { question: string; answer: string }[];
      expect(items.length).toBeGreaterThan(0);
      expect(typeof items[0].question).toBe('string');
      expect(typeof items[0].answer).toBe('string');
    });

    it('404s for an unknown key', async () => {
      const res = await request(app).get('/api/v1/content/does-not-exist');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/content/:key (admin)', () => {
    it('lets an admin update a block, and the public GET reflects it', async () => {
      const { token: adminToken } = await createAdmin(app, uniqueEmail('contentadmin'));
      const key = `test.block.${randomUUID()}`;

      const putRes = await request(app)
        .put(`/api/v1/content/${key}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'custom', data: { headline: 'Ayekoo, Ghana' } });

      expect(putRes.status).toBe(200);
      expect(putRes.body.data.key).toBe(key);
      expect(putRes.body.data.data).toEqual({ headline: 'Ayekoo, Ghana' });

      const getRes = await request(app).get(`/api/v1/content/${key}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.data).toEqual({ headline: 'Ayekoo, Ghana' });

      // A data-only update preserves the existing type.
      const putRes2 = await request(app)
        .put(`/api/v1/content/${key}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ data: { headline: 'Together, we rise' } });

      expect(putRes2.status).toBe(200);
      expect(putRes2.body.data.type).toBe('custom');
      expect(putRes2.body.data.data).toEqual({ headline: 'Together, we rise' });
    });

    it('overwrites a seeded block in place (marketing.stats)', async () => {
      const { token: adminToken } = await createAdmin(app, uniqueEmail('statsadmin'));
      const newData = { items: [{ value: 'GH₵ 200M+', label: 'Raised on platform' }] };

      const putRes = await request(app)
        .put('/api/v1/content/marketing.stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ data: newData });

      expect(putRes.status).toBe(200);

      const getRes = await request(app).get('/api/v1/content/marketing.stats');
      expect(getRes.body.data.data).toEqual(newData);
    });

    it('returns 400 when data is missing', async () => {
      const { token: adminToken } = await createAdmin(app, uniqueEmail('baddataadmin'));

      const res = await request(app)
        .put(`/api/v1/content/test.nodata.${randomUUID()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'custom' });

      expect(res.status).toBe(400);
    });

    it('returns 403 for a non-admin token', async () => {
      const { token } = await registerUser(app, uniqueEmail('contentnonadmin'));

      const res = await request(app)
        .put(`/api/v1/content/test.forbidden.${randomUUID()}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ data: { any: 'thing' } });

      expect(res.status).toBe(403);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .put(`/api/v1/content/test.unauth.${randomUUID()}`)
        .send({ data: { any: 'thing' } });

      expect(res.status).toBe(401);
    });
  });
});
