import { afterAll, beforeAll, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { config } from '../../src/infrastructure/config/index.js';

/**
 * Web and admin call the API origin directly, so nearly every browser request
 * is preflighted. Without Access-Control-Max-Age a preflight is cached for
 * ~5 s and most calls pay an extra round trip.
 */
let app: Express;
const origin = config.corsOrigins[0] ?? 'https://app.ujimora.com';
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

it('lets browsers cache an allowed preflight for two hours', async () => {
  const res = await request(app).options('/api/v1/campaigns')
    .set('Origin', origin)
    .set('Access-Control-Request-Method', 'GET')
    .set('Access-Control-Request-Headers', 'authorization,content-type')
    .expect(204);
  expect(res.headers['access-control-max-age']).toBe('7200');
  expect(res.headers['access-control-allow-origin']).toBe(origin);
  expect(res.headers['access-control-allow-credentials']).toBe('true');
});
