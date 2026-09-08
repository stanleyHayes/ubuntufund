import { randomUUID } from 'node:crypto';

// Must be set before createTestApp() dynamically imports the app (config reads
// these at load time). Fake values — the Cloudinary call itself is stubbed.
process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
process.env.CLOUDINARY_API_KEY = 'test_key_123456';
process.env.CLOUDINARY_API_SECRET = 'test_secret_do_not_use_000';

import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
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

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG magic bytes

describe('Image upload proxy (server-side signed Cloudinary)', () => {
  let app: Express;
  let uploadedTo: string[] = [];

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown) => {
        const u = String(url);
        if (u.includes('/auto/upload')) {
          uploadedTo.push(u);
          return {
            ok: true,
            status: 200,
            json: async () => ({
              secure_url: 'https://res.cloudinary.com/test_cloud/image/upload/v1/ujimora/kyc/abc.png',
            }),
          } as unknown as Response;
        }
        throw new Error(`unexpected fetch ${u}`);
      })
    );
  });
  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
    vi.unstubAllGlobals();
  });

  async function authToken(): Promise<string> {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail('uploader'), password: 'SecurePass123', name: 'Up Loader' })
      .expect(201);
    return reg.body.data.tokens.accessToken as string;
  }

  it('rejects an unauthenticated upload with 401', async () => {
    await request(app)
      .post('/api/v1/uploads/image?folder=kyc')
      .set('Content-Type', 'image/png')
      .send(PNG)
      .expect(401);
  });

  it('uploads an authenticated image through the server and returns the secure URL', async () => {
    const token = await authToken();
    uploadedTo = [];
    const res = await request(app)
      .post('/api/v1/uploads/image?folder=kyc')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'image/png')
      .send(PNG)
      .expect(200);

    expect(res.body.data.url).toContain('res.cloudinary.com');
    // The server forwarded to the signed Cloudinary endpoint (never the browser).
    expect(uploadedTo.some((u) => u.includes('/v1_1/test_cloud/auto/upload'))).toBe(true);
  });

  it('rejects a disallowed content-type with 415', async () => {
    const token = await authToken();
    await request(app)
      .post('/api/v1/uploads/image?folder=kyc')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'text/plain')
      .send(Buffer.from('not an image'))
      .expect(415);
  });

  it('rejects an empty body with 400', async () => {
    const token = await authToken();
    await request(app)
      .post('/api/v1/uploads/image?folder=kyc')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'image/png')
      .expect(400);
  });
});
