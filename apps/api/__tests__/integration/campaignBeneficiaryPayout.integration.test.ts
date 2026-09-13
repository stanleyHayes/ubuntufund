import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { createHmac, randomUUID } from 'node:crypto';

const PAYSTACK_SECRET = 'sk_test_beneficiary_payout_secret';
process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_beneficiary_payout_public';
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
import { CampaignBeneficiaryBalanceModel } from '../../src/infrastructure/database/models/CampaignBeneficiaryBalanceModel.js';
import { BeneficiaryRecipientModel } from '../../src/infrastructure/database/models/BeneficiaryRecipientModel.js';
import { BeneficiaryPayoutModel } from '../../src/infrastructure/database/models/BeneficiaryPayoutModel.js';
import { MongoBeneficiaryPayoutRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoBeneficiaryPayoutRepository.js';
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
    .send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email, password: 'SecurePass123', name: 'Test User' })
    .expect(201);
  return {
    userId: res.body.data.user.id as string,
    token: res.body.data.tokens.accessToken as string,
  };
}
async function createAdmin(app: Express, email: string) {
  const { userId } = await registerUser(app, email);
  await UserModel.findByIdAndUpdate(userId, { role: 'admin' });
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'SecurePass123' })
    .expect(200);
  return { userId, token: login.body.data.tokens.accessToken as string };
}
async function createActiveCampaign(app: Express, token: string, userId: string) {
  await UserModel.findByIdAndUpdate(userId, { verificationLevel: 2 });
  await SubscriptionModel.findOneAndUpdate({ userId }, { userId, tier: 'pro', status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 30 * 86400000) }, { upsert: true });
  const res = await request(app)
    .post('/api/v1/campaigns')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Beneficiary Payout Campaign',
      description: 'Split 60/40, paid per beneficiary',
      goalAmount: 5000,
      currency: 'GHS',
      category: CampaignCategory.EDUCATION,
      priority: CampaignPriority.NORMAL,
      beneficiaries: [],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .expect(201);
  const id = res.body.data.id as string;
  await CampaignModel.findByIdAndUpdate(id, { status: 'active' });
  return id;
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
      legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
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
function transferWebhook(app: Express, event: string, reference: string) {
  const raw = JSON.stringify({ event, data: { reference, status: event.split('.')[1] } });
  return request(app)
    .post('/api/v1/webhooks/paystack')
    .set('x-paystack-signature', sign(raw))
    .set('Content-Type', 'application/json')
    .send(raw);
}

describe('Beneficiary payout Integration (flag on, spec §17)', () => {
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
    const fetchMock = vi.fn(async (url: unknown, opts: unknown) => {
      const u = String(url);
      const body = (opts as { body?: string })?.body
        ? (JSON.parse((opts as { body: string }).body) as Record<string, unknown>)
        : {};
      const json = (payload: unknown) =>
        ({ ok: true, status: 200, json: async () => payload }) as unknown as Response;
      if (u.includes('/transaction/initialize')) {
        const reference = body.reference as string;
        return json({ status: true, data: { authorization_url: `x/${reference}`, access_code: `a_${reference}`, reference } });
      }
      if (u.includes('/transferrecipient')) {
        return json({ status: true, data: { recipient_code: `RCP_${randomUUID().slice(0, 8)}` } });
      }
      if (u.includes('/balance')) {
        return json({ status: true, data: [{ currency: 'GHS', balance: 100_000_000 }] });
      }
      if (u.includes('/transfer')) {
        const reference = body.reference as string;
        return json({ status: true, data: { transfer_code: `TRF_${randomUUID().slice(0, 8)}`, status: 'pending', reference } });
      }
      throw new Error(`unexpected fetch to ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  async function seedRequestBalances(campaignPending: number) {
    const owner = await registerUser(app, uniqueEmail('atomic-beneficiary'));
    const campaignId = await createActiveCampaign(app, owner.token, owner.userId);
    const beneficiaryId = randomUUID();
    await CampaignBeneficiaryBalanceModel.create({ campaignId, beneficiaryId, currency: 'GHS', pendingBalance: 100 });
    await CampaignBalanceModel.create({ campaignId, currency: 'GHS', pendingBalance: campaignPending, totalRaised: campaignPending });
    await BeneficiaryRecipientModel.create({ campaignId, beneficiaryId, currency: 'GHS', type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'Fixture Beneficiary', recipientCode: 'RCP_fixture', createdBy: owner.userId });
    const submit = (target: Express = app) => request(target)
      .post(`/api/v1/campaigns/${campaignId}/split/beneficiaries/${beneficiaryId}/payouts`)
      .set('Authorization', `Bearer ${owner.token}`).send({ amount: 60 });
    return { campaignId, beneficiaryId, submit };
  }

  it('rolls back beneficiary clearing when the campaign mirror is short', async () => {
    const { campaignId, beneficiaryId, submit } = await seedRequestBalances(20);
    await submit().expect(409);
    const beneficiary = await CampaignBeneficiaryBalanceModel.findOne({ campaignId, beneficiaryId });
    const campaign = await CampaignBalanceModel.findOne({ campaignId });
    expect(beneficiary?.pendingBalance).toBe(100);
    expect(beneficiary?.availableBalance).toBe(0);
    expect(campaign?.pendingBalance).toBe(20);
    expect(campaign?.availableBalance).toBe(0);
    expect(await BeneficiaryPayoutModel.countDocuments({ campaignId })).toBe(0);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('rolls back both cleared balances when saving the payout request fails', async () => {
    const { campaignId, beneficiaryId, submit } = await seedRequestBalances(100);
    const failure = vi.spyOn(MongoBeneficiaryPayoutRepository.prototype, 'create').mockRejectedValueOnce(new Error('injected request save failure'));
    try { await submit().expect(500); } finally { failure.mockRestore(); }
    const beneficiary = await CampaignBeneficiaryBalanceModel.findOne({ campaignId, beneficiaryId });
    const campaign = await CampaignBalanceModel.findOne({ campaignId });
    expect(beneficiary?.pendingBalance).toBe(100);
    expect(beneficiary?.availableBalance).toBe(0);
    expect(campaign?.pendingBalance).toBe(100);
    expect(campaign?.availableBalance).toBe(0);
    expect(await BeneficiaryPayoutModel.countDocuments({ campaignId })).toBe(0);
    // A fresh API instance can submit normally after the failed transaction.
    const resumed = await createTestApp();
    await submit(resumed).expect(201);
    expect((await CampaignBalanceModel.findOne({ campaignId }))?.availableBalance).toBe(60);
    expect((await CampaignBeneficiaryBalanceModel.findOne({ campaignId, beneficiaryId }))?.availableBalance).toBe(60);
  });

  it('keeps both balance mirrors equal under concurrent beneficiary requests', async () => {
    const { campaignId, beneficiaryId, submit } = await seedRequestBalances(100);
    const responses = await Promise.all([submit(), submit()]);
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    const beneficiary = await CampaignBeneficiaryBalanceModel.findOne({ campaignId, beneficiaryId });
    const campaign = await CampaignBalanceModel.findOne({ campaignId });
    // Requests do not reserve twice; approval is responsible for reserving the
    // available balance. Both requests can exist but cannot both pay GHS 60.
    expect(beneficiary?.pendingBalance).toBe(40);
    expect(beneficiary?.availableBalance).toBe(60);
    expect(campaign?.pendingBalance).toBe(40);
    expect(campaign?.availableBalance).toBe(60);
    expect(await BeneficiaryPayoutModel.countDocuments({ campaignId })).toBe(2);
  });

  it.each(['success', 'mirror_short', 'processing_failure', 'staff_revoked', 'kyc_revoked', 'destination_changed', 'account_changed', 'wrong_currency'])('beneficiary reservation and processing commit together: %s', async (scenario) => {
    const owner = await registerUser(app, uniqueEmail('bp-own'));
    const admin = await createAdmin(app, uniqueEmail('bp-admin'));
    const campaignId = await createActiveCampaign(app, owner.token, owner.userId);

    // Activate a 60/40 split.
    const created = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ allocations: [{ name: 'Ama', shareBps: 6000 }, { name: 'Kofi', shareBps: 4000 }] })
      .expect(201);
    const [ama, kofi] = created.body.data.allocations as { beneficiaryId: string }[];
    for (const b of [ama, kofi]) {
      await request(app)
        .post(`/api/v1/campaigns/${campaignId}/split/1/consent`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ beneficiaryId: b.beneficiaryId, status: 'accepted' })
        .expect(200);
    }
    await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split/1/activate`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({})
      .expect(200);

    // Fund → Ama accrues 585, Kofi 390.
    await fundCampaign(app, campaignId, 1000);

    // Owner registers Ama's payout recipient; admin verifies KYC.
    await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split/beneficiaries/${ama.beneficiaryId}/recipient`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'Ama' })
      .expect(201);
    await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split/beneficiaries/${ama.beneficiaryId}/verify-kyc`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(200);

    // Approval before KYC would fail — but here KYC is done. Request Ama's payout.
    const reqRes = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split/beneficiaries/${ama.beneficiaryId}/payouts`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ amount: 585 });
    expect(reqRes.status).toBe(201);
    expect(reqRes.body.data.status).toBe('PENDING');
    const payoutId = reqRes.body.data.id as string;

    if (scenario === 'wrong_currency') await BeneficiaryRecipientModel.updateOne({ campaignId, beneficiaryId: ama.beneficiaryId }, { currency: 'USD' });
    if (['staff_revoked', 'kyc_revoked', 'destination_changed', 'account_changed', 'wrong_currency'].includes(scenario)) {
      const before = await CampaignBeneficiaryBalanceModel.findOne({ campaignId, beneficiaryId: ama.beneficiaryId });
      const aggregate = await CampaignBalanceModel.findOne({ campaignId });
      const gateway = vi.mocked(fetch).getMockImplementation()!;
      vi.mocked(fetch).mockClear();
      vi.mocked(fetch).mockImplementation(async (...args) => {
        if (String(args[0]).includes('/balance')) {
          if (scenario === 'staff_revoked') await UserModel.updateOne({ _id: admin.userId }, { authVersion: 'revoked-during-lookup' });
          else await BeneficiaryRecipientModel.updateOne({ campaignId, beneficiaryId: ama.beneficiaryId }, scenario === 'kyc_revoked' ? { kycVerified: false } : scenario === 'destination_changed' ? { recipientCode: 'changed' } : { accountNumber: 'different' });
        }
        return gateway(...args);
      });
      await request(app).post(`/api/v1/beneficiary-payouts/${payoutId}/approve`).set('Authorization', `Bearer ${admin.token}`).send({}).expect(scenario === 'staff_revoked' ? 403 : 409);
      expect((await BeneficiaryPayoutModel.findById(payoutId))?.status).toBe('PENDING');
      expect((await CampaignBeneficiaryBalanceModel.findOne({ campaignId, beneficiaryId: ama.beneficiaryId }))?.availableBalance).toBe(before?.availableBalance);
      expect((await CampaignBalanceModel.findOne({ campaignId }))?.availableBalance).toBe(aggregate?.availableBalance);
      expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/transfer'))).toBe(false);
      return;
    }

    if (scenario !== 'success') {
      if (scenario === 'mirror_short') await CampaignBalanceModel.updateOne({ campaignId }, { availableBalance: 0 });
      const before = await CampaignBeneficiaryBalanceModel.findOne({ campaignId, beneficiaryId: ama.beneficiaryId });
      const aggregate = await CampaignBalanceModel.findOne({ campaignId });
      const original = MongoBeneficiaryPayoutRepository.prototype.transitionToProcessing;
      const hook = scenario === 'processing_failure' ? vi.spyOn(MongoBeneficiaryPayoutRepository.prototype, 'transitionToProcessing').mockImplementation(async function(...args) {
        await original.apply(this, args);
        throw new Error('Injected failure after processing write');
      }) : undefined;
      vi.mocked(fetch).mockClear();
      try {
        await request(app).post(`/api/v1/beneficiary-payouts/${payoutId}/approve`).set('Authorization', `Bearer ${admin.token}`).send({}).expect(scenario === 'mirror_short' ? 409 : 500);
        const after = await CampaignBeneficiaryBalanceModel.findOne({ campaignId, beneficiaryId: ama.beneficiaryId });
        const aggregateAfter = await CampaignBalanceModel.findOne({ campaignId });
        expect(after?.availableBalance).toBe(before?.availableBalance);
        expect(after?.pendingBalance).toBe(before?.pendingBalance);
        expect(aggregateAfter?.availableBalance).toBe(aggregate?.availableBalance);
        expect(aggregateAfter?.paidOutBalance).toBe(aggregate?.paidOutBalance);
        const failed = await BeneficiaryPayoutModel.findById(payoutId);
        expect(failed?.status).toBe('PENDING');
        expect(failed?.providerRef).toBeUndefined();
        expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/transfer'))).toBe(false);
      } finally { hook?.mockRestore(); }
      return;
    }

    const gateway = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (...args) => {
      if (String(args[0]).endsWith('/transfer')) {
        const saved = await BeneficiaryPayoutModel.collection.findOne({ campaignId, beneficiaryId: ama.beneficiaryId, status: 'PROCESSING' }, { session: null });
        expect(saved?.providerRef).toMatch(/^bpay-/);
        const share = await CampaignBeneficiaryBalanceModel.collection.findOne({ campaignId, beneficiaryId: ama.beneficiaryId }, { session: null });
        expect(share?.availableBalance).toBe(0);
      }
      return gateway(...args);
    });

    // Admin approves → transfer initiated.
    const approve = await request(app)
      .post(`/api/v1/beneficiary-payouts/${payoutId}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe('PROCESSING');
    const reference = approve.body.data.providerRef as string;
    expect(reference).toMatch(/^bpay-/);

    // transfer.success settles Ama's payout.
    await transferWebhook(app, 'transfer.success', reference).expect(200);

    // Ama's statement: fully paid out.
    const statement = await request(app)
      .get(`/api/v1/campaigns/${campaignId}/split/beneficiaries/${ama.beneficiaryId}/statement`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(statement.body.data.balance.paidOutBalance).toBe(585);
    expect(statement.body.data.balance.pendingBalance).toBe(0);
    expect(statement.body.data.balance.availableBalance).toBe(0);

    // Campaign aggregate mirrored: 585 paid out, Kofi's 390 still pending.
    const campaignBalance = await CampaignBalanceModel.findOne({ campaignId });
    expect(campaignBalance?.paidOutBalance).toBe(585);
    expect(campaignBalance?.pendingBalance).toBe(390);
    expect(campaignBalance?.availableBalance).toBe(0);
  });

  it('rejects approval when the beneficiary KYC is not verified', async () => {
    const owner = await registerUser(app, uniqueEmail('bp-nokyc-own'));
    const admin = await createAdmin(app, uniqueEmail('bp-nokyc-admin'));
    const campaignId = await createActiveCampaign(app, owner.token, owner.userId);
    const created = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ allocations: [{ name: 'Ama', shareBps: 6000 }, { name: 'Kofi', shareBps: 4000 }] })
      .expect(201);
    const [ama, kofi] = created.body.data.allocations as { beneficiaryId: string }[];
    for (const b of [ama, kofi]) {
      await request(app)
        .post(`/api/v1/campaigns/${campaignId}/split/1/consent`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ beneficiaryId: b.beneficiaryId, status: 'accepted' })
        .expect(200);
    }
    await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split/1/activate`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({})
      .expect(200);
    await fundCampaign(app, campaignId, 1000);
    await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split/beneficiaries/${ama.beneficiaryId}/recipient`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'Ama' })
      .expect(201);
    const reqRes = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split/beneficiaries/${ama.beneficiaryId}/payouts`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ amount: 585 })
      .expect(201);

    // Admin operability: the pending payout appears in the global list + queue.
    const all = await request(app)
      .get('/api/v1/beneficiary-payouts')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(all.body.data.some((p: { id: string }) => p.id === reqRes.body.data.id)).toBe(true);
    const queue = await request(app)
      .get('/api/v1/beneficiary-payouts/review-queue')
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);
    expect(queue.body.data.some((p: { id: string }) => p.id === reqRes.body.data.id)).toBe(true);
    // A non-admin cannot list them.
    await request(app)
      .get('/api/v1/beneficiary-payouts')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(403);

    // No KYC verification → approval is refused.
    const approve = await request(app)
      .post(`/api/v1/beneficiary-payouts/${reqRes.body.data.id}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(approve.status).toBe(422);
  });

  it('blocks a campaign-level payout on a split campaign', async () => {
    const owner = await registerUser(app, uniqueEmail('bp-block-own'));
    const campaignId = await createActiveCampaign(app, owner.token, owner.userId);
    const created = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ allocations: [{ name: 'Ama', shareBps: 6000 }, { name: 'Kofi', shareBps: 4000 }] })
      .expect(201);
    for (const b of created.body.data.allocations as { beneficiaryId: string }[]) {
      await request(app)
        .post(`/api/v1/campaigns/${campaignId}/split/1/consent`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ beneficiaryId: b.beneficiaryId, status: 'accepted' })
        .expect(200);
    }
    await request(app)
      .post(`/api/v1/campaigns/${campaignId}/split/1/activate`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({})
      .expect(200);
    await fundCampaign(app, campaignId, 1000);

    // Register a campaign-level recipient, then a campaign payout is blocked.
    await request(app)
      .post(`/api/v1/campaigns/${campaignId}/payout-recipient`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'Owner' })
      .expect(201);
    const res = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/payouts`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ amount: 500 });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/per-beneficiary/i);
  });
});
