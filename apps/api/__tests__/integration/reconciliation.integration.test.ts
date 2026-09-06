import { randomUUID } from 'node:crypto';

const PAYSTACK_SECRET = 'sk_test_paystack_secret_for_reconciliation_tests';
process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_reconcile';
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

async function createActiveCampaign(app: Express, token: string, creatorId: string) {
  await UserModel.findByIdAndUpdate(creatorId, { verificationLevel: 2 });
  const res = await request(app)
    .post('/api/v1/campaigns')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Reconcile Campaign',
      description: 'Campaign for reconciliation tests',
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

async function openPendingIntent(app: Express, campaignId: string) {
  const res = await request(app)
    .post('/api/v1/donation-intents')
    .send({
      campaignId,
      amount: 200,
      tip: 20,
      provider: 'paystack',
      donorEmail: 'guest@example.com',
      donorName: 'Guest',
    })
    .expect(201);
  return {
    intentId: res.body.data.intent.id as string,
    reference: res.body.data.reference as string,
  };
}

/** Backdate an intent's updatedAt so it counts as "stale" (bypass timestamps). */
async function makeStale(intentId: string) {
  await DonationIntentModel.updateOne(
    { _id: intentId },
    { $set: { updatedAt: new Date(Date.now() - 60 * 60 * 1000) } },
    { timestamps: false }
  );
}

// Mock Paystack initialize (create PENDING) + verify (reconcile). `verify`
// controls what /transaction/verify/:ref returns.
function stubPaystack(verify: { status?: string; amount?: number; currency?: string } = {}) {
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
    if (u.includes('/transaction/verify/')) {
      const ref = decodeURIComponent(u.split('/transaction/verify/')[1] ?? '');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          data: {
            status: verify.status ?? 'success',
            reference: ref,
            amount: verify.amount ?? 22000, // GH₵220.00
            fees: 330,
            currency: verify.currency ?? 'GHS',
          },
        }),
      } as unknown as Response;
    }
    throw new Error(`unexpected fetch to ${u}`);
  });
  vi.stubGlobal('fetch', fetchMock);
}

describe('Reconciliation & admin payments (spec §13, §15)', () => {
  let app: Express;
  let adminToken: string;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
    const adminEmail = uniqueEmail('reconadmin');
    const admin = await registerUser(app, adminEmail);
    await UserModel.findByIdAndUpdate(admin.userId, { role: 'admin' });
    // Re-login so the JWT carries the admin role claim.
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'SecurePass123' })
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

  it('repairs a settlement missed by a dropped webhook, idempotently', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('recon1'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId, reference } = await openPendingIntent(app, campaignId);
    await makeStale(intentId);

    // Provider confirms success — reconciliation should settle it.
    const res = await request(app)
      .post('/api/v1/admin/reconciliation')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ olderThanMinutes: 30 })
      .expect(200);
    expect(res.body.data.repaired).toBeGreaterThanOrEqual(1);

    const intentDoc = await DonationIntentModel.findById(intentId);
    expect(intentDoc?.status).toBe('SUCCEEDED');
    expect(intentDoc?.providerRef).toBe(reference);
    const entries = await JournalEntryModel.find({ donationIntentId: intentId });
    expect(entries).toHaveLength(1);
    const campaignRes = await request(app).get(`/api/v1/campaigns/${campaignId}`);
    expect(campaignRes.body.data.raisedAmount).toBe(200);

    // Idempotent: it's no longer PENDING, so a second sweep can't re-credit.
    await request(app)
      .post('/api/v1/admin/reconciliation')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ olderThanMinutes: 30 })
      .expect(200);
    expect(await JournalEntryModel.find({ donationIntentId: intentId })).toHaveLength(1);
  });

  it('does NOT credit a provider/intent mismatch; flags it and leaves PENDING', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('recon2'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await openPendingIntent(app, campaignId);
    await makeStale(intentId);

    stubPaystack({ currency: 'USD' }); // provider reports a different currency
    await request(app)
      .post('/api/v1/admin/reconciliation')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ olderThanMinutes: 30 })
      .expect(200);

    const intentDoc = await DonationIntentModel.findById(intentId);
    expect(intentDoc?.status).toBe('PENDING');
    expect(await JournalEntryModel.findOne({ donationIntentId: intentId })).toBeNull();
  });

  it('marks an intent FAILED when the provider reports failure', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('recon3'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await openPendingIntent(app, campaignId);
    await makeStale(intentId);

    stubPaystack({ status: 'failed' });
    await request(app)
      .post(`/api/v1/admin/payments/${intentId}/reconcile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const intentDoc = await DonationIntentModel.findById(intentId);
    expect(intentDoc?.status).toBe('FAILED');
  });

  it('admin can search + trace a contribution end-to-end; non-admins are blocked', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('recon4'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId, reference } = await openPendingIntent(app, campaignId);

    // Search by provider reference.
    const search = await request(app)
      .get(`/api/v1/admin/payments?providerRef=${reference}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(search.body.data).toHaveLength(1);
    expect(search.body.data[0].id).toBe(intentId);

    // Trace: contribution + attempts, no raw provider payloads.
    const trace = await request(app)
      .get(`/api/v1/admin/payments/${intentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(trace.body.data.contribution.id).toBe(intentId);
    expect(Array.isArray(trace.body.data.attempts)).toBe(true);
    // The 'initiated' attempt from checkout should be present.
    expect(trace.body.data.attempts.length).toBeGreaterThanOrEqual(1);
    expect(trace.body.data.attempts[0]).not.toHaveProperty('raw');

    // A non-admin is forbidden.
    await request(app)
      .get(`/api/v1/admin/payments?providerRef=${reference}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
