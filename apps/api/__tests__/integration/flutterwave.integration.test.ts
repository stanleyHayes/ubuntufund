import { randomUUID } from 'node:crypto';

// The Flutterwave rail + its enable flag are read from config at app-construction
// time, so they MUST be set before createTestApp() lazily imports src/app.ts.
const FLW_SECRET = 'FLWSECK_TEST-flutterwave-secret-for-integration-tests';
const FLW_HASH = 'flw-webhook-secret-hash-for-tests';
process.env.FLUTTERWAVE_SECRET_KEY = FLW_SECRET;
process.env.FLUTTERWAVE_PUBLIC_KEY = 'FLWPUBK_TEST-public';
process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH = FLW_HASH;
process.env.PAYMENTS_FLUTTERWAVE_ENABLED = 'true';
process.env.PUBLIC_WEB_URL = 'https://give.example.test';

import { describe, it, beforeAll, afterAll, beforeEach, expect, vi } from 'vitest';
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
import { JournalEntryModel } from '../../src/infrastructure/database/models/JournalEntryModel.js';
import { DonationIntentModel } from '../../src/infrastructure/database/models/DonationIntentModel.js';
import { CampaignCategory, CampaignPriority } from '@ubuntu-fund/types';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

async function registerUser(app: Express, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SecurePass123', name: 'Test User' })
    .expect(201);
  return {
    userId: res.body.data.user.id as string,
    token: res.body.data.tokens.accessToken as string,
  };
}

async function createActiveCampaign(app: Express, creatorToken: string, creatorId: string) {
  await UserModel.findByIdAndUpdate(creatorId, { verificationLevel: 2 });
  const createRes = await request(app)
    .post('/api/v1/campaigns')
    .set('Authorization', `Bearer ${creatorToken}`)
    .send({
      title: 'Flutterwave Campaign',
      description: 'A campaign to receive Flutterwave donations',
      goalAmount: 5000,
      currency: 'GHS',
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

async function openFlutterwaveCheckout(app: Express, campaignId: string) {
  return request(app)
    .post('/api/v1/donation-intents')
    .send({
      campaignId,
      amount: 200,
      tip: 20,
      provider: 'flutterwave',
      donorEmail: 'guest@example.com',
      donorName: 'Generous Guest',
      isAnonymous: false,
    });
}

// Mock the two Flutterwave endpoints the flow touches. `verifiedAmount` /
// `verifiedCurrency` / `verifiedStatus` control what re-verification returns.
function stubFlutterwave(opts: {
  verifiedAmount?: number;
  verifiedCurrency?: string;
  verifiedStatus?: string;
} = {}) {
  const fetchMock = vi.fn(async (url: unknown, init: unknown) => {
    const u = String(url);
    if (u.includes('/payments')) {
      const body = JSON.parse((init as { body: string }).body) as { tx_ref: string };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          message: 'Hosted Link',
          data: { link: `https://checkout.flutterwave.com/${body.tx_ref}` },
        }),
      } as unknown as Response;
    }
    if (u.includes('/transactions/verify_by_reference')) {
      const txRef = decodeURIComponent(u.split('tx_ref=')[1] ?? '');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          data: {
            id: 998877,
            tx_ref: txRef,
            status: opts.verifiedStatus ?? 'successful',
            amount: opts.verifiedAmount ?? 220,
            currency: opts.verifiedCurrency ?? 'GHS',
            app_fee: 3.3,
          },
        }),
      } as unknown as Response;
    }
    throw new Error(`unexpected fetch to ${u}`);
  });
  vi.stubGlobal('fetch', fetchMock);
}

describe('Flutterwave Integration', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    stubFlutterwave();
  });

  it('opens a Flutterwave checkout: intent PENDING (provider flutterwave), returns a hosted link', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('flwc'));
    const campaignId = await createActiveCampaign(app, token, userId);

    const res = await openFlutterwaveCheckout(app, campaignId);
    expect(res.status).toBe(201);
    expect(res.body.data.intent.status).toBe('PENDING');
    expect(res.body.data.intent.provider).toBe('flutterwave');
    expect(typeof res.body.data.authorization_url).toBe('string');
    const reference = res.body.data.reference as string;
    expect(reference).toMatch(/^uf-/);

    const intentDoc = await DonationIntentModel.findById(res.body.data.intent.id);
    expect(intentDoc?.providerRef).toBe(reference);
  });

  it('rejects a webhook with an invalid verif-hash (401) and settles nothing', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('flwsig'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const created = await openFlutterwaveCheckout(app, campaignId);
    const reference = created.body.data.reference as string;
    const intentId = created.body.data.intent.id as string;

    const raw = JSON.stringify({ event: 'charge.completed', data: { tx_ref: reference } });
    const res = await request(app)
      .post('/api/v1/webhooks/flutterwave')
      .set('verif-hash', 'wrong-hash')
      .set('Content-Type', 'application/json')
      .send(raw);
    expect(res.status).toBe(401);

    const intentDoc = await DonationIntentModel.findById(intentId);
    expect(intentDoc?.status).toBe('PENDING');
    expect(await JournalEntryModel.findOne({ donationIntentId: intentId })).toBeNull();
  });

  it('settles on charge.completed after server re-verification: SUCCEEDED, ledger posted, raised projected', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('flwok'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const created = await openFlutterwaveCheckout(app, campaignId);
    const reference = created.body.data.reference as string;
    const intentId = created.body.data.intent.id as string;

    const raw = JSON.stringify({ event: 'charge.completed', data: { tx_ref: reference, status: 'successful' } });
    const res = await request(app)
      .post('/api/v1/webhooks/flutterwave')
      .set('verif-hash', FLW_HASH)
      .set('Content-Type', 'application/json')
      .send(raw);
    expect(res.status).toBe(200);

    const publicRes = await request(app).get(`/api/v1/donation-intents/${intentId}/public`);
    expect(publicRes.body.data.status).toBe('SUCCEEDED');
    const campaignRes = await request(app).get(`/api/v1/campaigns/${campaignId}`);
    expect(campaignRes.body.data.raisedAmount).toBe(200);
    expect(await JournalEntryModel.findOne({ donationIntentId: intentId })).not.toBeNull();

    const intentDoc = await DonationIntentModel.findById(intentId);
    expect(intentDoc?.settlementAmountMinor).toBe(22000);
    expect(intentDoc?.providerFeeMinor).toBe(330);
  });

  it('is idempotent: a duplicate charge.completed never double-settles', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('flwdup'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const created = await openFlutterwaveCheckout(app, campaignId);
    const reference = created.body.data.reference as string;
    const intentId = created.body.data.intent.id as string;

    const raw = JSON.stringify({ event: 'charge.completed', data: { tx_ref: reference } });
    for (let i = 0; i < 2; i++) {
      await request(app)
        .post('/api/v1/webhooks/flutterwave')
        .set('verif-hash', FLW_HASH)
        .set('Content-Type', 'application/json')
        .send(raw)
        .expect(200);
    }
    const entries = await JournalEntryModel.find({ donationIntentId: intentId });
    expect(entries).toHaveLength(1);
    const campaignRes = await request(app).get(`/api/v1/campaigns/${campaignId}`);
    expect(campaignRes.body.data.raisedAmount).toBe(200);
  });

  it('does NOT credit when re-verification reports a mismatched currency', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('flwmis'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const created = await openFlutterwaveCheckout(app, campaignId);
    const reference = created.body.data.reference as string;
    const intentId = created.body.data.intent.id as string;

    // Re-verification returns USD though the intent is GHS.
    stubFlutterwave({ verifiedCurrency: 'USD' });
    const raw = JSON.stringify({ event: 'charge.completed', data: { tx_ref: reference } });
    const res = await request(app)
      .post('/api/v1/webhooks/flutterwave')
      .set('verif-hash', FLW_HASH)
      .set('Content-Type', 'application/json')
      .send(raw);
    expect(res.status).toBe(200);

    const intentDoc = await DonationIntentModel.findById(intentId);
    expect(intentDoc?.status).toBe('PENDING');
    expect(await JournalEntryModel.findOne({ donationIntentId: intentId })).toBeNull();
  });
});
