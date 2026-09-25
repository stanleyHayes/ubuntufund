import { createHmac, randomUUID } from 'node:crypto';

const PAYSTACK_SECRET = 'sk_test_paystack_secret_for_my_donations';
process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_my_donations';
process.env.PUBLIC_WEB_URL = 'https://give.example.test';

import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { DonationIntentModel } from '../../src/infrastructure/database/models/DonationIntentModel.js';
import { CampaignCategory, CampaignPriority } from '@ubuntu-fund/types';

const uniqueEmail = (label: string) => `${label}-${randomUUID()}@example.com`;
const sign = (raw: string) => createHmac('sha512', PAYSTACK_SECRET).update(raw).digest('hex');

// I044: "My donations" hard-coded every gift as completed, so refunded gifts
// kept showing Completed, counted in totals and offered "Request Refund".
describe('My donations reflects refunds and disputes', () => {
  let app: Express;
  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, opts: unknown) => {
      const body = JSON.parse((opts as { body: string }).body) as { reference: string };
      return { ok: true, status: 200, json: async () => ({ status: true, data: { authorization_url: `https://checkout.paystack.com/${body.reference}`, access_code: 'acc', reference: body.reference } }) } as unknown as Response;
    }));
  });
  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
    vi.unstubAllGlobals();
  });

  it('maps each gift to its current money state and blocks a second refund', async () => {
    const creator = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('mdcreator'), password: 'SecurePass123', name: 'Creator' }).expect(201);
    await UserModel.findByIdAndUpdate(creator.body.data.user.id, { verificationLevel: 2 });
    const campaign = await request(app).post('/api/v1/campaigns').set('Authorization', `Bearer ${creator.body.data.tokens.accessToken}`).send({
      title: 'History Campaign', description: 'Campaign for donation history tests', goalAmount: 5000, currency: 'GHS',
      category: CampaignCategory.EDUCATION, priority: CampaignPriority.NORMAL, beneficiaries: [],
      endDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    }).expect(201);
    const campaignId = campaign.body.data.id as string;
    await CampaignModel.findByIdAndUpdate(campaignId, { status: 'active' });
    const donor = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('mddonor'), password: 'SecurePass123', name: 'Donor' }).expect(201);
    const token = `Bearer ${donor.body.data.tokens.accessToken}`;

    const give = async (amount: number) => {
      const intent = await request(app).post('/api/v1/donation-intents').set('Authorization', token).send({ campaignId, amount, provider: 'paystack', donorEmail: 'donor@example.com', isAnonymous: true }).expect(201);
      const raw = JSON.stringify({ event: 'charge.success', data: { reference: intent.body.data.reference, amount: amount * 100, fees: 0, currency: 'GHS', status: 'success', channel: 'card' } });
      await request(app).post('/api/v1/webhooks/paystack').set('x-paystack-signature', sign(raw)).set('Content-Type', 'application/json').send(raw).expect(200);
      return intent.body.data.intent.id as string;
    };
    const kept = await give(10);
    const refunded = await give(20);
    const partial = await give(30);
    const disputed = await give(40);
    await DonationIntentModel.updateOne({ _id: refunded }, { $set: { status: 'REFUNDED' } });
    await DonationIntentModel.updateOne({ _id: partial }, { $set: { status: 'PARTIALLY_REFUNDED' } });
    await DonationIntentModel.updateOne({ _id: disputed }, { $set: { status: 'DISPUTED' } });

    const mine = await request(app).get('/api/v1/donations/mine').set('Authorization', token).expect(200);
    const rows = (Array.isArray(mine.body.data) ? mine.body.data : mine.body.data.items) as { id: string; amount: number; status: string; refundRequested: boolean }[];
    const byAmount = Object.fromEntries(rows.map((row) => [row.amount, row]));
    expect(byAmount[10].status).toBe('completed');
    expect(byAmount[20].status).toBe('refunded');
    expect(byAmount[30].status).toBe('partially_refunded');
    expect(byAmount[40].status).toBe('disputed');
    expect(kept).toBeTruthy();

    // A refunded gift cannot be refunded again; a completed one can, once.
    await request(app).post('/api/v1/refunds').set('Authorization', token).send({ donationId: byAmount[20].id, reason: 'Other' }).expect(409);
    await request(app).post('/api/v1/refunds').set('Authorization', token).send({ donationId: byAmount[10].id, reason: 'Other' }).expect(201);
    const again = await request(app).get('/api/v1/donations/mine').set('Authorization', token).expect(200);
    const againRows = (Array.isArray(again.body.data) ? again.body.data : again.body.data.items) as { amount: number; refundRequested: boolean }[];
    expect(againRows.find((row) => row.amount === 10)?.refundRequested).toBe(true);
  });
});
