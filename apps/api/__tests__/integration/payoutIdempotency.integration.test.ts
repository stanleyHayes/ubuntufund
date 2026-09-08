import { createHmac, randomUUID } from 'node:crypto';

const PAYSTACK_SECRET = 'sk_test_payout_idempotency_secret';
process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_payout_idempotency_public';
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
import { PayoutModel } from '../../src/infrastructure/database/models/PayoutModel.js';
import { JournalEntryModel } from '../../src/infrastructure/database/models/JournalEntryModel.js';
import { JournalLineModel } from '../../src/infrastructure/database/models/JournalLineModel.js';
import { MongoCampaignBalanceRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignBalanceRepository.js';
import { MongoLedgerRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoLedgerRepository.js';
import { JournalEntryEntity } from '../../src/domain/entities/JournalEntry.js';
import { CampaignCategory, CampaignPriority } from '@ubuntu-fund/types';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}
function sign(raw: string): string {
  return createHmac('sha512', PAYSTACK_SECRET).update(raw).digest('hex');
}

describe('Payout settlement idempotency + repair (G5)', () => {
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

  it('markPaidOut applies at most once per settleRef', async () => {
    const balanceRepo = new MongoCampaignBalanceRepository();
    const campaignId = `c-${randomUUID()}`;
    await CampaignBalanceModel.create({ campaignId, currency: 'GHS' });

    await balanceRepo.markPaidOut(campaignId, 100, 5, 'ref-A');
    await balanceRepo.markPaidOut(campaignId, 100, 5, 'ref-A'); // duplicate → no-op
    let bal = await CampaignBalanceModel.findOne({ campaignId });
    expect(bal?.paidOutBalance).toBe(100);
    expect(bal?.payoutFees).toBe(5);

    await balanceRepo.markPaidOut(campaignId, 50, 0, 'ref-B'); // different ref → applies
    bal = await CampaignBalanceModel.findOne({ campaignId });
    expect(bal?.paidOutBalance).toBe(150);
  });

  it('returnToAvailable / reverseFromPaidOut are idempotent per settleRef', async () => {
    const balanceRepo = new MongoCampaignBalanceRepository();
    const campaignId = `c-${randomUUID()}`;
    await CampaignBalanceModel.create({ campaignId, currency: 'GHS', paidOutBalance: 200 });

    await balanceRepo.returnToAvailable(campaignId, 30, 'ret-1');
    await balanceRepo.returnToAvailable(campaignId, 30, 'ret-1'); // no-op
    let bal = await CampaignBalanceModel.findOne({ campaignId });
    expect(bal?.availableBalance).toBe(30);

    await balanceRepo.reverseFromPaidOut(campaignId, 100, 0, 'rev-1');
    await balanceRepo.reverseFromPaidOut(campaignId, 100, 0, 'rev-1'); // no-op
    bal = await CampaignBalanceModel.findOne({ campaignId });
    expect(bal?.paidOutBalance).toBe(100); // 200 - 100 once
    expect(bal?.availableBalance).toBe(130); // 30 + 100 once
  });

  it('postEntry posts a payout journal at most once per externalRef', async () => {
    const ledger = new MongoLedgerRepository();
    const campaignId = `c-${randomUUID()}`;
    const externalRef = `pout:${randomUUID()}:paid`;
    const make = () =>
      JournalEntryEntity.forPayoutDisbursement({ campaignId, amount: 500, currency: 'GHS', externalRef });

    await ledger.postEntry(make());
    await ledger.postEntry(make()); // duplicate → returns the existing entry

    const entries = await JournalEntryModel.find({ externalRef });
    expect(entries).toHaveLength(1);
    const lines = await JournalLineModel.find({ accountKind: 'payout', accountOwnerId: campaignId, direction: 'credit' });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.amount).toBe(500);
  });

  it('reconciliation repairs a PAID-but-unsettled payout (crash between transition and effect)', async () => {
    const fetchMock = vi.fn(async (url: unknown, opts: unknown) => {
      const u = String(url);
      const body = (opts as { body?: string })?.body
        ? (JSON.parse((opts as { body: string }).body) as Record<string, unknown>)
        : {};
      const json = (p: unknown) => ({ ok: true, status: 200, json: async () => p }) as unknown as Response;
      if (u.includes('/transaction/initialize')) {
        const reference = body.reference as string;
        return json({ status: true, data: { authorization_url: `x/${reference}`, access_code: 'a', reference } });
      }
      if (u.includes('/transferrecipient')) return json({ status: true, data: { recipient_code: `RCP_${randomUUID().slice(0, 8)}` } });
      if (u.includes('/balance')) return json({ status: true, data: [{ currency: 'GHS', balance: 100_000_000 }] });
      if (u.includes('/transfer')) return json({ status: true, data: { transfer_code: `TRF_${randomUUID().slice(0, 8)}`, status: 'pending', reference: body.reference } });
      throw new Error(`unexpected fetch ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    // Owner + admin + funded active campaign.
    const reg = await request(app).post('/api/v1/auth/register').send({ email: uniqueEmail('g5'), password: 'SecurePass123', name: 'Owner' }).expect(201);
    const token = reg.body.data.tokens.accessToken as string;
    const userId = reg.body.data.user.id as string;
    await UserModel.findByIdAndUpdate(userId, { verificationLevel: 2 });
    const admReg = await request(app).post('/api/v1/auth/register').send({ email: uniqueEmail('g5a'), password: 'SecurePass123', name: 'Admin' }).expect(201);
    await UserModel.findByIdAndUpdate(admReg.body.data.user.id, { role: 'admin' });
    const admLogin = await request(app).post('/api/v1/auth/login').send({ email: admReg.body.data.user.email, password: 'SecurePass123' }).expect(200);
    const adminToken = admLogin.body.data.tokens.accessToken as string;

    const camp = await request(app).post('/api/v1/campaigns').set('Authorization', `Bearer ${token}`).send({
      title: 'G5 Repair Campaign', description: 'A campaign to test settlement repair', goalAmount: 5000, currency: 'GHS',
      category: CampaignCategory.EDUCATION, priority: CampaignPriority.NORMAL, beneficiaries: [],
      endDate: new Date(Date.now() + 7 * 864e5).toISOString(),
    }).expect(201);
    const campaignId = camp.body.data.id as string;
    await CampaignModel.findByIdAndUpdate(campaignId, { status: 'active' });

    // Fund (net 965), add recipient, request + approve a payout (→ PROCESSING, available reserved to 0).
    const checkout = await request(app).post('/api/v1/donation-intents').send({ campaignId, amount: 1000, tip: 0, provider: 'paystack', donorEmail: 'donor@example.com', donorName: 'Donor', isAnonymous: false }).expect(201);
    const rawCharge = JSON.stringify({ event: 'charge.success', data: { reference: checkout.body.data.reference, amount: 100000, fees: 0, currency: 'GHS', status: 'success' } });
    await request(app).post('/api/v1/webhooks/paystack').set('x-paystack-signature', sign(rawCharge)).set('Content-Type', 'application/json').send(rawCharge).expect(200);
    await request(app).post(`/api/v1/campaigns/${campaignId}/payout-recipient`).set('Authorization', `Bearer ${token}`).send({ type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'Jane' }).expect(201);
    const reqRes = await request(app).post(`/api/v1/campaigns/${campaignId}/payouts`).set('Authorization', `Bearer ${token}`).send({ amount: 965 }).expect(201);
    const payoutId = reqRes.body.data.id as string;
    await request(app).post(`/api/v1/payouts/${payoutId}/approve`).set('Authorization', `Bearer ${adminToken}`).send({}).expect(200);

    // Simulate the crash: the transfer.success transition landed (PAID) but the
    // balance/ledger effect never ran. Force PAID + settlementApplied=false and
    // backdate updatedAt so the reconciler treats it as stale (no timestamp bump).
    await PayoutModel.updateOne(
      { _id: payoutId },
      { $set: { status: 'PAID', settlementApplied: false, updatedAt: new Date(Date.now() - 3600_000) } },
      { timestamps: false }
    );
    let bal = await CampaignBalanceModel.findOne({ campaignId });
    expect(bal?.paidOutBalance).toBe(0); // effect not applied yet
    expect(bal?.availableBalance).toBe(0); // reserved out

    // Reconcile → repairs the PAID-but-unsettled payout idempotently.
    const rec = await request(app).post('/api/v1/admin/reconciliation/payouts').set('Authorization', `Bearer ${adminToken}`).send({ olderThanMinutes: 1 }).expect(200);
    expect(rec.body.data.repaired).toBeGreaterThanOrEqual(1);

    bal = await CampaignBalanceModel.findOne({ campaignId });
    expect(bal?.paidOutBalance).toBe(965); // repaired
    const payout = await PayoutModel.findById(payoutId);
    expect(payout?.settlementApplied).toBe(true);

    // Running reconciliation again is a harmless no-op (idempotent).
    await request(app).post('/api/v1/admin/reconciliation/payouts').set('Authorization', `Bearer ${adminToken}`).send({ olderThanMinutes: 1 }).expect(200);
    bal = await CampaignBalanceModel.findOne({ campaignId });
    expect(bal?.paidOutBalance).toBe(965); // not double-applied
  });
});
