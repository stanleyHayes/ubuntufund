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
import { RefundOperationModel } from '../../src/infrastructure/database/models/RefundOperationModel.js';
import { MongoDonationIntentRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.js';
import { MongoRefundOperationRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoRefundOperationRepository.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { CampaignBalanceModel } from '../../src/infrastructure/database/models/CampaignBalanceModel.js';
import { CampaignBeneficiaryBalanceModel } from '../../src/infrastructure/database/models/CampaignBeneficiaryBalanceModel.js';
import { CampaignBeneficiaryAccrualModel } from '../../src/infrastructure/database/models/CampaignBeneficiaryAccrualModel.js';
import { MongoCampaignBalanceRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignBalanceRepository.js';
import { MongoRefundFunds } from '../../src/infrastructure/adapters/outbound/persistence/MongoRefundFunds.js';
import { MongoCampaignBeneficiaryBalanceRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignBeneficiaryBalanceRepository.js';
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
    .send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email, password: 'SecurePass123', name: 'Test User' })
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
    .send({ campaignId, amount: 200, tip: 20, provider: 'paystack', donorEmail: 'guest@example.com', donorName: 'Guest', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } })
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

let refundStatus = 'processed';
let refundThrows = false;
let refundGate: Promise<void> | undefined;
let nextRefundId = 55667788;
const refundReceipts = new Map<string, Record<string, unknown>>();
let refundReceiptOverride: Record<string, unknown> = {};
let refundVerifyHttpStatus = 200;
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
    if (u.includes('/transaction/verify/')) {
      const reference = decodeURIComponent(u.split('/transaction/verify/')[1]);
      return { ok: true, status: 200, json: async () => ({ status: true, data: { id: 123456, reference, status: 'success', amount: 22000, currency: 'GHS', fees: 330 } }) } as Response;
    }
    if (/\/refund\/\d+$/.test(u)) {
      const id = u.split('/').pop()!;
      return { ok: refundVerifyHttpStatus === 200, status: refundVerifyHttpStatus, json: async () => ({ status: true, data: { ...refundReceipts.get(id), ...refundReceiptOverride } }) } as Response;
    }
    if (u.includes('/refund')) {
      if (refundGate) await refundGate;
      if (refundThrows) throw new Error('simulated provider timeout');
      const refundId = nextRefundId++;
      const body = JSON.parse((opts as { body: string }).body);
      refundReceipts.set(String(refundId), { id: refundId, status: refundStatus, amount: body.amount, currency: 'GHS', transaction: 123456, merchant_note: body.merchant_note });
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: true, data: { status: refundStatus, id: refundId } }),
      } as unknown as Response;
    }
    throw new Error(`unexpected fetch to ${u}`);
  });
  vi.stubGlobal('fetch', fetchMock);
}

function providerRefundBodies(): Array<{ transaction: string; amount?: number }> {
  return vi.mocked(fetch).mock.calls
    .filter(([url, options]) => String(url).endsWith('/refund') && options?.method === 'POST')
    .map(([, options]) => JSON.parse(String(options?.body)));
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
    refundStatus = 'processed'; refundThrows = false; refundGate = undefined; refundReceiptOverride = {}; refundVerifyHttpStatus = 200;
    stubPaystack();
  });

  it('full refund: reverses raised + pending, posts a compensating entry, leaves the original untouched', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('refund1'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await settleDonation(app, campaignId);
    const originalBefore = await JournalEntryModel.findOne({ donationIntentId: intentId }).lean();

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
    // Charged 220 GHS including the separate platform tip; only the 200 GHS
    // campaign contribution is represented by this refund's local reversal.
    expect(providerRefundBodies()).toEqual([expect.objectContaining({ amount: 20000 })]);

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
    expect(original?.toObject()).toEqual(originalBefore);
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
    expect(providerRefundBodies()).toEqual([expect.objectContaining({ amount: 10000 })]);

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

  it('rejects malformed amounts instead of treating them as a full refund', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('refund-invalid'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await settleDonation(app, campaignId);
    for (const amount of ['100', null, {}, 0, -1]) {
      await request(app).post(`/api/v1/admin/payments/${intentId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`).send({ amount }).expect(400);
    }
    await request(app).post(`/api/v1/admin/payments/${intentId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`).set('Idempotency-Key', 'x'.repeat(201))
      .send({ amount: 10 }).expect(400);
    expect(providerRefundBodies()).toHaveLength(0);
    const intent = await DonationIntentModel.findById(intentId);
    expect(intent?.status).toBe('SUCCEEDED');
    expect(intent?.refundedAmountMinor ?? 0).toBe(0);
    expect((await CampaignBalanceModel.findOne({ campaignId }))?.pendingBalance).toBe(189.7);
  });

  it('requires manual handling for different charge and settlement currencies before reserving or moving funds', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('refund-fx'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await settleDonation(app, campaignId);
    await DonationIntentModel.findByIdAndUpdate(intentId, { settlementCurrency: 'USD' });
    const response = await request(app).post(`/api/v1/admin/payments/${intentId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`).send({}).expect(409);
    expect(response.body.message).toContain('currency conversion');
    expect(providerRefundBodies()).toHaveLength(0);
    const intent = await DonationIntentModel.findById(intentId);
    expect(intent?.status).toBe('SUCCEEDED');
    expect(intent?.refundedAmountMinor ?? 0).toBe(0);
    expect((await CampaignBalanceModel.findOne({ campaignId }))?.pendingBalance).toBe(189.7);
  });

  it('retains a durable reservation after a timeout and blocks new keys across a fresh app instance', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('refund-timeout'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await settleDonation(app, campaignId);
    refundThrows = true;
    const response = await request(app).post(`/api/v1/admin/payments/${intentId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`).send({ amount: 100, idempotencyKey: 'timeout-attempt' }).expect(202);
    expect(response.body.data.status).toBe('PENDING_REVIEW');
    const operation = await RefundOperationModel.findById(response.body.data.operationId);
    expect(operation?.state).toBe('provider_unknown');
    expect(operation?.active).toBe(true);
    expect(operation?.amountMinor).toBe(10000);
    const restarted = await createTestApp();
    await request(restarted).post(`/api/v1/admin/payments/${intentId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`).send({ amount: 50, idempotencyKey: 'different-key' }).expect(409);
    await request(restarted).post(`/api/v1/admin/refund-operations/${operation!._id}/retry-accounting`)
      .set('Authorization', `Bearer ${adminToken}`).send({}).expect(409);
    expect(providerRefundBodies()).toHaveLength(1);
    expect((await DonationIntentModel.findById(intentId))?.refundedAmountMinor).toBe(10000);
    expect((await CampaignBalanceModel.findOne({ campaignId }))?.pendingBalance).toBe(94.85);
  });

  it('does not reserve or contact the provider if durable attempt creation fails', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('refund-record-failure'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await settleDonation(app, campaignId);
    const failure = vi.spyOn(MongoRefundOperationRepository.prototype, 'create').mockRejectedValueOnce(new Error('injected attempt write failure'));
    try {
      await request(app).post(`/api/v1/admin/payments/${intentId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`).send({}).expect(500);
    } finally { failure.mockRestore(); }
    expect(providerRefundBodies()).toHaveLength(0);
    expect(await RefundOperationModel.countDocuments({ intentId })).toBe(0);
    expect((await DonationIntentModel.findById(intentId))?.refundedAmountMinor ?? 0).toBe(0);
    const balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.pendingBalance).toBe(189.7);
    expect(balance?.refundHolds).toEqual([]);
  });

  it('holds campaign and beneficiary funds while pending and consumes each hold once on verified completion', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('refund-funds-held'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await settleDonation(app, campaignId);
    const beneficiaryId = randomUUID();
    await CampaignBeneficiaryAccrualModel.create({ campaignId, donationIntentId: intentId, splitVersion: 1, currency: 'GHS', entries: [{ beneficiaryId, amount: 189.7 }] });
    await CampaignBeneficiaryBalanceModel.create({ campaignId, beneficiaryId, currency: 'GHS', pendingBalance: 189.7 });
    refundStatus = 'pending';
    const response = await request(app).post(`/api/v1/admin/payments/${intentId}/refund`).set('Authorization', `Bearer ${adminToken}`).send({}).expect(202);
    const operationId = response.body.data.operationId;
    const campaignBalances = new MongoCampaignBalanceRepository();
    const beneficiaryBalances = new MongoCampaignBeneficiaryBalanceRepository();
    expect((await campaignBalances.findByCampaignId(campaignId))?.refundHeldBalance).toBe(189.7);
    expect((await beneficiaryBalances.findOne(campaignId, beneficiaryId, 'GHS'))?.refundHeldBalance).toBe(189.7);
    expect(await campaignBalances.clearPendingToAvailable(campaignId, 1)).toBeNull();
    expect(await beneficiaryBalances.clearPendingToAvailable(campaignId, beneficiaryId, 'GHS', 1)).toBe(false);
    expect(await campaignBalances.reserveForPayout(campaignId, 1)).toBeNull();
    expect((await CampaignModel.findById(campaignId))?.raisedAmount).toBe(200);
    expect((await DonationIntentModel.findById(intentId))?.status).toBe('SUCCEEDED');
    refundReceiptOverride = { status: 'processed' };
    const verified = () => request(app).post(`/api/v1/admin/refund-operations/${operationId}/verify`).set('Authorization', `Bearer ${adminToken}`).send({});
    await verified().expect(200);
    await verified().expect(200);
    expect((await campaignBalances.findByCampaignId(campaignId))?.refundHeldBalance).toBe(0);
    expect((await beneficiaryBalances.findOne(campaignId, beneficiaryId, 'GHS'))?.refundHeldBalance).toBe(0);
    expect((await beneficiaryBalances.findOne(campaignId, beneficiaryId, 'GHS'))?.pendingBalance).toBe(0);
    expect(await JournalEntryModel.countDocuments({ externalRef: `refund:${operationId}` })).toBe(1);
    expect(providerRefundBodies()).toHaveLength(1);
  });

  it('rolls back every reservation before contacting the provider when a beneficiary share has already cleared', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('refund-beneficiary-short'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await settleDonation(app, campaignId);
    const beneficiaryId = randomUUID();
    await CampaignBeneficiaryAccrualModel.create({ campaignId, donationIntentId: intentId, splitVersion: 1, currency: 'GHS', entries: [{ beneficiaryId, amount: 189.7 }] });
    await CampaignBeneficiaryBalanceModel.create({ campaignId, beneficiaryId, currency: 'GHS', pendingBalance: 100, availableBalance: 89.7 });
    await request(app).post(`/api/v1/admin/payments/${intentId}/refund`).set('Authorization', `Bearer ${adminToken}`).send({}).expect(409);
    expect(providerRefundBodies()).toHaveLength(0);
    expect(await RefundOperationModel.countDocuments({ intentId })).toBe(0);
    expect((await DonationIntentModel.findById(intentId))?.refundedAmountMinor ?? 0).toBe(0);
    const balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.pendingBalance).toBe(189.7);
    expect(balance?.refundHolds).toEqual([]);
  });

  it('refuses a refund when payout clearing wins after the initial balance check', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('refund-clearing-race'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await settleDonation(app, campaignId);
    let entered!: () => void;
    let release!: () => void;
    const enteredHold = new Promise<void>(resolve => { entered = resolve; });
    const continueHold = new Promise<void>(resolve => { release = resolve; });
    const original = MongoRefundFunds.prototype.reserve;
    const pause = vi.spyOn(MongoRefundFunds.prototype, 'reserve').mockImplementationOnce(async function (this: MongoRefundFunds, operation) {
      entered();
      await continueHold;
      return original.call(this, operation);
    });
    const response = request(app).post(`/api/v1/admin/payments/${intentId}/refund`).set('Authorization', `Bearer ${adminToken}`).send({}).then(result => result);
    try {
      await enteredHold;
      expect(await new MongoCampaignBalanceRepository().clearPendingToAvailable(campaignId, 189.7)).not.toBeNull();
    } finally { release(); }
    try { expect((await response).status).toBe(409); } finally { pause.mockRestore(); }
    expect(providerRefundBodies()).toHaveLength(0);
    expect((await DonationIntentModel.findById(intentId))?.refundedAmountMinor ?? 0).toBe(0);
    expect(await RefundOperationModel.countDocuments({ intentId })).toBe(0);
    const balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.availableBalance).toBe(189.7);
    expect(balance?.refundHolds).toEqual([]);
  });

  it('does not mark provider-pending or provider-failed refunds completed or release their reservation', async () => {
    for (const status of ['pending', 'failed']) {
      const { userId, token } = await registerUser(app, uniqueEmail(`refund-${status}`));
      const campaignId = await createActiveCampaign(app, token, userId);
      const { intentId } = await settleDonation(app, campaignId);
      refundStatus = status;
      const response = await request(app).post(`/api/v1/admin/payments/${intentId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`).send({}).expect(202);
      expect(response.body.data.status).toBe(status === 'pending' ? 'PROCESSING' : 'PENDING_REVIEW');
      const operation = await RefundOperationModel.findById(response.body.data.operationId);
      expect(operation?.state).toBe(`provider_${status}`);
      expect(operation?.active).toBe(true);
      expect((await DonationIntentModel.findById(intentId))?.status).toBe('SUCCEEDED');
      expect(await JournalEntryModel.countDocuments({ externalRef: `refund:${operation!._id}` })).toBe(0);
    }
  });

  it('requires matching provider evidence and completes a pending refund once under concurrent verification', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('refund-verify'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await settleDonation(app, campaignId);
    refundStatus = 'pending';
    const started = await request(app).post(`/api/v1/admin/payments/${intentId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`).send({}).expect(202);
    const operationId = started.body.data.operationId;
    const url = `/api/v1/admin/refund-operations/${operationId}/verify`;
    for (const mismatch of [{ amount: 19999 }, { currency: 'USD' }, { transaction: 999999 }, { merchant_note: 'Unrelated refund' }]) {
      refundReceiptOverride = { status: 'processed', ...mismatch };
      await request(app).post(url).set('Authorization', `Bearer ${adminToken}`).send({}).expect(409);
      expect((await RefundOperationModel.findById(operationId))?.state).toBe('provider_pending');
      expect((await CampaignBalanceModel.findOne({ campaignId }))?.pendingBalance).toBe(0);
    }
    refundReceiptOverride = { status: 'processed' };
    refundVerifyHttpStatus = 503;
    await request(app).post(url).set('Authorization', `Bearer ${adminToken}`).send({}).expect(502);
    expect((await RefundOperationModel.findById(operationId))?.state).toBe('provider_pending');
    refundVerifyHttpStatus = 200;
    const responses = await Promise.all([1, 2].map(() => request(app).post(url).set('Authorization', `Bearer ${adminToken}`).send({})));
    expect(responses.map(result => result.status)).toEqual([200, 200]);
    expect(providerRefundBodies()).toHaveLength(1);
    expect(await JournalEntryModel.countDocuments({ externalRef: `refund:${operationId}` })).toBe(1);
    expect((await DonationIntentModel.findById(intentId))?.status).toBe('REFUNDED');
  });

  it('recovers an unknown timeout outcome from a supplied refund ID only after server-side verification', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('refund-timeout-recover'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await settleDonation(app, campaignId);
    refundThrows = true;
    const started = await request(app).post(`/api/v1/admin/payments/${intentId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`).send({}).expect(202);
    const operationId = started.body.data.operationId;
    const candidate = nextRefundId++;
    refundReceipts.set(String(candidate), { id: candidate, transaction: 123456, amount: 20000, currency: 'GHS', status: 'processed', merchant_note: `Ujimora refund ${operationId}` });
    const restarted = await createTestApp();
    const url = `/api/v1/admin/refund-operations/${operationId}/verify`;
    await request(restarted).post(url).set('Authorization', `Bearer ${adminToken}`).send({}).expect(400);
    await request(restarted).post(url).set('Authorization', `Bearer ${adminToken}`).send({ providerReference: String(candidate) }).expect(200);
    expect(providerRefundBodies()).toHaveLength(1);
    expect((await RefundOperationModel.findById(operationId))?.state).toBe('completed');
  });

  it('rolls back all local accounting on failure and completes it once after restart without calling the provider again', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('refund-atomic'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await settleDonation(app, campaignId);
    const failLedger = vi.spyOn(MongoDonationIntentRepository.prototype, 'updateStatus').mockRejectedValueOnce(new Error('injected final status failure'));
    let response: request.Response;
    try {
      response = await request(app).post(`/api/v1/admin/payments/${intentId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`).send({}).expect(202);
    } finally { failLedger.mockRestore(); }
    const operationId = response!.body.data.operationId;
    expect((await RefundOperationModel.findById(operationId))?.state).toBe('reversal_pending');
    expect((await CampaignBalanceModel.findOne({ campaignId }))?.pendingBalance).toBe(0);
    expect((await CampaignBalanceModel.findOne({ campaignId }))?.refundHolds.map(hold => ({ operationId: hold.operationId, amount: hold.amount }))).toEqual([{ operationId, amount: 189.7 }]);
    expect((await CampaignModel.findById(campaignId))?.raisedAmount).toBe(200);
    expect((await DonationIntentModel.findById(intentId))?.status).toBe('SUCCEEDED');
    expect(await JournalEntryModel.countDocuments({ externalRef: `refund:${operationId}` })).toBe(0);
    const restarted = await createTestApp();
    const url = `/api/v1/admin/refund-operations/${operationId}/retry-accounting`;
    const results = await Promise.all([1, 2].map(() => request(restarted).post(url).set('Authorization', `Bearer ${adminToken}`).send({})));
    expect(results.map(result => result.status)).toEqual([200, 200]);
    expect(providerRefundBodies()).toHaveLength(1);
    expect(await JournalEntryModel.countDocuments({ externalRef: `refund:${operationId}` })).toBe(1);
    expect((await CampaignBalanceModel.findOne({ campaignId }))?.pendingBalance).toBe(0);
    expect((await CampaignModel.findById(campaignId))?.raisedAmount).toBe(0);
    expect((await RefundOperationModel.findById(operationId))?.active).toBe(false);
    expect((await CampaignBalanceModel.findOne({ campaignId }))?.refundHolds).toEqual([]);
  });

  it('serializes simultaneous partial refunds with different keys before either can call the provider twice', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('refund-race'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { intentId } = await settleDonation(app, campaignId);
    let release!: () => void;
    refundGate = new Promise<void>(resolve => { release = resolve; });
    const first = request(app).post(`/api/v1/admin/payments/${intentId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`).send({ amount: 100, idempotencyKey: 'race-a' }).then(result => result);
    try {
      await vi.waitFor(() => expect(providerRefundBodies()).toHaveLength(1), { timeout: 5000 });
      await request(app).post(`/api/v1/admin/payments/${intentId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`).send({ amount: 50, idempotencyKey: 'race-b' }).expect(409);
    } finally { release(); }
    expect((await first).status).toBe(200);
    expect(providerRefundBodies()).toHaveLength(1);
    expect((await DonationIntentModel.findById(intentId))?.refundedAmountMinor).toBe(10000);
  });

  it('limits recovery records and accounting retries to administrators and omits client keys from the queue', async () => {
    await request(app).get('/api/v1/admin/refund-operations').expect(401);
    const { token } = await registerUser(app, uniqueEmail('refund-queue-user'));
    await request(app).get('/api/v1/admin/refund-operations').set('Authorization', `Bearer ${token}`).expect(403);
    await request(app).post('/api/v1/admin/refund-operations/unknown/retry-accounting').set('Authorization', `Bearer ${token}`).send({}).expect(403);
    const queue = await request(app).get('/api/v1/admin/refund-operations').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(queue.headers['cache-control']).toBe('private, no-store');
    expect(queue.body.data.total).toBeGreaterThan(0);
    const attention = await request(app).get('/api/v1/admin/action-center').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(attention.body.data.items.find((item: { id: string }) => item.id === 'refund-recovery').count).toBe(queue.body.data.total);
    expect(JSON.stringify(queue.body)).not.toContain('requestKey');
    await request(app).get('/api/v1/admin/refund-operations?page=0').set('Authorization', `Bearer ${adminToken}`).expect(400);
  });
});
