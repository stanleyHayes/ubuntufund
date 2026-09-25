import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';

let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

it('serves the native release policy publicly, with no minimum version by default', async () => {
  const res = await request(app).get('/api/v1/app/config');
  expect(res.status).toBe(200);
  expect(res.body.data.minSupportedVersion).toEqual({ ios: null, android: null });
  expect(res.body.data.storeUrls.android).toBe('https://play.google.com/store/apps/details?id=com.ujimora.app');
});

it('still requires sign-in before a campaign report is validated', async () => {
  const res = await request(app).post('/api/v1/campaigns/65f0c0ffee65f0c0ffee65f0/report').send({ reason: 'fraudulent' });
  expect(res.status).toBe(401);
});
