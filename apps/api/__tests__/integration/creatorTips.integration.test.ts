import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { createHmac, randomUUID } from 'node:crypto';

const PAYSTACK_SECRET = 'sk_test_creator_tips_secret';
process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_creator_tips_public';
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
import { TipModel } from '../../src/infrastructure/database/models/TipModel.js';
import { CreatorBalanceModel } from '../../src/infrastructure/database/models/CreatorBalanceModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}
function sign(raw: string): string {
  return createHmac('sha512', PAYSTACK_SECRET).update(raw).digest('hex');
}

// What /transaction/verify/:ref reports; tests override per case.
let verifyReply: { status: string; amount: number; currency: string } = { status: 'success', amount: 0, currency: 'GHS' };

describe('Creator tip jar (buy-me-a-coffee) — receive loop', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
    // Paystack collect: echo back the reference the gateway generated.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown, opts: unknown) => {
        const u = String(url);
        const body = (opts as { body?: string })?.body
          ? (JSON.parse((opts as { body: string }).body) as Record<string, unknown>)
          : {};
        const json = (p: unknown) => ({ ok: true, status: 200, json: async () => p }) as unknown as Response;
        if (u.includes('/transaction/initialize')) {
          const reference = body.reference as string;
          return json({ status: true, data: { authorization_url: `x/${reference}`, access_code: 'a', reference } });
        }
        if (u.includes('/transaction/verify/')) {
          const reference = decodeURIComponent(u.split('/transaction/verify/')[1] ?? '');
          return json({ status: true, data: { ...verifyReply, reference, fees: 0 } });
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

  it('claims a handle, receives a tip via webhook, and credits the creator balance idempotently', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('creator'), password: 'SecurePass123', name: 'Ama Creator' })
      .expect(201);
    const token = reg.body.data.tokens.accessToken as string;
    await SubscriptionModel.create({ userId: reg.body.data.user.id, tier: 'starter', status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000) });
    const handle = `ama-${randomUUID().slice(0, 6)}`;

    // Claim the creator page.
    await request(app)
      .post('/api/v1/creators/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ handle, displayName: 'Ama Creator', tagline: 'I make music', presetAmounts: [10, 25, 50] })
      .expect(200);

    // Public page renders, no supporters yet.
    const page = await request(app).get(`/api/v1/creators/${handle}`).expect(200);
    expect(page.body.data.handle).toBe(handle);
    expect(page.body.data.supporterCount).toBe(0);

    // A supporter opens a tip checkout (no auth).
    const tip = await request(app)
      .post(`/api/v1/creators/${handle}/tips`)
      .send({ amount: 50, supporterEmail: 'fan@example.com', supporterName: 'Kofi', message: 'Love your work!', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } })
      .expect(201);
    const reference = tip.body.data.reference as string;
    expect(reference.startsWith('tip-')).toBe(true);
    const storedTip = await TipModel.findOne({ providerRef: reference });
    expect(storedTip?.messageAgreement?.version).toBe('2026-09-12');
    expect(storedTip?.messageAgreement?.acceptedAt).toBeInstanceOf(Date);
    expect(tip.body.data.checkoutUrl).toContain(reference);

    // Paystack confirms the charge → the tip settles to the creator's balance.
    const raw = JSON.stringify({
      event: 'charge.success',
      data: { reference, amount: 5000, fees: 0, currency: 'GHS', status: 'success' },
    });
    await request(app)
      .post('/api/v1/webhooks/paystack')
      .set('x-paystack-signature', sign(raw))
      .set('Content-Type', 'application/json')
      .send(raw)
      .expect(200);

    // The creator dashboard shows the credited balance (fee 0 → net 50).
    const me = await request(app)
      .get('/api/v1/creators/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.data.balance.availableBalance).toBe(50);
    expect(me.body.data.balance.totalReceived).toBe(50);

    // Public page now reflects the supporter.
    const page2 = await request(app).get(`/api/v1/creators/${handle}`).expect(200);
    expect(page2.body.data.supporterCount).toBe(1);
    expect(page2.body.data.totalReceived).toBe(50);

    // A duplicate webhook is a harmless no-op (no double credit).
    await request(app)
      .post('/api/v1/webhooks/paystack')
      .set('x-paystack-signature', sign(raw))
      .set('Content-Type', 'application/json')
      .send(raw)
      .expect(200);
    const me2 = await request(app)
      .get('/api/v1/creators/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me2.body.data.balance.availableBalance).toBe(50);
  });

  it('reconcile re-credits a SUCCEEDED tip whose balance credit was lost (crash after the status transition)', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('lostcredit'), password: 'SecurePass123', name: 'Yaa Creator' })
      .expect(201);
    const token = reg.body.data.tokens.accessToken as string;
    const userId = reg.body.data.user.id as string;
    await SubscriptionModel.create({ userId, tier: 'starter', status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000) });
    const handle = `yaa-${randomUUID().slice(0, 6)}`;
    await request(app)
      .post('/api/v1/creators/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ handle, displayName: 'Yaa Creator' })
      .expect(200);

    const tip = await request(app)
      .post(`/api/v1/creators/${handle}/tips`)
      .send({ amount: 40, supporterEmail: 'fan2@example.com', supporterName: 'Abena', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } })
      .expect(201);
    const reference = tip.body.data.reference as string;

    // Simulate the crash window: the tip transitioned to SUCCEEDED but the
    // balance credit never landed (settlementApplied stays false). Backdate it so
    // the stale sweep sees it.
    await TipModel.updateOne({ providerRef: reference }, { $set: { status: 'SUCCEEDED', settlementApplied: false } });
    await TipModel.updateOne(
      { providerRef: reference },
      { $set: { updatedAt: new Date(Date.now() - 3600_000) } },
      { timestamps: false }
    );
    // Not credited yet.
    expect((await CreatorBalanceModel.findOne({ userId }))?.availableBalance ?? 0).toBe(0);

    // Admin runs the payment reconciliation sweep → the uncredited tip is repaired.
    const admReg = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('tipadm'), password: 'SecurePass123', name: 'Adm' }).expect(201);
    await UserModel.findByIdAndUpdate(admReg.body.data.user.id, { role: 'admin' });
    const admLogin = await request(app).post('/api/v1/auth/login').send({ email: admReg.body.data.user.email, password: 'SecurePass123' }).expect(200);
    const sweep = await request(app)
      .post('/api/v1/admin/reconciliation')
      .set('Authorization', `Bearer ${admLogin.body.data.tokens.accessToken}`)
      .send({ olderThanMinutes: 1 })
      .expect(200);
    expect(sweep.body.data.tipsRepaired).toBeGreaterThanOrEqual(1);

    // The creator is now credited, and the tip is flagged settled.
    const me = await request(app).get('/api/v1/creators/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body.data.balance.availableBalance).toBe(40);
    expect(me.body.data.balance.totalReceived).toBe(40);

    // A second sweep does not double-credit (settleRef-idempotent + settled flag).
    await request(app)
      .post('/api/v1/admin/reconciliation')
      .set('Authorization', `Bearer ${admLogin.body.data.tokens.accessToken}`)
      .send({ olderThanMinutes: 1 })
      .expect(200);
    const me2 = await request(app).get('/api/v1/creators/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me2.body.data.balance.availableBalance).toBe(40);
  });

  it('never credits a signed charge.success whose amount differs from the tip, then settles the real one once', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('mismatch'), password: 'SecurePass123', name: 'Esi Creator' }).expect(201);
    const token = reg.body.data.tokens.accessToken as string;
    const userId = reg.body.data.user.id as string;
    await SubscriptionModel.create({ userId, tier: 'starter', status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000) });
    const handle = `esi-${randomUUID().slice(0, 6)}`;
    await request(app).post('/api/v1/creators/profile').set('Authorization', `Bearer ${token}`).send({ handle, displayName: 'Esi Creator' }).expect(200);
    // The public profile exposes the creator's user id, and a guest picks the
    // request key — the reference must still be unpredictable.
    const idempotencyKey = `attack-${randomUUID()}`;
    const tip = await request(app).post(`/api/v1/creators/${handle}/tips`).set('Idempotency-Key', idempotencyKey)
      .send({ amount: 5000, supporterEmail: 'fan3@example.com' }).expect(201);
    const reference = tip.body.data.reference as string;
    const { createHash } = await import('node:crypto');
    expect(reference).not.toBe(`tip-${createHash('sha256').update(JSON.stringify([userId, 'guest', idempotencyKey])).digest('hex')}`);

    const send = async (amountMinor: number, currency = 'GHS') => {
      const raw = JSON.stringify({ event: 'charge.success', data: { reference, amount: amountMinor, fees: 0, currency, status: 'success' } });
      await request(app).post('/api/v1/webhooks/paystack').set('x-paystack-signature', sign(raw)).set('Content-Type', 'application/json').send(raw).expect(200);
    };
    await send(100); // GH₵1 charged for a GH₵5,000 tip
    await send(500000, 'USD');
    expect((await TipModel.findOne({ providerRef: reference }))?.status).toBe('PENDING');
    expect((await CreatorBalanceModel.findOne({ userId }))?.availableBalance ?? 0).toBe(0);

    await send(500000);
    await send(500000);
    expect((await TipModel.findOne({ providerRef: reference }))?.status).toBe('SUCCEEDED');
    expect((await CreatorBalanceModel.findOne({ userId }))?.availableBalance).toBe(5000);
  });

  it('the reconciliation sweep settles a paid tip whose webhook never arrived', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('losthook'), password: 'SecurePass123', name: 'Kwesi Creator' }).expect(201);
    const token = reg.body.data.tokens.accessToken as string;
    const userId = reg.body.data.user.id as string;
    await SubscriptionModel.create({ userId, tier: 'starter', status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000) });
    const handle = `kwesi-${randomUUID().slice(0, 6)}`;
    await request(app).post('/api/v1/creators/profile').set('Authorization', `Bearer ${token}`).send({ handle, displayName: 'Kwesi Creator' }).expect(200);
    const tip = await request(app).post(`/api/v1/creators/${handle}/tips`).send({ amount: 30, supporterEmail: 'fan4@example.com' }).expect(201);
    const reference = tip.body.data.reference as string;
    await TipModel.updateOne({ providerRef: reference }, { $set: { updatedAt: new Date(Date.now() - 3600_000) } }, { timestamps: false });

    const admReg = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('tipadm2'), password: 'SecurePass123', name: 'Adm' }).expect(201);
    await UserModel.findByIdAndUpdate(admReg.body.data.user.id, { role: 'admin' });
    const admLogin = await request(app).post('/api/v1/auth/login').send({ email: admReg.body.data.user.email, password: 'SecurePass123' }).expect(200);
    const sweep = () => request(app).post('/api/v1/admin/reconciliation').set('Authorization', `Bearer ${admLogin.body.data.tokens.accessToken}`).send({ olderThanMinutes: 1 }).expect(200);

    // Still being paid: stays open.
    verifyReply = { status: 'abandoned', amount: 3000, currency: 'GHS' };
    await sweep();
    expect((await TipModel.findOne({ providerRef: reference }))?.status).toBe('PENDING');

    verifyReply = { status: 'success', amount: 3000, currency: 'GHS' };
    await sweep();
    await sweep();
    expect((await TipModel.findOne({ providerRef: reference }))?.status).toBe('SUCCEEDED');
    expect((await CreatorBalanceModel.findOne({ userId }))?.availableBalance).toBe(30);
  });

  it('rejects a taken handle with 409', async () => {
    const reg1 = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('c1'), password: 'SecurePass123', name: 'One' }).expect(201);
    const reg2 = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('c2'), password: 'SecurePass123', name: 'Two' }).expect(201);
    for (const reg of [reg1, reg2]) await SubscriptionModel.create({ userId: reg.body.data.user.id, tier: 'starter', status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000) });
    const handle = `dup-${randomUUID().slice(0, 6)}`;
    await request(app).post('/api/v1/creators/profile').set('Authorization', `Bearer ${reg1.body.data.tokens.accessToken}`).send({ handle, displayName: 'One' }).expect(200);
    await request(app).post('/api/v1/creators/profile').set('Authorization', `Bearer ${reg2.body.data.tokens.accessToken}`).send({ handle, displayName: 'Two' }).expect(409);
  });
  it('blocks Free setup and expired or trial creator donations, including direct API access', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('paid-gate'), password: 'SecurePass123', name: 'Paid Creator' }).expect(201);
    const token = reg.body.data.tokens.accessToken;
    const userId = reg.body.data.user.id;
    const handle = `paid-${randomUUID().slice(0, 6)}`;
    const profile = { handle, displayName: 'Paid Creator' };
    await request(app).post('/api/v1/creators/profile').set('Authorization', `Bearer ${token}`).send(profile).expect(403);
    const free = await request(app).get('/api/v1/creators/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(free.body.data.policy.eligible).toBe(false);
    await SubscriptionModel.create({ userId, tier: 'starter', status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000) });
    await request(app).post('/api/v1/creators/profile').set('Authorization', `Bearer ${token}`).send(profile).expect(200);
    expect((await request(app).get(`/api/v1/creators/${handle}`).expect(200)).body.data.tipsEnabled).toBe(true);
    for (const update of [
      { currentPeriodEnd: new Date(Date.now() - 1000) },
      { currentPeriodEnd: new Date(Date.now() + 86400000), status: 'trialing' },
      { status: 'active', tier: 'free' },
    ]) {
      await SubscriptionModel.updateOne({ userId }, { $set: update });
      expect((await request(app).get(`/api/v1/creators/${handle}`).expect(200)).body.data.tipsEnabled).toBe(false);
      const callsBefore = vi.mocked(fetch).mock.calls.length;
      await request(app).post(`/api/v1/creators/${handle}/tips`).send({ amount: 20, supporterEmail: 'fan@example.com' }).expect(403);
      expect(vi.mocked(fetch).mock.calls.length).toBe(callsBefore);
    }
  });

});
