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
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { CampaignCategory, CampaignPriority } from '@ubuntu-fund/types';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

function campaignPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    title: 'Test Campaign',
    description: 'A test campaign for integration testing',
    goalAmount: 5000,
    currency: 'ZAR',
    category: CampaignCategory.EDUCATION,
    priority: CampaignPriority.NORMAL,
    beneficiaries: ['Test Beneficiary'],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

/** Registers a user and returns their id + access token. verificationLevel is left at NONE. */
async function registerUser(app: Express, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SecurePass123', name: 'Test User' })
    .expect(201);

  return { userId: res.body.data.user.id as string, token: res.body.data.tokens.accessToken as string };
}

/** Directly raises a user's verificationLevel in the DB (bypasses the KYC flow, mirroring how an already-verified fixture user would look). */
async function setVerificationLevel(userId: string, level: number): Promise<void> {
  await UserModel.findByIdAndUpdate(userId, { verificationLevel: level });
}

/** Registers an admin: sets role in the DB, then re-logs in so the JWT carries the fresh role claim. */
async function createAdmin(app: Express, email: string) {
  const { userId } = await registerUser(app, email);
  await UserModel.findByIdAndUpdate(userId, { role: 'admin' });

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'SecurePass123' })
    .expect(200);

  return { userId, token: loginRes.body.data.tokens.accessToken as string };
}

describe('Campaigns Integration', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  describe('POST /api/v1/campaigns', () => {
    it('refuses creation for an unverified user (campaign limit is 0)', async () => {
      const { userId, token } = await registerUser(app, uniqueEmail('unverified'));

      const res = await request(app)
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${token}`)
        .send(campaignPayload());

      expect(res.status).toBe(403);

      const count = await CampaignModel.countDocuments({ creatorId: userId });
      expect(count).toBe(0);
    });

    it('allows creation once verificationLevel is raised', async () => {
      const { userId, token } = await registerUser(app, uniqueEmail('verified'));
      await setVerificationLevel(userId, 2); // VerificationLevel.NATIONAL_ID -> limit 3

      const res = await request(app)
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${token}`)
        .send(campaignPayload({ title: 'Verified Creator Campaign' }));

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Verified Creator Campaign');
      expect(res.body.data.status).toBe('pending_review');
      expect(res.body.data.creatorId).toBe(userId);
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).post('/api/v1/campaigns').send(campaignPayload());
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/campaigns/:id', () => {
    it('returns a campaign by id without requiring auth', async () => {
      const { userId, token } = await registerUser(app, uniqueEmail('getbyid'));
      await setVerificationLevel(userId, 2);

      const createRes = await request(app)
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${token}`)
        .send(campaignPayload({ title: 'Fetchable Campaign' }));
      expect(createRes.status).toBe(201);

      const campaignId = createRes.body.data.id;
      const res = await request(app).get(`/api/v1/campaigns/${campaignId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(campaignId);
      expect(res.body.data.title).toBe('Fetchable Campaign');
    });

    it('returns 404 for a non-existent campaign', async () => {
      const res = await request(app).get('/api/v1/campaigns/000000000000000000000000');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/campaigns', () => {
    it('paginates the campaign list', async () => {
      const { userId, token } = await registerUser(app, uniqueEmail('paginate'));
      await setVerificationLevel(userId, 3); // INSTITUTIONAL -> limit 10, room for several campaigns

      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/v1/campaigns')
          .set('Authorization', `Bearer ${token}`)
          .send(campaignPayload({ title: `Paginated Campaign ${i}` }))
          .expect(201);
      }

      const res = await request(app).get('/api/v1/campaigns').query({ page: 1, pageSize: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.pageSize).toBe(2);
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.total).toBeGreaterThanOrEqual(3);
      expect(res.body.data.totalPages).toBeGreaterThanOrEqual(2);
    });
  });

  describe('PUT /api/v1/campaigns/:id/approve', () => {
    it('lets an admin approve a pending campaign, activating it', async () => {
      const { userId: creatorId, token: creatorToken } = await registerUser(
        app,
        uniqueEmail('approvecreator')
      );
      await setVerificationLevel(creatorId, 2);

      const createRes = await request(app)
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send(campaignPayload({ title: 'Needs Approval' }));
      expect(createRes.status).toBe(201);
      const campaignId = createRes.body.data.id;

      const { token: adminToken } = await createAdmin(app, uniqueEmail('approveadmin'));

      const res = await request(app)
        .put(`/api/v1/campaigns/${campaignId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('active');

      const stored = await CampaignModel.findById(campaignId);
      expect(stored?.status).toBe('active');
    });

    it('rejects non-admin users with 403', async () => {
      const { userId: creatorId, token: creatorToken } = await registerUser(
        app,
        uniqueEmail('nonadmincreator')
      );
      await setVerificationLevel(creatorId, 2);

      const createRes = await request(app)
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${creatorToken}`)
        .send(campaignPayload({ title: 'Should Stay Pending' }));
      expect(createRes.status).toBe(201);
      const campaignId = createRes.body.data.id;

      const { token: regularToken } = await registerUser(app, uniqueEmail('regularuser'));

      const res = await request(app)
        .put(`/api/v1/campaigns/${campaignId}/approve`)
        .set('Authorization', `Bearer ${regularToken}`)
        .send({});

      expect(res.status).toBe(403);
    });
  });
});
