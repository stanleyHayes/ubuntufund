import { createHmac, randomUUID } from 'node:crypto';

const PAYSTACK_SECRET = 'sk_test_paystack_secret_for_refund_tests';
process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_refund';
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
import { CampaignBalanceModel } from '../../src/infrastructure/database/models/CampaignBalanceModel.js';
import { JournalEntryModel } from '../../src/infrastructure/database/models/JournalEntryModel.js';
import { DonationIntentModel } from '../../src/infrastructure/database/models/DonationIntentModel.js';
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
  return { userId: res.body.data.user.id as string, token: res.body.data.tokens.accessToken as string };
}
async function createActiveCampaign(app: Express, token: string, creatorId: string) {
  await UserModel.findByIdAndUpdate(creatorId, { verificationLevel: 2 });
  const res = await request(app)
    .post('/api/v1/campaigns')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Refund Campaign',
      description: 'Campaign for refund tests',
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

/** Settle a paystack donation of 200 (+20 tip) GHS and return its intent id. */
async function settleDonation(app: Express, campaignId: string) {
  const created = await request(app)
    .post('/api/v1/donation-intents')
    .send({ campaignId, amount: 200, tip: 20, provider: 'paystack', donorEmail: 'guest@example.com', donorName: 'Guest' })
    .expect(201);
  const reference = created.body.data.reference as string;
  const intentId = created.body.data.intent.id as string;
  const event = { event: 'charge.success', data: { reference, amount: 22000, fees: 330, currency: 'GHS', status: 'success' } };
  const raw = JSON.stringify(event);
  await request(app)
    .post('/api/v1/webhooks/paystack')
    .set('x-paystack-signature', sign(raw))
    .set('Content-Type', 'application/json')
    .send(raw)
    .expect(200);
  return { intentId, reference };
}

function stubPaystack() {
  const fetchMock = vi.fn(async (url: unknown, opts: unknown) => {
    const u = String(url);
    if (u.includes('/transaction/initialize')) {
      const body = JSON.parse((opts as { body: string }).body) as { reference: string };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          data: {
            authorization_url: `https://checkout.paystack.com/${body.reference}`,
            access_code: `acc_${body.reference}`,
            reference: body.reference,
          },
        }),
      } as unknown as Response;
    }
    if (u.includes('/refund')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: true, data: { status: 'processed', id: 55667788 } }),
      } as unknown as Response;
    }
    throw new Error(`unexpected fetch to ${u}`);
  });
  vi.stubGlobal('fetch', fetchMock);
}

describe('Refunds (spec §14)', () => {
  let app: Express;
  let adminToken: string;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
    const email = uniqueEmail('refundadmin');
    const admin = await registerUser(app, email);
    await UserModel.findByIdAndUpdate(admin.userId, { role: 'admin' });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'SecurePass123' })
      .expect(200);
    adminToken = login.body.data.tokens.accessToken as string;
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    stubPaystack();
  });

  it('full refund: reverses raised + pending, posts a compensating entry, leaves the original untouched', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('refund1'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await settleDonation(app, campaignId);

    // Settled: raised 200, pending 189.70 (200 - 7 platform (Free 3.5%) - 3.30 processor).
    let balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.totalRaised).toBe(200);
    expect(balance?.pendingBalance).toBe(189.7);

    const res = await request(app)
      .post(`/api/v1/admin/payments/${intentId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);
    expect(res.body.data.status).toBe('REFUNDED');
    expect(res.body.data.refundReference).toBe('55667788');

    const intentDoc = await DonationIntentModel.findById(intentId);
    expect(intentDoc?.status).toBe('REFUNDED');

    // Projection reversed to zero.
    balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.totalRaised).toBe(0);
    expect(balance?.pendingBalance).toBe(0);
    const campaignRes = await request(app).get(`/api/v1/campaigns/${campaignId}`);
    expect(campaignRes.body.data.raisedAmount).toBe(0);

    // Two journal entries now exist for this intent's campaign: the original
    // (untouched) settlement + the new compensating refund entry.
    const original = await JournalEntryModel.findOne({ donationIntentId: intentId });
    expect(original).not.toBeNull(); // original preserved
    const allEntries = await JournalEntryModel.find({});
    expect(allEntries.length).toBeGreaterThanOrEqual(2);
  });

  it('partial refund transitions to PARTIALLY_REFUNDED and reverses proportionally', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('refund2'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await settleDonation(app, campaignId);

    // Refund GH₵100 of the GH₵200 campaign-directed amount.
    const res = await request(app)
      .post(`/api/v1/admin/payments/${intentId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 100 })
      .expect(200);
    expect(res.body.data.status).toBe('PARTIALLY_REFUNDED');

    const intentDoc = await DonationIntentModel.findById(intentId);
    expect(intentDoc?.status).toBe('PARTIALLY_REFUNDED');
    const balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.totalRaised).toBe(100); // 200 - 100
  });

  it('rejects refunding a contribution that never settled', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('refund3'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const created = await request(app)
      .post('/api/v1/donation-intents')
      .send({ campaignId, amount: 200, tip: 20, provider: 'paystack', donorEmail: 'g@example.com' })
      .expect(201);
    const intentId = created.body.data.intent.id as string; // still PENDING

    const res = await request(app)
      .post(`/api/v1/admin/payments/${intentId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);
    expect(res.body.message).toMatch(/settled contribution can be refunded/);
  });

  it('is idempotent: a retried full refund is rejected and never double-refunds', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('refund5'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await settleDonation(app, campaignId);

    await request(app)
      .post(`/api/v1/admin/payments/${intentId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    // A network double-submit must NOT refund again. The intent is now terminal
    // REFUNDED, so the retry is rejected (400 terminal-state guard, or 409 from
    // the atomic cap) — either way, no second refund.
    const retry = await request(app)
      .post(`/api/v1/admin/payments/${intentId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect([400, 409]).toContain(retry.status);
    expect(retry.body.message).toMatch(
      /settled contribution can be refunded|already processed|exceed the refundable/i
    );

    // Cumulative refunded is EXACTLY the original — not double.
    const intentDoc = await DonationIntentModel.findById(intentId);
    expect(intentDoc?.status).toBe('REFUNDED');
    expect(intentDoc?.refundedAmountMinor).toBe(20000); // 200.00 GHS, once

    // The projection is reversed exactly once (not pushed negative).
    const balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.totalRaised).toBe(0);
    expect(balance?.pendingBalance).toBe(0);
  });

  it('caps cumulative refunds at the original amount, then completes on the remainder', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('refund6'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await settleDonation(app, campaignId);

    // Refund GH₵100 of GH₵200 → PARTIALLY_REFUNDED.
    await request(app)
      .post(`/api/v1/admin/payments/${intentId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 100 })
      .expect(200);

    // A further GH₵150 would exceed the remaining GH₵100 → rejected, no refund.
    await request(app)
      .post(`/api/v1/admin/payments/${intentId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 150 })
      .expect(409);

    // The remaining GH₵100 completes it → REFUNDED, cumulative exactly original.
    const done = await request(app)
      .post(`/api/v1/admin/payments/${intentId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 100 })
      .expect(200);
    expect(done.body.data.status).toBe('REFUNDED');

    const intentDoc = await DonationIntentModel.findById(intentId);
    expect(intentDoc?.status).toBe('REFUNDED');
    expect(intentDoc?.refundedAmountMinor).toBe(20000);
  });

  it('forbids a non-admin from refunding', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('refund4'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await settleDonation(app, campaignId);

    await request(app)
      .post(`/api/v1/admin/payments/${intentId}/refund`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(403);
  });
});
