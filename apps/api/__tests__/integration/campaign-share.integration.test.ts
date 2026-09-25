import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { ShareModel } from '../../src/infrastructure/database/models/ShareModel.js';

let app: Express;
beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

it('records shares only for existing public campaigns', async () => {
  const signup = await request(app).post('/api/v1/auth/register').send({ name: 'Sharer', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  const auth = `Bearer ${signup.body.data.tokens.accessToken}`;
  const make = (status: string) => CampaignModel.create({ title: `${status} campaign`, description: 'A campaign', goalAmount: 100, currency: 'GHS', category: 'education', status, creatorId: 'owner', startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
  const [active, pending, blocked] = await Promise.all([make('active'), make('pending_review'), make('blocked')]);
  const share = (id: string) => request(app).post(`/api/v1/campaigns/${id}/share`).set('Authorization', auth).send({ platform: 'web-copy' });
  await share(active.id).expect(201);
  await share(pending.id).expect(404);
  await share(blocked.id).expect(404);
  await share('64b000000000000000000000').expect(404);
  await share('not-a-campaign-id').expect(404);
  expect(await ShareModel.countDocuments({})).toBe(1);
  expect(await ShareModel.findOne({}).lean()).toMatchObject({ campaignId: active.id, platform: 'web-copy' });
});
