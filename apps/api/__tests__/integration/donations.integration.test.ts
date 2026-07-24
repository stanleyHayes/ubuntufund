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

async function registerUser(app: Express, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SecurePass123', name: 'Test User' })
    .expect(201);

  return { userId: res.body.data.user.id as string, token: res.body.data.tokens.accessToken as string };
}

/** Creates an active campaign directly, bypassing the KYC/admin-approval flow (covered separately in campaigns.integration.test.ts). */
async function createActiveCampaign(app: Express, creatorToken: string, creatorId: string) {
  await UserModel.findByIdAndUpdate(creatorId, { verificationLevel: 2 });

  const createRes = await request(app)
    .post('/api/v1/campaigns')
    .set('Authorization', `Bearer ${creatorToken}`)
    .send({
      title: 'Donation Campaign',
      description: 'A campaign to receive donations',
      goalAmount: 5000,
      currency: 'ZAR',
      category: CampaignCategory.EDUCATION,
      priority: CampaignPriority.NORMAL,
      beneficiaries: [],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .expect(201);

  const campaignId = createRes.body.data.id as string;
  await CampaignModel.findByIdAndUpdate(campaignId, { status: 'active' });
  return campaignId;
}

async function getWalletId(app: Express, token: string): Promise<string> {
  const res = await request(app)
    .get('/api/v1/wallets')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  return res.body.data[0].id as string;
}

describe('Donations Integration', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  it('deposits into a wallet, then donates to an active campaign, updating both balances', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(app, uniqueEmail('creator'));
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId);

    const { token: donorToken } = await registerUser(app, uniqueEmail('donor'));
    const walletId = await getWalletId(app, donorToken);

    const depositRes = await request(app)
      .post(`/api/v1/wallets/${walletId}/deposit`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ amount: 1000, currency: 'ZAR' });
    expect(depositRes.status).toBe(200);
    expect(depositRes.body.data.balance).toBe(1000);

    const donateRes = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/donate`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ amount: 500, currency: 'ZAR', message: 'Great cause!', isAnonymous: false });
    expect(donateRes.status).toBe(200);
    expect(donateRes.body.message).toBe('Donation successful');

    const campaignRes = await request(app).get(`/api/v1/campaigns/${campaignId}`);
    expect(campaignRes.body.data.raisedAmount).toBe(500);

    const walletRes = await request(app)
      .get(`/api/v1/wallets/${walletId}`)
      .set('Authorization', `Bearer ${donorToken}`);
    expect(walletRes.body.data.balance).toBe(500);

    // Insufficient balance: attempting to donate more than remains must fail
    // with 400 and leave both balances untouched.
    const failedDonate = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/donate`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ amount: 10000, currency: 'ZAR', isAnonymous: false });
    expect(failedDonate.status).toBe(400);
    expect(failedDonate.body.message).toBe('Insufficient wallet balance');

    const campaignAfterFailure = await request(app).get(`/api/v1/campaigns/${campaignId}`);
    expect(campaignAfterFailure.body.data.raisedAmount).toBe(500);

    const walletAfterFailure = await request(app)
      .get(`/api/v1/wallets/${walletId}`)
      .set('Authorization', `Bearer ${donorToken}`);
    expect(walletAfterFailure.body.data.balance).toBe(500);

    // The ledger should show both the deposit and the successful donation.
    const transactionsRes = await request(app)
      .get('/api/v1/wallets/transactions')
      .set('Authorization', `Bearer ${donorToken}`);
    expect(transactionsRes.status).toBe(200);
    const types = transactionsRes.body.data.map((t: { type: string }) => t.type);
    expect(types).toContain('deposit');
    expect(types).toContain('donation');
    expect(transactionsRes.body.data).toHaveLength(2);
  });

  it('rejects donation to a campaign that is not active', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(
      app,
      uniqueEmail('pendingcreator')
    );
    await UserModel.findByIdAndUpdate(creatorId, { verificationLevel: 2 });

    const createRes = await request(app)
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send({
        title: 'Still Pending Campaign',
        description: 'Not yet approved',
        goalAmount: 1000,
        currency: 'ZAR',
        category: CampaignCategory.EDUCATION,
        priority: CampaignPriority.NORMAL,
        beneficiaries: [],
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .expect(201);
    const campaignId = createRes.body.data.id;

    const { token: donorToken } = await registerUser(app, uniqueEmail('pendingdonor'));
    const walletId = await getWalletId(app, donorToken);
    await request(app)
      .post(`/api/v1/wallets/${walletId}/deposit`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ amount: 500, currency: 'ZAR' })
      .expect(200);

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/donate`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ amount: 100, currency: 'ZAR', isAnonymous: false });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Campaign is not accepting donations');
  });

  it('rejects donation without authentication', async () => {
    const res = await request(app)
      .post('/api/v1/campaigns/000000000000000000000000/donate')
      .send({ amount: 100, currency: 'ZAR', isAnonymous: false });

    expect(res.status).toBe(401);
  });
});
