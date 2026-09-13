import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { PublicationReviewModel } from '../../src/infrastructure/database/models/PublicationReviewModel.js';
let app: Express, auth: string;
beforeAll(async () => {
  await connectTestDatabase(); app = await createTestApp();
  const response = await request(app).post('/api/v1/auth/register').send({ name: 'Queue reviewer', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  auth = `Bearer ${response.body.data.tokens.accessToken}`;
  await UserModel.findByIdAndUpdate(response.body.data.user.id, { role: 'admin' });
  await PublicationReviewModel.insertMany(Array.from({ length: 27 }, (_, index) => ({ actorId: response.body.data.user.id, fingerprint: randomUUID(), action: 'comment.create', resourceId: 'fixture', text: `Submission ${index}`, reason: 'staff_requested', createdAt: new Date(1700000000000 + index * 1000) })));
});
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
it.each(['publication-reviews', 'tip-content-reviews', 'donation-content-reviews', 'safety-reports', 'privacy-requests', 'data-rights', 'refund-operations', 'store-billing'])('%s accepts bounded page sizes and rejects unbounded reads', async endpoint => {
  await request(app).get(`/api/v1/admin/${endpoint}?pageSize=12`).set('Authorization', auth).expect(200);
  for (const size of ['0', '101', '1.5', 'invalid']) await request(app).get(`/api/v1/admin/${endpoint}?pageSize=${size}`).set('Authorization', auth).expect(400);
});
it('returns distinct server pages and preserves the default size for existing clients', async () => {
  const get = async (query: string) => (await request(app).get(`/api/v1/admin/publication-reviews?${query}`).set('Authorization', auth).expect(200)).body.data;
  const first = await get('page=1&pageSize=12'), second = await get('page=2&pageSize=12'), last = await get('page=3&pageSize=12');
  expect([first.items.length, second.items.length, last.items.length]).toEqual([12, 12, 3]);
  expect(new Set([...first.items, ...second.items, ...last.items].map(item => item.id)).size).toBe(27);
  expect((await get('page=1')).items).toHaveLength(25);
  expect((await get('page=1&pageSize=24')).items).toHaveLength(24);
});
