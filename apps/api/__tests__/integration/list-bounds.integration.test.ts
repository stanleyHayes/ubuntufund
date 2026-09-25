import { randomUUID } from 'node:crypto';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { DonationModel } from '../../src/infrastructure/database/models/DonationModel.js';
import { NotificationModel } from '../../src/infrastructure/database/models/NotificationModel.js';

/**
 * Public list endpoints took page/pageSize/sortBy straight from the query:
 * pageSize=100000 read a whole collection, page=-1 became a negative skip
 * (a 500), sortBy could order by any internal field, the donations tab loaded
 * every donation to slice one page, and /notifications returned everything a
 * user had ever received.
 */
describe('bounded list endpoints', () => {
  let app: Express;
  let campaignId: string;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
    const campaign = await CampaignModel.create({
      title: 'Bounded list campaign', description: 'A campaign used to check pagination bounds.', goalAmount: 1000,
      raisedAmount: 0, currency: 'GHS', category: 'education', status: 'active', creatorId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      beneficiaries: ['School'], startDate: new Date(), endDate: new Date(Date.now() + 86_400_000),
    });
    campaignId = campaign.id;
    const base = Date.now() - 60_000;
    await DonationModel.insertMany(Array.from({ length: 25 }, (_, index) => ({
      campaignId, donorId: 'guest', amount: index + 1, currency: 'GHS', paymentMethod: 'card',
      isAnonymous: true, createdAt: new Date(base + index * 1000), updatedAt: new Date(base + index * 1000),
    })));
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  it.each([
    ['page=-1'],
    ['page=0'],
    ['page=1.5'],
    ['page=abc'],
    ['pageSize=0'],
    ['pageSize=100000'],
    ['pageSize=101'],
    ['sortBy=passwordHash'],
    ['sortBy=creatorId'],
    ['sortOrder=sideways'],
  ])('rejects GET /campaigns?%s with 400', async (query) => {
    const res = await request(app).get(`/api/v1/campaigns?${query}`);
    expect(res.status).toBe(400);
  });

  it('still serves the defaults and every allowed sort', async () => {
    const res = await request(app).get('/api/v1/campaigns').expect(200);
    expect(res.body.data).toMatchObject({ page: 1, pageSize: 20 });
    for (const sortBy of ['createdAt', 'raisedAmount', 'goalAmount', 'endDate']) {
      await request(app).get(`/api/v1/campaigns?sortBy=${sortBy}&sortOrder=asc&pageSize=100`).expect(200);
    }
  });

  it('pages campaign donations in the database, newest first, without overlap', async () => {
    const first = await request(app).get(`/api/v1/campaigns/${campaignId}/donations?page=1&pageSize=10`).expect(200);
    const third = await request(app).get(`/api/v1/campaigns/${campaignId}/donations?page=3&pageSize=10`).expect(200);
    expect(first.body.data).toMatchObject({ total: 25, page: 1, pageSize: 10, totalPages: 3 });
    expect(first.body.data.items.map((d: { amount: number }) => d.amount)).toEqual([25, 24, 23, 22, 21, 20, 19, 18, 17, 16]);
    expect(third.body.data.items.map((d: { amount: number }) => d.amount)).toEqual([5, 4, 3, 2, 1]);

    const all = await request(app).get(`/api/v1/campaigns/${campaignId}/donations?pageSize=100`).expect(200);
    expect(new Set(all.body.data.items.map((d: { id: string }) => d.id)).size).toBe(25);

    await request(app).get(`/api/v1/campaigns/${campaignId}/donations?page=-1`).expect(400);
    await request(app).get(`/api/v1/campaigns/${campaignId}/donations?pageSize=5000`).expect(400);
  });

  it('bounds /notifications and pages older items with a before cursor', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send({
      email: `notify-${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Notified',
      legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true },
    }).expect(201);
    const userId = registered.body.data.user.id as string;
    const auth = `Bearer ${registered.body.data.tokens.accessToken}`;
    const base = Date.now() - 3_600_000;
    await NotificationModel.insertMany(Array.from({ length: 120 }, (_, index) => ({
      userId, title: `Notice ${index}`, body: 'Body', type: 'system', read: false, createdAt: new Date(base + index * 1000),
    })));

    const firstPage = await request(app).get('/api/v1/notifications').set('Authorization', auth).expect(200);
    expect(firstPage.body.data).toHaveLength(50);
    expect(firstPage.body.data[0].title).toBe('Notice 119');

    const max = await request(app).get('/api/v1/notifications?limit=100').set('Authorization', auth).expect(200);
    expect(max.body.data).toHaveLength(100);

    const last = firstPage.body.data.at(-1);
    const older = await request(app).get(`/api/v1/notifications?limit=10&before=${encodeURIComponent(last.createdAt)}`).set('Authorization', auth).expect(200);
    expect(older.body.data.map((n: { title: string }) => n.title)).toEqual(Array.from({ length: 10 }, (_, i) => `Notice ${69 - i}`));

    await request(app).get('/api/v1/notifications?limit=1000').set('Authorization', auth).expect(400);
    await request(app).get('/api/v1/notifications?before=yesterday').set('Authorization', auth).expect(400);
    // The unread badge endpoint still counts everything.
    const unread = await request(app).get('/api/v1/notifications/unread-count').set('Authorization', auth).expect(200);
    expect(JSON.stringify(unread.body.data)).toContain('120');
  });
});
