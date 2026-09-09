import { SubscriptionPlanModel } from '../../src/infrastructure/database/models/SubscriptionPlanModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { createHmac, randomUUID } from 'node:crypto';

const PAYSTACK_SECRET = 'sk_test_creator_withdrawal_secret';
process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_creator_withdrawal_public';
process.env.PUBLIC_WEB_URL = 'https://give.example.test';

import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js';
import { CreatorBalanceModel } from '../../src/infrastructure/database/models/CreatorBalanceModel.js';
import { CreatorPayoutModel } from '../../src/infrastructure/database/models/CreatorPayoutModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}
function sign(raw: string): string {
  return createHmac('sha512', PAYSTACK_SECRET).update(raw).digest('hex');
}

describe('Creator withdrawal — transfer rail', () => {
  let app: Express;
  // Toggled by a test to simulate a provider recipient-creation failure.
  let failRecipient = false;
  let failTransfer = false;
  let transferAmount: unknown;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown, opts: unknown) => {
        const u = String(url);
        const body = (opts as { body?: string })?.body
          ? (JSON.parse((opts as { body: string }).body) as Record<string, unknown>)
          : {};
        const json = (p: unknown) => ({ ok: true, status: 200, json: async () => p }) as unknown as Response;
        if (u.includes('/transferrecipient')) {
          if (failRecipient) throw new Error('recipient creation failed');
          return json({ status: true, data: { recipient_code: `RCP_${randomUUID().slice(0, 8)}` } });
        }
        if (u.includes('/balance')) return json({ status: true, data: [{ currency: 'GHS', balance: 100_000_000 }] });
        if (u.includes('/transfer/verify/')) {
          const ref = decodeURIComponent(u.split('/transfer/verify/')[1] ?? '');
          return json({ status: true, data: { status: 'success', reference: ref, transfer_code: 'TRF_x' } });
        }
        if (u.includes('/transfer')) {
          transferAmount = body.amount;
          if (failTransfer) throw new Error('transfer response timed out');
          return json({ status: true, data: { transfer_code: `TRF_${randomUUID().slice(0, 8)}`, status: 'pending', reference: body.reference } });
        }
        throw new Error(`unexpected fetch ${u}`);
      })
    );
  });
  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
    vi.unstubAllGlobals();
  });

  async function creatorWithBalance(available: number) {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail('cw'), password: 'SecurePass123', name: 'With Draw' })
      .expect(201);
    const token = reg.body.data.tokens.accessToken as string;
    const userId = reg.body.data.user.id as string;
    await SubscriptionModel.create({ userId, tier: 'starter', status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000) });
    const handle = `wd-${randomUUID().slice(0, 6)}`;
    await request(app)
      .post('/api/v1/creators/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ handle, displayName: 'With Draw' })
      .expect(200);
    // Fund the tip balance directly.
    await CreatorBalanceModel.updateOne(
      { userId },
      { $set: { userId, currency: 'GHS', availableBalance: available } },
      { upsert: true }
    );
    return { token, userId };
  }

  it('withdraws available funds and settles paidOut on the transfer webhook', async () => {
    const { token, userId } = await creatorWithBalance(200);

    const wd = await request(app)
      .post('/api/v1/creators/withdraw')
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedFeePercent: 3, amount: 120, recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } })
      .expect(201);
    expect(wd.body.data.status).toBe('PROCESSING');
    expect(wd.body.data).toMatchObject({ amount: 120, fee: 3.6, feePercent: 3, netAmount: 116.4 });
    expect(transferAmount).toBe(11640);
    const reference = wd.body.data.reference as string;
    expect(reference.startsWith('cpay-')).toBe(true);

    // Reserved out of available immediately.
    let bal = await CreatorBalanceModel.findOne({ userId });
    expect(bal?.availableBalance).toBe(80);

    // Provider confirms the transfer → paidOut is credited.
    const raw = JSON.stringify({ event: 'transfer.success', data: { reference, status: 'success' } });
    await request(app)
      .post('/api/v1/webhooks/paystack')
      .set('x-paystack-signature', sign(raw))
      .set('Content-Type', 'application/json')
      .send(raw)
      .expect(200);

    bal = await CreatorBalanceModel.findOne({ userId });
    expect(bal?.availableBalance).toBe(80);
    expect(bal?.paidOutBalance).toBe(116.4);

    // Duplicate webhook is a no-op.
    await request(app).post('/api/v1/webhooks/paystack').set('x-paystack-signature', sign(raw)).set('Content-Type', 'application/json').send(raw).expect(200);
    bal = await CreatorBalanceModel.findOne({ userId });
    expect(bal?.paidOutBalance).toBe(116.4);
  });

  it('rejects a withdrawal above the available balance with 400', async () => {
    const { token } = await creatorWithBalance(30);
    await request(app)
      .post('/api/v1/creators/withdraw')
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedFeePercent: 3, amount: 100, recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'X' } })
      .expect(400);
  });

  it('reconciles a stuck-PROCESSING withdrawal whose webhook was missed', async () => {
    const { token, userId } = await creatorWithBalance(100);
    const wd = await request(app)
      .post('/api/v1/creators/withdraw')
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedFeePercent: 3, amount: 100, recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'X' } })
      .expect(201);
    const reference = wd.body.data.reference as string;

    // Simulate a missed webhook: still PROCESSING, backdated so the sweep sees it as stale.
    await CreatorPayoutModel.updateOne(
      { providerRef: reference },
      { $set: { updatedAt: new Date(Date.now() - 3600_000) } },
      { timestamps: false }
    );
    expect((await CreatorBalanceModel.findOne({ userId }))?.paidOutBalance).toBe(0);

    // An admin runs the reconciliation sweep → the provider reports success → settled.
    const admReg = await request(app).post('/api/v1/auth/register').send({ email: uniqueEmail('recadm'), password: 'SecurePass123', name: 'Adm' }).expect(201);
    await UserModel.findByIdAndUpdate(admReg.body.data.user.id, { role: 'admin' });
    const admLogin = await request(app).post('/api/v1/auth/login').send({ email: admReg.body.data.user.email, password: 'SecurePass123' }).expect(200);
    await request(app)
      .post('/api/v1/admin/reconciliation/payouts')
      .set('Authorization', `Bearer ${admLogin.body.data.tokens.accessToken}`)
      .send({ olderThanMinutes: 1 })
      .expect(200);

    const bal = await CreatorBalanceModel.findOne({ userId });
    expect(bal?.paidOutBalance).toBe(97); // reconciled to PAID
    expect(bal?.payoutFees).toBe(3);
    expect(bal?.availableBalance).toBe(0);
  });

  it('a recipient-creation failure returns the reservation and marks the payout FAILED (never stranded PENDING)', async () => {
    const { token, userId } = await creatorWithBalance(60);
    failRecipient = true;
    try {
      await request(app)
        .post('/api/v1/creators/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .send({ expectedFeePercent: 3, amount: 40, recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'X' } })
        .expect(502);
    } finally {
      failRecipient = false;
    }

    // The reservation is returned in full — no silent balance loss.
    const bal = await CreatorBalanceModel.findOne({ userId });
    expect(bal?.availableBalance).toBe(60);

    // The payout reached PROCESSING (providerRef persisted BEFORE the fallible
    // provider call) so the rollback could win a terminal transition: it ends
    // FAILED + settled, never orphaned in PENDING.
    const payout = await CreatorPayoutModel.findOne({ creatorUserId: userId });
    expect(payout?.status).toBe('FAILED');
    expect(payout?.settlementApplied).toBe(true);
    expect(payout?.providerRef).toMatch(/^cpay-/);
  });

  it('returns the reservation when the transfer webhook reports failure', async () => {
    const { token, userId } = await creatorWithBalance(50);
    const wd = await request(app)
      .post('/api/v1/creators/withdraw')
      .set('Authorization', `Bearer ${token}`)
      .send({ expectedFeePercent: 3, amount: 50, recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'X' } })
      .expect(201);
    const reference = wd.body.data.reference as string;
    expect((await CreatorBalanceModel.findOne({ userId }))?.availableBalance).toBe(0);

    const raw = JSON.stringify({ event: 'transfer.failed', data: { reference, status: 'failed' } });
    await request(app).post('/api/v1/webhooks/paystack').set('x-paystack-signature', sign(raw)).set('Content-Type', 'application/json').send(raw).expect(200);
    const bal = await CreatorBalanceModel.findOne({ userId });
    expect(bal?.availableBalance).toBe(50); // reservation returned
    expect(bal?.paidOutBalance).toBe(0);
  });
  it('keeps an existing balance withdrawable after downgrade, requires fee review, and reverses net plus fee once', async () => {
    const { token, userId } = await creatorWithBalance(100);
    await SubscriptionModel.updateOne({ userId }, { $set: { tier: 'free' } });
    const body = { amount: 100, recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'X' } };
    await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${token}`).send({ ...body, expectedFeePercent: 3 }).expect(409);
    expect((await CreatorBalanceModel.findOne({ userId }))?.availableBalance).toBe(100);
    const wd = await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${token}`).send({ ...body, expectedFeePercent: 3.5 }).expect(201);
    expect(wd.body.data).toMatchObject({ amount: 100, fee: 3.5, netAmount: 96.5 });
    expect(transferAmount).toBe(9650);
    for (const event of ['transfer.success', 'transfer.success', 'transfer.reversed', 'transfer.reversed']) {
      const raw = JSON.stringify({ event, data: { reference: wd.body.data.reference } });
      await request(app).post('/api/v1/webhooks/paystack').set('x-paystack-signature', sign(raw)).set('Content-Type', 'application/json').send(raw).expect(200);
      const balance = await CreatorBalanceModel.findOne({ userId });
      if (event === 'transfer.success') {
        expect(balance?.paidOutBalance).toBe(96.5);
        expect(balance?.payoutFees).toBe(3.5);
      } else {
        expect(balance?.availableBalance).toBe(100);
        expect(balance?.paidOutBalance).toBe(0);
        expect(balance?.payoutFees).toBe(0);
      }
    }
  });

  it('keeps funds reserved after an ambiguous transfer timeout until provider settlement', async () => {
    const { token, userId } = await creatorWithBalance(100);
    failTransfer = true;
    let wd;
    try {
      wd = await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${token}`).send({ expectedFeePercent: 3, amount: 100, recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'X' } }).expect(201);
    } finally { failTransfer = false; }
    expect(wd.body.data.status).toBe('PROCESSING');
    expect((await CreatorBalanceModel.findOne({ userId }))?.availableBalance).toBe(0);
    const raw = JSON.stringify({ event: 'transfer.success', data: { reference: wd.body.data.reference } });
    await request(app).post('/api/v1/webhooks/paystack').set('x-paystack-signature', sign(raw)).set('Content-Type', 'application/json').send(raw).expect(200);
    expect((await CreatorBalanceModel.findOne({ userId }))?.paidOutBalance).toBe(97);
  });

  it('uses live admin plan fees and keeps the payout snapshot after the plan changes', async () => {
    const { token, userId } = await creatorWithBalance(100);
    const original = await SubscriptionPlanModel.findOne({ tier: 'starter' });
    expect(original).toBeTruthy();
    try {
      await SubscriptionPlanModel.updateOne({ tier: 'starter' }, { $set: { platformFeePercent: 4 } });
      const wd = await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${token}`).send({ expectedFeePercent: 4, amount: 100, recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'X' } }).expect(201);
      expect(wd.body.data).toMatchObject({ fee: 4, netAmount: 96 });
      expect(transferAmount).toBe(9600);
      await SubscriptionPlanModel.updateOne({ tier: 'starter' }, { $set: { platformFeePercent: 5 } });
      const raw = JSON.stringify({ event: 'transfer.success', data: { reference: wd.body.data.reference } });
      await request(app).post('/api/v1/webhooks/paystack').set('x-paystack-signature', sign(raw)).set('Content-Type', 'application/json').send(raw).expect(200);
      const balance = await CreatorBalanceModel.findOne({ userId });
      expect(balance?.paidOutBalance).toBe(96);
      expect(balance?.payoutFees).toBe(4);
    } finally {
      await SubscriptionPlanModel.updateOne({ tier: 'starter' }, { $set: { platformFeePercent: original!.platformFeePercent } });
    }
  });

  it('settles historical withdrawals without fee fields under their original zero-fee terms', async () => {
    const { userId } = await creatorWithBalance(0);
    const reference = `cpay-legacy-${randomUUID()}`;
    await CreatorPayoutModel.create({ creatorUserId: userId, amount: 100, currency: 'GHS', status: 'PROCESSING', provider: 'paystack', providerRef: reference });
    const raw = JSON.stringify({ event: 'transfer.success', data: { reference } });
    await request(app).post('/api/v1/webhooks/paystack').set('x-paystack-signature', sign(raw)).set('Content-Type', 'application/json').send(raw).expect(200);
    const balance = await CreatorBalanceModel.findOne({ userId });
    expect(balance?.paidOutBalance).toBe(100);
    expect(balance?.payoutFees).toBe(0);
  });

});
