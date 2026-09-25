import { randomUUID } from 'node:crypto';
process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
process.env.CLOUDINARY_API_KEY = 'test_key';
process.env.CLOUDINARY_API_SECRET = 'test_private_secret';
import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { PrivateKycDocumentModel } from '../../src/infrastructure/database/models/PrivateKycDocumentModel.js';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
describe('Private verification documents', () => {
  let app: Express;
  const uploadedForms: FormData[] = [];
  beforeAll(async () => {
    await connectTestDatabase(); app = await createTestApp();
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      uploadedForms.push(options.body as FormData);
      return { ok: true, json: async () => ({ secure_url: 'https://res.cloudinary.com/test_cloud/image/authenticated/private-doc.png', public_id: 'private-doc', resource_type: 'image', format: 'png', type: 'authenticated' }) };
    }));
  });
  afterAll(async () => { vi.unstubAllGlobals(); await dropTestDatabase(); await disconnectTestDatabase(); });
  async function register() {
    const result = await request(app).post('/api/v1/auth/register').send({ email: `kycdoc-${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Private Document', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
    return { id: result.body.data.user.id, bearer: `Bearer ${result.body.data.tokens.accessToken}` };
  }
  it('uploads as authenticated and issues short-lived links only to the owner or current admin', async () => {
    const owner = await register(); const other = await register();
    const uploaded = await request(app).post('/api/v1/uploads/image?folder=kyc').set('Authorization', owner.bearer).set('Content-Type', 'image/png').send(PNG).expect(200);
    expect(uploaded.body.data.url).toMatch(/^kyc:\/\/[a-f0-9]{24}$/);
    expect(uploadedForms.at(-1)?.get('type')).toBe('authenticated');
    expect(uploaded.body.data.url).not.toContain('cloudinary');
    const id = uploaded.body.data.url.slice(6);
    expect((await PrivateKycDocumentModel.findById(id))?.userId).toBe(owner.id);
    await request(app).get(`/api/v1/uploads/kyc/${id}/access`).expect(401);
    await request(app).get(`/api/v1/uploads/kyc/${id}/access`).set('Authorization', other.bearer).expect(404);
    const access = await request(app).get(`/api/v1/uploads/kyc/${id}/access`).set('Authorization', owner.bearer).expect(200);
    const url = new URL(access.body.data.url);
    expect(url.searchParams.get('type')).toBe('authenticated');
    expect(Number(url.searchParams.get('expires_at'))).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 60);
    expect(url.searchParams.get('signature')).toBeTruthy();
    expect(access.headers['cache-control']).toBe('no-store');
    await UserModel.updateOne({ _id: other.id }, { $set: { role: 'admin' } });
    await request(app).get(`/api/v1/uploads/kyc/${id}/access`).set('Authorization', other.bearer).expect(200);
    await UserModel.updateOne({ _id: other.id }, { $set: { role: 'user' } });
    await request(app).post('/api/v1/kyc/identity').set('Authorization', other.bearer).send({ documents: [{ type: 'id_card', url: uploaded.body.data.url }] }).expect(400);
    await request(app).post('/api/v1/kyc/identity').set('Authorization', owner.bearer).send({ documents: [{ type: 'id_card', url: uploaded.body.data.url }] }).expect(201);
  });
  it('accepts PDFs only into private KYC storage and rejects unknown folders', async () => {
    const owner = await register();
    const PDF = Buffer.from('%PDF-1.7\n%fixture\n');
    const upload = (folder: string, type: string, body: Buffer) =>
      request(app).post(`/api/v1/uploads/image?folder=${folder}`).set('Authorization', owner.bearer).set('Content-Type', type).send(body);
    const kyc = await upload('kyc', 'application/pdf', PDF).expect(200);
    expect(kyc.body.data.url).toMatch(/^kyc:\/\/[a-f0-9]{24}$/);
    for (const folder of ['profiles', 'campaigns', 'misc']) {
      const res = await upload(folder, 'application/pdf', PDF).expect(415);
      expect(res.body.message).toBe('PDF files are only accepted for verification documents.');
    }
    // An unknown folder used to fall back to misc silently.
    await upload('avatars', 'image/png', PNG).expect(400);
    await upload('..%2Fkyc', 'image/png', PNG).expect(400);
  });

  it('rejects public document URLs and offers no direct-upload signing endpoint', async () => {
    const owner = await register();
    await request(app).post('/api/v1/kyc/identity').set('Authorization', owner.bearer).send({ documents: [{ type: 'id_card', url: 'https://example.com/public-id.jpg' }] }).expect(400);
    // Direct browser → Cloudinary signing is gone: a folder+timestamp signature
    // let any signed-in user upload any type or size, bypassing /uploads/image.
    for (const folder of ['kyc', 'ujimora/kyc', '../../kyc', 'misc']) await request(app).post('/api/v1/uploads/sign').set('Authorization', owner.bearer).send({ folder }).expect(404);
  });
});
