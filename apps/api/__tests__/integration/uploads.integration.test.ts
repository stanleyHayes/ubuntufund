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
  // This suite asserts the "Cloudinary not configured" 501 behaviour, so the app
  // MUST be built with the Cloudinary creds absent regardless of the developer's
  // local .env. config/index.ts reads these at construction time via dotenv
  // (override:false), so an empty string assigned before createTestApp() survives
  // — a `delete` would let dotenv repopulate it from .env. Originals are restored
  // in afterAll to avoid leaking into later files.
  const CLOUDINARY_ENV_KEYS = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ] as const;
  const savedCloudinaryEnv: Partial<Record<(typeof CLOUDINARY_ENV_KEYS)[number], string | undefined>> = {};

  beforeAll(async () => {
    for (const key of CLOUDINARY_ENV_KEYS) {
      savedCloudinaryEnv[key] = process.env[key];
      process.env[key] = '';
    }
    await connectTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    for (const key of CLOUDINARY_ENV_KEYS) {
      const value = savedCloudinaryEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
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
