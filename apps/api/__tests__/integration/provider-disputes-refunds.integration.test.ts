import { createHmac, randomUUID } from 'node:crypto';

const PAYSTACK_SECRET = 'sk_test_paystack_secret_for_provider_events';
process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_provider_events';
process.env.PUBLIC_WEB_URL = 'https://give.example.test';

import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { DisputeModel } from '../../src/infrastructure/database/models/DisputeModel.js';
import { ProviderPaymentEventModel } from '../../src/infrastructure/database/models/ProviderPaymentEventModel.js';
import { RefundOperationModel } from '../../src/infrastructure/database/models/RefundOperationModel.js';
import { DonationIntentModel } from '../../src/infrastructure/database/models/DonationIntentModel.js';
import { CampaignBalanceModel } from '../../src/infrastructure/database/models/CampaignBalanceModel.js';
import { JournalEntryModel } from '../../src/infrastructure/database/models/JournalEntryModel.js';
import { CampaignCategory, CampaignPriority } from '@ubuntu-fund/types';

const uniqueEmail = (label: string) => `${label}-${randomUUID()}@example.com`;
const sign = (raw: string) => createHmac('sha512', PAYSTACK_SECRET).update(raw).digest('hex');

// I009 / I053: provider-originated chargebacks and refunds were dropped. They
// are now recorded once and surfaced to staff; no balance moves automatically.
describe('Paystack disputes and provider refunds', () => {
  let app: Express;
  let adminToken: string;

  const webhook = (event: string, data: Record<string, unknown>) => {
    const raw = JSON.stringify({ event, data });
    return request(app).post('/api/v1/webhooks/paystack').set('x-paystack-signature', sign(raw)).set('Content-Type', 'application/json').send(raw);
  };

  async function settledDonation() {
    const creator = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('pecreator'), password: 'SecurePass123', name: 'Creator' }).expect(201);
    await UserModel.findByIdAndUpdate(creator.body.data.user.id, { verificationLevel: 2 });
    const campaign = await request(app).post('/api/v1/campaigns').set('Authorization', `Bearer ${creator.body.data.tokens.accessToken}`).send({
      title: 'Provider Events Campaign', description: 'Campaign for provider-event tests', goalAmount: 5000, currency: 'GHS',
      category: CampaignCategory.EDUCATION, priority: CampaignPriority.NORMAL, beneficiaries: [],
      endDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    }).expect(201);
    const campaignId = campaign.body.data.id as string;
    await CampaignModel.findByIdAndUpdate(campaignId, { status: 'active' });
    const intent = await request(app).post('/api/v1/donation-intents').send({
      campaignId, amount: 200, tip: 20, provider: 'paystack', donorEmail: 'donor@example.com', isAnonymous: true,
    }).expect(201);
    const reference = intent.body.data.reference as string;
    await webhook('charge.success', { reference, amount: 22000, fees: 330, currency: 'GHS', status: 'success' }).expect(200);
    return { campaignId, reference, intentId: intent.body.data.intent.id as string };
  }

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, opts: unknown) => {
      const u = String(url);
      if (u.includes('/transaction/initialize')) {
        const body = JSON.parse((opts as { body: string }).body) as { reference: string };
        return { ok: true, status: 200, json: async () => ({ status: true, data: { authorization_url: `https://checkout.paystack.com/${body.reference}`, access_code: 'acc', reference: body.reference } }) } as unknown as Response;
      }
      throw new Error(`unexpected fetch to ${u}`);
    }));
    const email = uniqueEmail('peadmin');
    const reg = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email, password: 'SecurePass123', name: 'Admin' }).expect(201);
    await UserModel.findByIdAndUpdate(reg.body.data.user.id, { role: 'admin' });
    adminToken = (await request(app).post('/api/v1/auth/login').send({ email, password: 'SecurePass123' }).expect(200)).body.data.tokens.accessToken;
  });
  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
    vi.unstubAllGlobals();
  });

  it('opens one staff dispute per Paystack chargeback, idempotently, and never auto-closes it', async () => {
    const { campaignId, reference, intentId } = await settledDonation();
    const dispute = { id: 7001, status: 'awaiting-merchant-feedback', resolution: null, refund_amount: 22000, currency: 'GHS', dueAt: '2026-10-01T00:00:00.000Z', category: 'chargeback', transaction: { id: 1, reference, amount: 22000, currency: 'GHS' }, customer: { email: 'donor@example.com' } };

    await webhook('charge.dispute.create', dispute).expect(200);
    await webhook('charge.dispute.create', dispute).expect(200);
    await webhook('charge.dispute.remind', dispute).expect(200);

    const cases = await DisputeModel.find({ campaignId });
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ status: 'open', source: 'paystack', transactionReference: reference, donationIntentId: intentId, amount: 220, currency: 'GHS' });
    // Automatic payouts look for exactly this: an open dispute on the campaign.
    expect(await DisputeModel.exists({ campaignId, status: { $in: ['open', 'under_review'] } })).toBeTruthy();
    expect(await ProviderPaymentEventModel.countDocuments({ reference, kind: 'dispute' })).toBe(2);
    // No customer details are stored on the event.
    expect(JSON.stringify(await ProviderPaymentEventModel.find({ reference }).lean())).not.toContain('donor@example.com');
    // The intent's money state is untouched (phase 1 records only).
    expect((await DonationIntentModel.findById(intentId))?.status).toBe('SUCCEEDED');

    const list = await request(app).get('/api/v1/disputes').set('Authorization', `Bearer ${adminToken}`).expect(200);
    const listed = list.body.data.items.find((item: { id: string }) => item.id === cases[0].id);
    expect(listed.reporterName).toBe('Paystack (payment provider)');

    await webhook('charge.dispute.resolve', { ...dispute, status: 'resolved', resolution: 'merchant-accepted' }).expect(200);
    const resolved = await DisputeModel.findById(cases[0].id);
    expect(resolved).toMatchObject({ status: 'under_review', providerResolution: 'merchant-accepted' });
  });

  it('opens a case for a refund issued outside Ujimora, but not for one Ujimora requested', async () => {
    const external = await settledDonation();
    const refund = { status: 'processed', transaction_reference: external.reference, refund_reference: 'rf-1', amount: '22000', currency: 'GHS', customer: { email: 'donor@example.com' } };
    await webhook('refund.pending', { ...refund, status: 'pending' }).expect(200);
    await webhook('refund.processed', refund).expect(200);
    await webhook('refund.processed', refund).expect(200);
    const cases = await DisputeModel.find({ campaignId: external.campaignId });
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ reason: 'Refund issued outside Ujimora', status: 'open', amount: 220 });
    expect(await ProviderPaymentEventModel.countDocuments({ reference: external.reference, kind: 'refund' })).toBe(2);

    const ours = await settledDonation();
    await RefundOperationModel.create({
      _id: randomUUID(), intentId: ours.intentId, campaignId: ours.campaignId, provider: 'paystack', transactionReference: ours.reference,
      requestKey: 'rk', adminId: 'admin', amount: 200, amountMinor: 20000, cumulativeMinor: 20000, maxMinor: 20000, currency: 'GHS',
      beneficiaryNet: 190, platformFee: 7, processorFee: 3, state: 'provider_pending', active: true,
    });
    await webhook('refund.processed', { ...refund, transaction_reference: ours.reference, refund_reference: 'rf-2', amount: '20000' }).expect(200);
    expect(await DisputeModel.countDocuments({ campaignId: ours.campaignId })).toBe(0);
  });

  it('records chargebacks on non-campaign charges for the admin provider-event list', async () => {
    const reference = `tip-${randomUUID()}`;
    const openEvents = async () => (await request(app).get('/api/v1/admin/action-center').set('Authorization', `Bearer ${adminToken}`).expect(200))
      .body.data.items.find((item: { id: string }) => item.id === 'provider-events');
    const before = (await openEvents()).count as number;
    await webhook('charge.dispute.create', { id: 7002, status: 'awaiting-merchant-feedback', currency: 'GHS', transaction: { reference, amount: 5000, currency: 'GHS' } }).expect(200);
    // R2-006: staff see it in the action center, linked to the Provider events screen.
    expect(await openEvents()).toMatchObject({ href: '/provider-events', count: before + 1 });
    const listed = await request(app).get('/api/v1/admin/payments/provider-events?status=open').set('Authorization', `Bearer ${adminToken}`).expect(200);
    const event = listed.body.data.find((item: { reference: string }) => item.reference === reference);
    expect(event).toMatchObject({ subject: 'tip', kind: 'dispute', amountMinor: 5000, reviewStatus: 'open' });
    await request(app).post(`/api/v1/admin/payments/provider-events/${event.id}/acknowledge`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app).post(`/api/v1/admin/payments/provider-events/${event.id}/acknowledge`).set('Authorization', `Bearer ${adminToken}`).expect(404);
    expect((await openEvents()).count).toBe(before);
    const user = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('peuser'), password: 'SecurePass123', name: 'User' }).expect(201);
    await request(app).get('/api/v1/admin/payments/provider-events').set('Authorization', `Bearer ${user.body.data.tokens.accessToken}`).expect(403);
  });

  // R2-001: provider cases must be closed with an accounting-only reversal,
  // never a console refund (which would pay the donor a second time).
  const admin = () => `Bearer ${adminToken}`;
  const providerFetches = () => vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('/refund'));

  it('tells staff not to refund again and records a dashboard refund without calling Paystack, once', async () => {
    const { campaignId, reference, intentId } = await settledDonation();
    expect(await CampaignBalanceModel.findOne({ campaignId }).lean()).toMatchObject({ totalRaised: 200, pendingBalance: 189.7 });
    await webhook('refund.processed', { status: 'processed', transaction_reference: reference, refund_reference: 'rf-dash-1', amount: 22000, currency: 'GHS' }).expect(200);
    const [kase] = await DisputeModel.find({ campaignId });
    expect(kase.description).toContain('Do NOT issue another refund');
    expect(kase.description).not.toContain('refund tools');

    // The case cannot be resolved (resuming payouts) before the books match.
    await request(app).put(`/api/v1/disputes/${kase.id}/resolve`).set('Authorization', admin()).send({ resolution: 'done' }).expect(409);
    const detail = await request(app).get(`/api/v1/disputes/${kase.id}`).set('Authorization', admin()).expect(200);
    expect(detail.body.data).toMatchObject({ source: 'paystack', providerCaseKind: 'external_refund', amount: 220, donationIntentId: intentId });

    const before = providerFetches().length;
    const first = await request(app).post(`/api/v1/disputes/${kase.id}/provider-reversal`).set('Authorization', admin()).send({}).expect(200);
    // The 220 charge included the separate 20 platform tip: 200 leaves the campaign.
    expect(first.body.data.reversal).toMatchObject({ status: 'REFUNDED', amount: 200 });
    expect(first.body.data.dispute.reversalOperationId).toBe(first.body.data.reversal.operationId);
    const replay = await request(app).post(`/api/v1/disputes/${kase.id}/provider-reversal`).set('Authorization', admin()).send({}).expect(200);
    expect(replay.body.data.reversal.operationId).toBe(first.body.data.reversal.operationId);
    expect(providerFetches().length).toBe(before); // no refund request ever reached Paystack

    expect(await CampaignBalanceModel.findOne({ campaignId }).lean()).toMatchObject({ totalRaised: 0, pendingBalance: 0, refundHolds: [] });
    const intent = await DonationIntentModel.findById(intentId).lean();
    expect(intent).toMatchObject({ status: 'REFUNDED', refundedAmountMinor: 20000 });
    const operation = await RefundOperationModel.findById(first.body.data.reversal.operationId).lean();
    expect(operation).toMatchObject({ state: 'completed', active: false, origin: 'provider_refund', providerReference: kase.providerDisputeId });
    expect(await JournalEntryModel.countDocuments({ externalRef: `refund:${operation!._id}` })).toBe(1);
    // A console refund is no longer possible on the reversed contribution.
    await request(app).post(`/api/v1/admin/payments/${intentId}/refund`).set('Authorization', admin()).send({}).expect(400);
    // A redelivered webhook neither reopens the case nor treats the reversal as Ujimora's refund.
    await webhook('refund.processed', { status: 'processed', transaction_reference: reference, refund_reference: 'rf-dash-1', amount: 22000, currency: 'GHS' }).expect(200);
    expect(await DisputeModel.countDocuments({ campaignId })).toBe(1);

    await request(app).put(`/api/v1/disputes/${kase.id}/resolve`).set('Authorization', admin()).send({ resolution: 'Reversal recorded' }).expect(200);
    const closed = await request(app).post(`/api/v1/disputes/${kase.id}/provider-reversal`).set('Authorization', admin()).send({});
    expect([closed.status, closed.body.message]).toEqual([409, 'This case is closed']);
  });

  it('records a partial dashboard refund proportionally and caps it at the provider amount', async () => {
    const { campaignId, reference, intentId } = await settledDonation();
    await webhook('refund.processed', { status: 'processed', transaction_reference: reference, refund_reference: 'rf-part', amount: 5000, currency: 'GHS' }).expect(200);
    const [kase] = await DisputeModel.find({ campaignId });
    await request(app).post(`/api/v1/disputes/${kase.id}/provider-reversal`).set('Authorization', admin()).send({ amount: 60 }).expect(400);
    const res = await request(app).post(`/api/v1/disputes/${kase.id}/provider-reversal`).set('Authorization', admin()).send({}).expect(200);
    expect(res.body.data.reversal).toMatchObject({ status: 'PARTIALLY_REFUNDED', amount: 50 });
    expect(await DonationIntentModel.findById(intentId).lean()).toMatchObject({ status: 'PARTIALLY_REFUNDED', refundedAmountMinor: 5000 });
    // 50 of 200: a quarter of the settled net (189.70) leaves pending.
    const balance = await CampaignBalanceModel.findOne({ campaignId }).lean();
    expect(balance?.totalRaised).toBe(150);
    expect(balance?.pendingBalance).toBeCloseTo(142.27, 6);
  });

  it('records an accepted chargeback as CHARGEBACK and refuses when the funds were already paid out', async () => {
    const { campaignId, reference, intentId } = await settledDonation();
    const dispute = { id: 7100, status: 'awaiting-merchant-feedback', refund_amount: 22000, currency: 'GHS', transaction: { id: 9, reference, amount: 22000, currency: 'GHS' } };
    await webhook('charge.dispute.create', dispute).expect(200);
    const [kase] = await DisputeModel.find({ campaignId });
    expect(kase.description).toContain('Do NOT issue a refund from the console');
    await webhook('charge.dispute.resolve', { ...dispute, status: 'resolved', resolution: 'merchant-accepted' }).expect(200);
    await request(app).put(`/api/v1/disputes/${kase.id}/resolve`).set('Authorization', admin()).send({ resolution: 'accepted' }).expect(409);

    // Paid out already: no local clawback is possible, and nothing is claimed.
    await CampaignBalanceModel.updateOne({ campaignId }, { $set: { pendingBalance: 0 } });
    const refused = await request(app).post(`/api/v1/disputes/${kase.id}/provider-reversal`).set('Authorization', admin()).send({}).expect(409);
    expect(refused.body.message).toContain('manual clawback');
    expect((await DonationIntentModel.findById(intentId).lean())?.refundedAmountMinor ?? 0).toBe(0);

    await CampaignBalanceModel.updateOne({ campaignId }, { $set: { pendingBalance: 189.7 } });
    const res = await request(app).post(`/api/v1/disputes/${kase.id}/provider-reversal`).set('Authorization', admin()).send({}).expect(200);
    expect(res.body.data.reversal.status).toBe('CHARGEBACK');
    expect((await DonationIntentModel.findById(intentId).lean())?.status).toBe('CHARGEBACK');
    await request(app).put(`/api/v1/disputes/${kase.id}/resolve`).set('Authorization', admin()).send({ resolution: 'Chargeback recorded' }).expect(200);
  });

  it('refuses a provider reversal while a console refund on the contribution is unresolved', async () => {
    const { campaignId, reference, intentId } = await settledDonation();
    await RefundOperationModel.create({
      _id: randomUUID(), intentId, campaignId, provider: 'paystack', transactionReference: reference,
      requestKey: 'rk-active', adminId: 'admin', amount: 100, amountMinor: 10000, cumulativeMinor: 10000, maxMinor: 20000, currency: 'GHS',
      beneficiaryNet: 94.85, platformFee: 3.5, processorFee: 1.65, state: 'provider_unknown', active: true,
    });
    await webhook('refund.processed', { status: 'processed', transaction_reference: reference, refund_reference: 'rf-other', amount: 5000, currency: 'GHS' }).expect(200);
    const [kase] = await DisputeModel.find({ campaignId });
    const res = await request(app).post(`/api/v1/disputes/${kase.id}/provider-reversal`).set('Authorization', admin()).send({}).expect(409);
    expect(res.body.message).toContain('needs reconciliation');
  });

  // R2-004: one provider refund matches at most one console refund operation.
  it('opens a case for a same-amount dashboard refund next to a console refund', async () => {
    const op = (d: { intentId: string; campaignId: string; reference: string }, state: string, extra: Record<string, unknown> = {}) => RefundOperationModel.create({
      _id: randomUUID(), intentId: d.intentId, campaignId: d.campaignId, provider: 'paystack', transactionReference: d.reference,
      requestKey: randomUUID(), adminId: 'admin', amount: 20, amountMinor: 2000, cumulativeMinor: 2000, maxMinor: 20000, currency: 'GHS',
      beneficiaryNet: 18.97, platformFee: 0.7, processorFee: 0.33, state, active: state !== 'completed', ...extra,
    });
    const refund = (reference: string, ref: string, extra: Record<string, unknown> = {}) =>
      webhook('refund.processed', { status: 'processed', transaction_reference: reference, refund_reference: ref, amount: 2000, currency: 'GHS', ...extra }).expect(200);

    // A completed console partial refund, then the same amount again from the dashboard.
    const completed = await settledDonation();
    await op(completed, 'completed', { providerReference: '4401' });
    await refund(completed.reference, 'rf-a', { id: 4401 }); // ours, by provider refund id
    await refund(completed.reference, 'rf-a', { id: 4401 }); // redelivery
    expect(await DisputeModel.countDocuments({ campaignId: completed.campaignId })).toBe(0);
    await refund(completed.reference, 'rf-b');
    expect(await DisputeModel.countDocuments({ campaignId: completed.campaignId })).toBe(1);

    // An unconfirmed console refund plus a duplicate refund from the dashboard.
    const pending = await settledDonation();
    await op(pending, 'provider_unknown');
    await refund(pending.reference, 'rf-c');
    await refund(pending.reference, 'rf-c'); // redelivery matches the same operation
    expect(await DisputeModel.countDocuments({ campaignId: pending.campaignId })).toBe(0);
    await refund(pending.reference, 'rf-d');
    expect(await DisputeModel.countDocuments({ campaignId: pending.campaignId })).toBe(1);

    // A console refund the provider failed cannot be the refund Paystack processed.
    const failed = await settledDonation();
    await op(failed, 'provider_failed');
    await refund(failed.reference, 'rf-e');
    expect(await DisputeModel.countDocuments({ campaignId: failed.campaignId })).toBe(1);

    // Without an amount the refund cannot be matched: it is never assumed ours.
    const noAmount = await settledDonation();
    await op(noAmount, 'provider_pending');
    await webhook('refund.processed', { status: 'processed', transaction_reference: noAmount.reference, refund_reference: 'rf-f', currency: 'GHS' }).expect(200);
    expect(await DisputeModel.countDocuments({ campaignId: noAmount.campaignId })).toBe(1);
  });

  it('acknowledges a malformed dispute event without failing the webhook', async () => {
    await webhook('charge.dispute.create', { status: 'x' }).expect(200);
  });
});
