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
    await webhook('charge.dispute.create', { id: 7002, status: 'awaiting-merchant-feedback', currency: 'GHS', transaction: { reference, amount: 5000, currency: 'GHS' } }).expect(200);
    const listed = await request(app).get('/api/v1/admin/payments/provider-events?status=open').set('Authorization', `Bearer ${adminToken}`).expect(200);
    const event = listed.body.data.find((item: { reference: string }) => item.reference === reference);
    expect(event).toMatchObject({ subject: 'tip', kind: 'dispute', amountMinor: 5000, reviewStatus: 'open' });
    await request(app).post(`/api/v1/admin/payments/provider-events/${event.id}/acknowledge`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app).post(`/api/v1/admin/payments/provider-events/${event.id}/acknowledge`).set('Authorization', `Bearer ${adminToken}`).expect(404);
    const user = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('peuser'), password: 'SecurePass123', name: 'User' }).expect(201);
    await request(app).get('/api/v1/admin/payments/provider-events').set('Authorization', `Bearer ${user.body.data.tokens.accessToken}`).expect(403);
  });

  it('acknowledges a malformed dispute event without failing the webhook', async () => {
    await webhook('charge.dispute.create', { status: 'x' }).expect(200);
  });
});
