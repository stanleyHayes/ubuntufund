import { createHmac, randomUUID } from 'node:crypto';

// Split-proceeds accrual runs only with the flag on; the Paystack rail reads its
// secret at app construction, so both MUST be set before createTestApp().
const PAYSTACK_SECRET = 'sk_test_split_accrual_secret';
process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_split_accrual_public';
process.env.PUBLIC_WEB_URL = 'https://give.example.test';
process.env.SPLIT_PROCEEDS_ENABLED = 'true';

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
import { CampaignBalanceModel } from '../../src/infrastructure/database/models/CampaignBalanceModel.js';
import { CampaignCategory, CampaignPriority } from '@ubuntu-fund/types';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

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

async function createActiveCampaign(app: Express, token: string, userId: string) {
  await UserModel.findByIdAndUpdate(userId, { verificationLevel: 2 });
  const res = await request(app)
    .post('/api/v1/campaigns')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Split Accrual Campaign',
      description: 'Proceeds shared 60/40 between two beneficiaries',
      goalAmount: 5000,
      currency: 'GHS',
      category: CampaignCategory.EDUCATION,
      priority: CampaignPriority.NORMAL,
      beneficiaries: [],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .expect(201);
  const campaignId = res.body.data.id as string;
  await CampaignModel.findByIdAndUpdate(campaignId, { status: 'active' });
  return campaignId;
}

async function fundCampaign(app: Express, campaignId: string, amount: number) {
  const checkout = await request(app)
    .post('/api/v1/donation-intents')
    .send({
      campaignId,
      amount,
      tip: 0,
      provider: 'paystack',
      donorEmail: 'donor@example.com',
      donorName: 'Donor',
      isAnonymous: false,
    })
    .expect(201);
  const reference = checkout.body.data.reference as string;
  const raw = JSON.stringify({
    event: 'charge.success',
    data: { reference, amount: amount * 100, fees: 0, currency: 'GHS', status: 'success' },
  });
  await request(app)
    .post('/api/v1/webhooks/paystack')
    .set('x-paystack-signature', sign(raw))
    .set('Content-Type', 'application/json')
    .send(raw)
    .expect(200);
}

describe('Split-proceeds accrual Integration (flag on, spec §17)', () => {
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
    // Stub the one Paystack call the donation-intent flow makes (hosted-checkout
    // init); the settlement webhook is posted directly, signed, with no fetch.
    const fetchMock = vi.fn(async (url: unknown, opts: unknown) => {
      const u = String(url);
      const body = (opts as { body?: string })?.body
        ? (JSON.parse((opts as { body: string }).body) as Record<string, unknown>)
        : {};
      if (u.includes('/transaction/initialize')) {
        const reference = body.reference as string;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: true,
            message: 'Authorization URL created',
            data: {
              authorization_url: `https://checkout.paystack.com/${reference}`,
              access_code: `acc_${reference}`,
              reference,
            },
          }),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch to ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('accrues a settled donation across the active split and locks it', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('acc-own'));
    const campaignId = await createActiveCampaign(app, token, userId);

    // Configure + activate a 60/40 split.
    const created = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        allocations: [
          { name: 'Ama', shareBps: 6000 },
          { name: 'Kofi', shareBps: 4000 },
        ],
      })
      .expect(201);
    const [ama, kofi] = created.body.data.allocations as { beneficiaryId: string }[];
    for (const b of [ama, kofi]) {
      await request(app)
        .post(`/api/v1/campaigns/${campaignId}/split/1/consent`)
        .set('Authorization', `Bearer ${token}`)
        .send({ beneficiaryId: b.beneficiaryId, status: 'accepted' })
        .expect(200);
    }
    await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split/1/activate`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(200);

    // A donation settles: net 965 (Free 3.5%) → 60/40 = 579 / 386.
    await fundCampaign(app, campaignId, 1000);

    // Campaign-level projection is unchanged (still tracks the full net).
    const campaignBalance = await CampaignBalanceModel.findOne({ campaignId });
    expect(campaignBalance?.pendingBalance).toBe(965);

    // Per-beneficiary buckets accrued exactly.
    const balancesRes = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/split/beneficiaries`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const byId = Object.fromEntries(
      (balancesRes.body.data as { beneficiaryId: string; pendingBalance: number }[]).map(
        (b) => [b.beneficiaryId, b.pendingBalance]
      )
    );
    expect(byId[ama.beneficiaryId]).toBe(579);
    expect(byId[kofi.beneficiaryId]).toBe(386);

    // The split locked on the first contribution.
    const disclosure = await request(app).get(`/api/v1/campaigns/${campaignId}/split`);
    expect(disclosure.body.data.locked).toBe(true);

    // Ama's statement shows the accrual line.
    const statement = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/split/beneficiaries/${ama.beneficiaryId}/statement`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(statement.body.data.balance.pendingBalance).toBe(579);
    expect(statement.body.data.entries).toHaveLength(1);
    expect(statement.body.data.entries[0]).toMatchObject({
      kind: 'accrual',
      amount: 579,
      splitVersion: 1,
    });
  });

  it('does not accrue when the campaign has no active split', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('acc-nosplit'));
    const campaignId = await createActiveCampaign(app, token, userId);
    await fundCampaign(app, campaignId, 1000);

    const balancesRes = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/split/beneficiaries`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(balancesRes.body.data).toHaveLength(0);
    // Campaign-level projection still works normally.
    const campaignBalance = await CampaignBalanceModel.findOne({ campaignId });
    expect(campaignBalance?.pendingBalance).toBe(965);
  });
});
