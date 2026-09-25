import { createHmac, randomUUID } from 'node:crypto';

const PAYSTACK_SECRET = 'sk_test_paystack_secret_for_late_success_tests';
process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_late_success';
process.env.PUBLIC_WEB_URL = 'https://give.example.test';

import { describe, it, beforeAll, afterAll, beforeEach, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import mongoose from 'mongoose';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { JournalEntryModel } from '../../src/infrastructure/database/models/JournalEntryModel.js';
import { DonationIntentModel } from '../../src/infrastructure/database/models/DonationIntentModel.js';
import { CouponModel } from '../../src/infrastructure/database/models/CouponModel.js';
import { CouponRedemptionModel } from '../../src/infrastructure/database/models/CouponRedemptionModel.js';
import { CampaignCategory, CampaignPriority } from '@ubuntu-fund/types';

const HOUR = 60 * 60 * 1000;

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}
function sign(raw: string): string {
  return createHmac('sha512', PAYSTACK_SECRET).update(raw).digest('hex');
}

type VerifyReply = { status: string; amount?: number; currency?: string } | 'not_found';
/** Per-reference answers for /transaction/verify; anything unlisted is 'abandoned'. */
const verifyReplies = new Map<string, VerifyReply>();

function stubPaystack() {
  vi.stubGlobal('fetch', vi.fn(async (url: unknown, opts: unknown) => {
    const u = String(url);
    const json = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response;
    if (u.includes('/transaction/initialize')) {
      const body = JSON.parse((opts as { body: string }).body) as { reference: string };
      return json(200, { status: true, data: { authorization_url: `https://checkout.paystack.com/${body.reference}`, access_code: 'acc', reference: body.reference } });
    }
    if (u.includes('/transaction/verify/')) {
      const reference = decodeURIComponent(u.split('/transaction/verify/')[1] ?? '');
      const reply = verifyReplies.get(reference) ?? { status: 'abandoned' };
      if (reply === 'not_found') return json(400, { status: false, message: 'Transaction reference not found' });
      return json(200, { status: true, data: { status: reply.status, reference, amount: reply.amount ?? 22000, fees: 330, currency: reply.currency ?? 'GHS' } });
    }
    throw new Error(`unexpected fetch to ${u}`);
  }));
}

describe('Hosted checkout expiry, sweep fairness and late successes (I007, I008, I038)', () => {
  let app: Express;
  let adminToken: string;
  let campaignId: string;

  async function openIntent() {
    const res = await request(app).post('/api/v1/donation-intents').send({
      campaignId, amount: 200, tip: 20, provider: 'paystack', donorEmail: 'guest@example.com',
      legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
    }).expect(201);
    return { intentId: res.body.data.intent.id as string, reference: res.body.data.reference as string };
  }
  async function backdate(intentId: string, ageMs: number, createdAgeMs = ageMs) {
    // Raw driver write: Mongoose treats createdAt as immutable.
    await DonationIntentModel.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(intentId) },
      { $set: { updatedAt: new Date(Date.now() - ageMs), createdAt: new Date(Date.now() - createdAgeMs) } },
    );
  }
  const sweep = (body: Record<string, unknown> = {}) => request(app)
    .post('/api/v1/admin/reconciliation').set('Authorization', `Bearer ${adminToken}`)
    .send({ olderThanMinutes: 30, ...body }).expect(200);
  function webhook(reference: string, amount = 22000) {
    const raw = JSON.stringify({ event: 'charge.success', data: { reference, amount, fees: 330, currency: 'GHS', status: 'success' } });
    return request(app).post('/api/v1/webhooks/paystack').set('x-paystack-signature', sign(raw)).set('Content-Type', 'application/json').send(raw);
  }

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
    const adminEmail = uniqueEmail('lateadmin');
    const reg = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: adminEmail, password: 'SecurePass123', name: 'Admin' }).expect(201);
    await UserModel.findByIdAndUpdate(reg.body.data.user.id, { role: 'admin' });
    adminToken = (await request(app).post('/api/v1/auth/login').send({ email: adminEmail, password: 'SecurePass123' }).expect(200)).body.data.tokens.accessToken;

    const creator = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('latecreator'), password: 'SecurePass123', name: 'Creator' }).expect(201);
    await UserModel.findByIdAndUpdate(creator.body.data.user.id, { verificationLevel: 2 });
    stubPaystack();
    const campaign = await request(app).post('/api/v1/campaigns').set('Authorization', `Bearer ${creator.body.data.tokens.accessToken}`).send({
      title: 'Late Success Campaign', description: 'Campaign for late-success tests', goalAmount: 5000, currency: 'GHS',
      category: CampaignCategory.EDUCATION, priority: CampaignPriority.NORMAL, beneficiaries: [],
      endDate: new Date(Date.now() + 7 * 24 * HOUR).toISOString(),
    }).expect(201);
    campaignId = campaign.body.data.id;
    await CampaignModel.findByIdAndUpdate(campaignId, { status: 'active' });
  });
  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    verifyReplies.clear();
    stubPaystack();
  });

  it('a backlog of still-open checkouts cannot starve a newer paid intent whose webhook was lost', async () => {
    // 150 abandoned-but-young checkouts, older than the paid one.
    const old = new Date(Date.now() - 3 * HOUR);
    await DonationIntentModel.collection.insertMany(Array.from({ length: 150 }, (_, i) => ({
      _id: new mongoose.Types.ObjectId(), campaignId, amount: 50, currency: 'GHS', donorUserId: null,
      donorEmail: 'backlog@example.com', isAnonymous: true, tip: 0, status: 'PENDING', provider: 'paystack',
      providerRef: `uf-backlog-${i}-${randomUUID().slice(0, 8)}`, idempotencyKey: `backlog-${randomUUID()}`,
      createdAt: old, updatedAt: old,
    })));
    const paid = await openIntent();
    await backdate(paid.intentId, 1 * HOUR);
    verifyReplies.set(paid.reference, { status: 'success' });

    await sweep();
    await sweep();

    expect((await DonationIntentModel.findById(paid.intentId))?.status).toBe('SUCCEEDED');
    expect(await JournalEntryModel.countDocuments({ donationIntentId: paid.intentId })).toBe(1);
    // Young abandoned checkouts are still open (the donor may still be paying).
    expect(await DonationIntentModel.countDocuments({ providerRef: /^uf-backlog-/, status: 'PENDING' })).toBe(150);
    await DonationIntentModel.deleteMany({ providerRef: /^uf-backlog-/ });
  });

  it('expires an abandoned or unknown checkout only after the TTL', async () => {
    const young = await openIntent();
    const abandoned = await openIntent();
    const unknown = await openIntent();
    await backdate(young.intentId, 2 * HOUR);
    await backdate(abandoned.intentId, 2 * HOUR, 25 * HOUR);
    await backdate(unknown.intentId, 2 * HOUR, 25 * HOUR);
    verifyReplies.set(unknown.reference, 'not_found');

    const summary = (await sweep()).body.data;
    expect(summary.expired).toBe(2);
    expect((await DonationIntentModel.findById(young.intentId))?.status).toBe('PENDING');
    expect((await DonationIntentModel.findById(abandoned.intentId))?.status).toBe('EXPIRED');
    expect((await DonationIntentModel.findById(unknown.intentId))?.status).toBe('EXPIRED');
    // The donor's status check now sees a terminal state it can move on from.
    const status = await request(app).post(`/api/v1/donation-intents/${abandoned.intentId}/verify`).send({ reference: abandoned.reference }).expect(200);
    expect(status.body.data.status).toBe('EXPIRED');
    await DonationIntentModel.updateMany({ _id: { $in: [young.intentId] } }, { $set: { status: 'FAILED' } });
  });

  it.each(['EXPIRED', 'FAILED'] as const)('credits a verified late charge.success on a %s intent exactly once', async status => {
    const { intentId, reference } = await openIntent();
    await DonationIntentModel.updateOne({ _id: intentId }, { $set: { status } });
    verifyReplies.set(reference, { status: 'success' });

    await webhook(reference).expect(200);
    await webhook(reference).expect(200);

    expect((await DonationIntentModel.findById(intentId))?.status).toBe('SUCCEEDED');
    expect(await JournalEntryModel.countDocuments({ donationIntentId: intentId })).toBe(1);
  });

  it('does not credit a late success the provider does not confirm', async () => {
    const { intentId, reference } = await openIntent();
    await DonationIntentModel.updateOne({ _id: intentId }, { $set: { status: 'EXPIRED' } });
    verifyReplies.set(reference, { status: 'success', amount: 100 });
    await webhook(reference).expect(200);
    await webhook(reference, 100).expect(200);
    expect((await DonationIntentModel.findById(intentId))?.status).toBe('EXPIRED');
    expect(await JournalEntryModel.countDocuments({ donationIntentId: intentId })).toBe(0);
  });

  it('the donor callback verify credits a late success on an expired checkout', async () => {
    const { intentId, reference } = await openIntent();
    await DonationIntentModel.updateOne({ _id: intentId }, { $set: { status: 'EXPIRED' } });
    verifyReplies.set(reference, { status: 'success' });
    const res = await request(app).post(`/api/v1/donation-intents/${intentId}/verify`).send({ reference }).expect(200);
    expect(res.body.data.status).toBe('SUCCEEDED');
    expect(await JournalEntryModel.countDocuments({ donationIntentId: intentId })).toBe(1);
  });

  // R2-003: a late success on a checkout whose coupon seat was released must
  // use that seat up again, so perUserLimit matches the waivers granted.
  describe('fee-waiver coupon seats on a late success', () => {
    async function donorWithCoupon(code: string) {
      await CouponModel.create({ code, discountType: 'percent', amount: 100, currency: 'GHS', redemptions: 0, appliesToSurfaces: ['donation'], active: true, perUserLimit: 1 });
      const reg = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('waiverdonor'), password: 'SecurePass123', name: 'Donor' }).expect(201);
      const token = reg.body.data.tokens.accessToken as string;
      const open = () => request(app).post('/api/v1/donation-intents').set('Authorization', `Bearer ${token}`).send({
        campaignId, amount: 200, tip: 20, provider: 'paystack', couponCode: code, donorEmail: 'waiver@example.com',
        legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
      });
      return { userId: reg.body.data.user.id as string, open };
    }
    async function expireBySweep(intentId: string) {
      await backdate(intentId, 2 * HOUR, 25 * HOUR);
      await sweep();
      expect((await DonationIntentModel.findById(intentId))?.status).toBe('EXPIRED');
    }

    it('re-takes the released seat, so the coupon cannot be used again', async () => {
      const donor = await donorWithCoupon('LATESEAT');
      const a = (await donor.open().expect(201)).body.data;
      await expireBySweep(a.intent.id);
      expect((await CouponRedemptionModel.findOne({ providerRef: a.intent.id }).lean())?.status).toBe('released');

      verifyReplies.set(a.reference, { status: 'success' });
      await webhook(a.reference).expect(200);
      expect((await DonationIntentModel.findById(a.intent.id))?.status).toBe('SUCCEEDED');
      expect(await CouponRedemptionModel.findOne({ providerRef: a.intent.id }).lean()).toMatchObject({ status: 'consumed', seat: 0 });
      await donor.open().expect(422);
    });

    it('counts a late success whose seat another checkout took, and blocks further use', async () => {
      const donor = await donorWithCoupon('LATEOVER');
      const a = (await donor.open().expect(201)).body.data;
      await expireBySweep(a.intent.id);
      const b = (await donor.open().expect(201)).body.data; // reuses the freed seat
      verifyReplies.set(a.reference, { status: 'success' });
      await webhook(a.reference).expect(200);
      await webhook(b.reference).expect(200);

      const rows = await CouponRedemptionModel.find({ userId: donor.userId }).lean();
      expect(rows.map((r) => r.status).sort()).toEqual(['consumed', 'consumed']);
      expect(rows.find((r) => r.providerRef === b.intent.id)?.seat).toBe(0);
      expect(rows.find((r) => r.providerRef === a.intent.id)?.seat).toBeUndefined();
      await donor.open().expect(422);
    });
  });

  it('acknowledges a redelivered charge.success for a refunded intent instead of failing (I009)', async () => {
    const { intentId, reference } = await openIntent();
    await webhook(reference).expect(200);
    await DonationIntentModel.updateOne({ _id: intentId }, { $set: { status: 'REFUNDED' } });
    await webhook(reference).expect(200);
    expect((await DonationIntentModel.findById(intentId))?.status).toBe('REFUNDED');
    expect(await JournalEntryModel.countDocuments({ donationIntentId: intentId })).toBe(1);
  });
});
