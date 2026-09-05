import { createHmac, randomUUID } from 'node:crypto';

// The Paystack rail reads its secret from config at app-construction time, so
// it MUST be set before createTestApp() (which lazily imports src/app.ts) runs.
// Static imports below do not pull in config, so a top-level assignment here is
// evaluated in time. This key also signs the webhook fixtures.
const PAYSTACK_SECRET = 'sk_test_paystack_secret_for_integration_tests';
process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_paystack_public_for_integration_tests';
process.env.PUBLIC_WEB_URL = 'https://give.example.test';

import {
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  expect,
  vi,
} from 'vitest';
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
import { CampaignBalanceModel } from '../../src/infrastructure/database/models/CampaignBalanceModel.js';
import { JournalEntryModel } from '../../src/infrastructure/database/models/JournalEntryModel.js';
import { JournalLineModel } from '../../src/infrastructure/database/models/JournalLineModel.js';
import { DonationIntentModel } from '../../src/infrastructure/database/models/DonationIntentModel.js';
import { CampaignCategory, CampaignPriority } from '@ubuntu-fund/types';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

/** HMAC-SHA512 the raw body exactly as Paystack does, using the secret above. */
function sign(rawBody: string): string {
  return createHmac('sha512', PAYSTACK_SECRET).update(rawBody).digest('hex');
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
      title: 'Paystack Campaign',
      description: 'A campaign to receive Paystack donations',
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

/**
 * Open a guest Paystack checkout and return the created intent id + the
 * provider reference the webhook will later settle against.
 */
async function openPaystackCheckout(
  app: Express,
  campaignId: string,
  overrides: { amount?: number; tip?: number; donorEmail?: string } = {}
) {
  const res = await request(app)
    .post('/api/v1/donation-intents')
    .send({
      campaignId,
      amount: overrides.amount ?? 200,
      tip: overrides.tip ?? 20,
      provider: 'paystack',
      donorEmail: overrides.donorEmail ?? 'guest@example.com',
      donorName: 'Generous Guest',
      isAnonymous: false,
    });
  return res;
}

describe('Paystack Integration', () => {
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
    // Mock Paystack's transaction/initialize: echo back the reference we sent,
    // so the intent's providerRef correlates the later webhook. No real network.
    const fetchMock = vi.fn(async (url: unknown, opts: unknown) => {
      const u = String(url);
      if (u.includes('/transaction/initialize')) {
        const body = JSON.parse((opts as { body: string }).body) as {
          reference: string;
        };
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: true,
            message: 'Authorization URL created',
            data: {
              authorization_url: `https://checkout.paystack.com/${body.reference}`,
              access_code: `acc_${body.reference}`,
              reference: body.reference,
            },
          }),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch to ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('opens a Paystack checkout: intent PENDING, returns authorization_url + reference', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(app, uniqueEmail('psc'));
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId);

    const res = await openPaystackCheckout(app, campaignId);
    expect(res.status).toBe(201);

    // Hosted-checkout handoff shape: { intent, authorization_url, access_code, reference }.
    expect(res.body.data.intent.status).toBe('PENDING');
    expect(res.body.data.intent.provider).toBe('paystack');
    expect(typeof res.body.data.authorization_url).toBe('string');
    expect(typeof res.body.data.access_code).toBe('string');
    const reference = res.body.data.reference as string;
    expect(reference).toMatch(/^uf-/);

    // Intent persisted as PENDING with the reference stored as providerRef.
    const intentId = res.body.data.intent.id as string;
    const intentDoc = await DonationIntentModel.findById(intentId);
    expect(intentDoc?.status).toBe('PENDING');
    expect(intentDoc?.providerRef).toBe(reference);

    // Nothing settled yet: no ledger entry, raised untouched.
    const entry = await JournalEntryModel.findOne({ donationIntentId: intentId });
    expect(entry).toBeNull();
    const campaignRes = await request(app).get(`/api/v1/campaigns/${campaignId}`);
    expect(campaignRes.body.data.raisedAmount).toBe(0);
  });

  it('requires an email before initializing a Paystack checkout', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(app, uniqueEmail('psemail'));
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId);

    const res = await request(app)
      .post('/api/v1/donation-intents')
      .send({ campaignId, amount: 100, provider: 'paystack', isAnonymous: false });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('An email is required to pay with Paystack');
  });

  it('rejects a webhook with an invalid signature (401) and settles nothing', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(app, uniqueEmail('pssig'));
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId);
    const created = await openPaystackCheckout(app, campaignId);
    const reference = created.body.data.reference as string;
    const intentId = created.body.data.intent.id as string;

    const event = {
      event: 'charge.success',
      data: { reference, amount: 22000, fees: 330, currency: 'GHS', status: 'success' },
    };
    const raw = JSON.stringify(event);

    const res = await request(app)
      .post('/api/v1/webhooks/paystack')
      .set('x-paystack-signature', 'deadbeef-not-a-valid-signature')
      .set('Content-Type', 'application/json')
      .send(raw);
    expect(res.status).toBe(401);

    // Intent untouched (still PENDING); nothing settled.
    const intentDoc = await DonationIntentModel.findById(intentId);
    expect(intentDoc?.status).toBe('PENDING');
    const entry = await JournalEntryModel.findOne({ donationIntentId: intentId });
    expect(entry).toBeNull();
  });

  it('rejects a webhook with a missing signature (401)', async () => {
    const event = { event: 'charge.success', data: { reference: 'uf-none', amount: 1000 } };
    const raw = JSON.stringify(event);
    const res = await request(app)
      .post('/api/v1/webhooks/paystack')
      .set('Content-Type', 'application/json')
      .send(raw);
    expect(res.status).toBe(401);
  });

  it('settles on charge.success: intent SUCCEEDED, balanced ledger posted, raised + balance projected', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(app, uniqueEmail('psok'));
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId);
    const created = await openPaystackCheckout(app, campaignId, { amount: 200, tip: 20 });
    const reference = created.body.data.reference as string;
    const intentId = created.body.data.intent.id as string;

    // Paystack charged gross 220.00 (22000 pesewas) with a 3.30 processor fee.
    const event = {
      event: 'charge.success',
      data: { reference, amount: 22000, fees: 330, currency: 'GHS', status: 'success' },
    };
    const raw = JSON.stringify(event);
    const res = await request(app)
      .post('/api/v1/webhooks/paystack')
      .set('x-paystack-signature', sign(raw))
      .set('Content-Type', 'application/json')
      .send(raw);
    expect(res.status).toBe(200);

    // Intent settled.
    const publicRes = await request(app).get(`/api/v1/donation-intents/${intentId}/public`);
    expect(publicRes.body.data.status).toBe('SUCCEEDED');

    // Campaign raised projected from the campaign-directed amount (tip excluded).
    const campaignRes = await request(app).get(`/api/v1/campaigns/${campaignId}`);
    expect(campaignRes.body.data.raisedAmount).toBe(200);

    // Balanced, immutable journal entry recorded for the intent.
    const entry = await JournalEntryModel.findOne({ donationIntentId: intentId });
    expect(entry).not.toBeNull();
    const lines = await JournalLineModel.find({ journalEntryId: entry!._id!.toString() });
    const debits = lines.filter((l) => l.direction === 'debit').reduce((s, l) => s + l.amount, 0);
    const credits = lines.filter((l) => l.direction === 'credit').reduce((s, l) => s + l.amount, 0);
    expect(Math.round(debits * 100) / 100).toBe(Math.round(credits * 100) / 100);
    const campaignDebit = lines.find((l) => l.accountKind === 'campaign' && l.direction === 'debit');
    expect(campaignDebit?.amount).toBe(200);
    const processorCredit = lines.find((l) => l.accountKind === 'processor_fee');
    expect(processorCredit?.amount).toBe(3.3);

    // Balance read model: beneficiary-net pending, processor fee + tip tracked.
    // The creator is on the Free plan (5% platform fee).
    const balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.totalRaised).toBe(200);
    expect(balance?.pendingBalance).toBe(186.7); // 200 - 3.30 processor - 10.00 platform (Free 5%)
    expect(balance?.processorFees).toBe(3.3);
    expect(balance?.platformFees).toBe(10);
    expect(balance?.tips).toBe(20);
  });

  it('is idempotent: a duplicate charge.success reference never double-settles', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(app, uniqueEmail('psdup'));
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId);
    const created = await openPaystackCheckout(app, campaignId, { amount: 150, tip: 0 });
    const reference = created.body.data.reference as string;
    const intentId = created.body.data.intent.id as string;

    const event = {
      event: 'charge.success',
      data: { reference, amount: 15000, fees: 200, currency: 'GHS', status: 'success' },
    };
    const raw = JSON.stringify(event);
    const signature = sign(raw);

    const first = await request(app)
      .post('/api/v1/webhooks/paystack')
      .set('x-paystack-signature', signature)
      .set('Content-Type', 'application/json')
      .send(raw);
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/v1/webhooks/paystack')
      .set('x-paystack-signature', signature)
      .set('Content-Type', 'application/json')
      .send(raw);
    expect(second.status).toBe(200);

    // Exactly one ledger entry, raised credited exactly once.
    const entries = await JournalEntryModel.find({ donationIntentId: intentId });
    expect(entries).toHaveLength(1);
    const campaignRes = await request(app).get(`/api/v1/campaigns/${campaignId}`);
    expect(campaignRes.body.data.raisedAmount).toBe(150);
    const balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.totalRaised).toBe(150);
  });

  it('acknowledges (200) a signed webhook for an unknown reference without settling', async () => {
    const event = {
      event: 'charge.success',
      data: { reference: `uf-unknown-${randomUUID()}`, amount: 5000, fees: 100, currency: 'GHS' },
    };
    const raw = JSON.stringify(event);
    const res = await request(app)
      .post('/api/v1/webhooks/paystack')
      .set('x-paystack-signature', sign(raw))
      .set('Content-Type', 'application/json')
      .send(raw);
    expect(res.status).toBe(200);
  });

  it('marks the intent FAILED on charge.failed', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(app, uniqueEmail('psfail'));
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId);
    const created = await openPaystackCheckout(app, campaignId);
    const reference = created.body.data.reference as string;
    const intentId = created.body.data.intent.id as string;

    const event = {
      event: 'charge.failed',
      data: { reference, amount: 22000, currency: 'GHS', status: 'failed' },
    };
    const raw = JSON.stringify(event);
    const res = await request(app)
      .post('/api/v1/webhooks/paystack')
      .set('x-paystack-signature', sign(raw))
      .set('Content-Type', 'application/json')
      .send(raw);
    expect(res.status).toBe(200);

    const intentDoc = await DonationIntentModel.findById(intentId);
    expect(intentDoc?.status).toBe('FAILED');
    const entry = await JournalEntryModel.findOne({ donationIntentId: intentId });
    expect(entry).toBeNull();
  });
});
