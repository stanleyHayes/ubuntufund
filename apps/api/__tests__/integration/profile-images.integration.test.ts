import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { platformMediaUrl } from '../helpers/platformMedia.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';

let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
it('persists owner images to public organization reads, supports reset, and rejects unsafe URLs', async () => {
  const registered = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: `images-${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Owner', role: 'organization', organizationName: 'Image Test Org', organizationType: 'ngo' }).expect(201);
  const { user, tokens } = registered.body.data;
  const images = { avatarUrl: platformMediaUrl('logo.png'), coverUrl: platformMediaUrl('cover.png') };
  await request(app).put('/api/v1/profile').send(images).expect(401);
  await request(app).put('/api/v1/profile').set('Authorization', `Bearer ${tokens.accessToken}`).send(images).expect(200);
  const profile = await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${tokens.accessToken}`).expect(200);
  expect(profile.body.data).toMatchObject(images);
  const publicOrg = await request(app).get(`/api/v1/organizations/${user.id}`).expect(200);
  expect(publicOrg.body.data).toMatchObject({ logoUrl: images.avatarUrl, coverUrl: images.coverUrl });
  await request(app).put('/api/v1/profile').set('Authorization', `Bearer ${tokens.accessToken}`).send({ coverUrl: 'javascript:alert(1)' }).expect(400);
  // Reviews approve a URL, not the bytes behind it: third-party hosts could swap
  // the image after approval, so only platform uploads are accepted.
  for (const coverUrl of ['https://example.com/cover.png', 'http://res.cloudinary.com/test_cloud/image/upload/v1/x.png', 'https://res.cloudinary.com/someone-else/image/upload/v1/x.png', 'data:image/png;base64,AAAA']) {
    await request(app).put('/api/v1/profile').set('Authorization', `Bearer ${tokens.accessToken}`).send({ coverUrl }).expect(400);
  }
  const other = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: `other-${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Other User' }).expect(201);
  await request(app).put('/api/v1/profile').set('Authorization', `Bearer ${other.body.data.tokens.accessToken}`).send({ ...images, id: user.id, coverUrl: platformMediaUrl('other.png') }).expect(200);
  expect((await request(app).get(`/api/v1/organizations/${user.id}`)).body.data.coverUrl).toBe(images.coverUrl);
  await request(app).put('/api/v1/profile').set('Authorization', `Bearer ${tokens.accessToken}`).send({ avatarUrl: '', coverUrl: '' }).expect(200);
  expect((await request(app).get(`/api/v1/organizations/${user.id}`)).body.data).toMatchObject({ logoUrl: '', coverUrl: '' });
});
