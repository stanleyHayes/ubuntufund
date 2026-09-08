import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';

let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
it('persists owner images to public organization reads, supports reset, and rejects unsafe URLs', async () => {
  const registered = await request(app).post('/api/v1/auth/register').send({ email: `images-${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Owner', role: 'organization', organizationName: 'Image Test Org', organizationType: 'ngo' }).expect(201);
  const { user, tokens } = registered.body.data;
  const images = { avatarUrl: 'https://example.com/logo.png', coverUrl: 'https://example.com/cover.png' };
  await request(app).put('/api/v1/profile').send(images).expect(401);
  await request(app).put('/api/v1/profile').set('Authorization', `Bearer ${tokens.accessToken}`).send(images).expect(200);
  const profile = await request(app).get('/api/v1/profile').set('Authorization', `Bearer ${tokens.accessToken}`).expect(200);
  expect(profile.body.data).toMatchObject(images);
  const publicOrg = await request(app).get(`/api/v1/organizations/${user.id}`).expect(200);
  expect(publicOrg.body.data).toMatchObject({ logoUrl: images.avatarUrl, coverUrl: images.coverUrl });
  await request(app).put('/api/v1/profile').set('Authorization', `Bearer ${tokens.accessToken}`).send({ coverUrl: 'javascript:alert(1)' }).expect(400);
  const other = await request(app).post('/api/v1/auth/register').send({ email: `other-${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Other User' }).expect(201);
  await request(app).put('/api/v1/profile').set('Authorization', `Bearer ${other.body.data.tokens.accessToken}`).send({ ...images, id: user.id, coverUrl: 'https://example.com/other.png' }).expect(200);
  expect((await request(app).get(`/api/v1/organizations/${user.id}`)).body.data.coverUrl).toBe(images.coverUrl);
  await request(app).put('/api/v1/profile').set('Authorization', `Bearer ${tokens.accessToken}`).send({ avatarUrl: '', coverUrl: '' }).expect(200);
  expect((await request(app).get(`/api/v1/organizations/${user.id}`)).body.data).toMatchObject({ logoUrl: '', coverUrl: '' });
});
