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

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

async function registerUser(app: Express, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SecurePass123', name: 'Upload Test User' })
    .expect(201);

  return { token: res.body.data.tokens.accessToken as string };
}

describe('Uploads (Cloudinary sign) Integration', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  describe('POST /api/v1/uploads/sign', () => {
    it('returns a clean 501 when Cloudinary is not configured', async () => {
      // The test environment sets no CLOUDINARY_* creds, so the feature is
      // disabled — the endpoint must respond 501, never crash.
      const { token } = await registerUser(app, uniqueEmail('uploader'));

      const res = await request(app)
        .post('/api/v1/uploads/sign')
        .set('Authorization', `Bearer ${token}`)
        .send({ folder: 'campaigns' });

      expect(res.status).toBe(501);
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message.length).toBeGreaterThan(0);
    });

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/v1/uploads/sign').send({});
      expect(res.status).toBe(401);
    });
  });
});
