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
      .send({ email: uniqueEmail('creator'), password: 'SecurePass123', name: 'Ama Creator' })
      .expect(201);
    const token = reg.body.data.tokens.accessToken as string;
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
      .send({ amount: 50, supporterEmail: 'fan@example.com', supporterName: 'Kofi', message: 'Love your work!' })
      .expect(201);
    const reference = tip.body.data.reference as string;
    expect(reference.startsWith('tip-')).toBe(true);
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
      .send({ email: uniqueEmail('lostcredit'), password: 'SecurePass123', name: 'Yaa Creator' })
      .expect(201);
    const token = reg.body.data.tokens.accessToken as string;
    const userId = reg.body.data.user.id as string;
    const handle = `yaa-${randomUUID().slice(0, 6)}`;
    await request(app)
      .post('/api/v1/creators/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ handle, displayName: 'Yaa Creator' })
      .expect(200);

    const tip = await request(app)
      .post(`/api/v1/creators/${handle}/tips`)
      .send({ amount: 40, supporterEmail: 'fan2@example.com', supporterName: 'Abena' })
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
    const admReg = await request(app).post('/api/v1/auth/register').send({ email: uniqueEmail('tipadm'), password: 'SecurePass123', name: 'Adm' }).expect(201);
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

  it('rejects a taken handle with 409', async () => {
    const reg1 = await request(app).post('/api/v1/auth/register').send({ email: uniqueEmail('c1'), password: 'SecurePass123', name: 'One' }).expect(201);
    const reg2 = await request(app).post('/api/v1/auth/register').send({ email: uniqueEmail('c2'), password: 'SecurePass123', name: 'Two' }).expect(201);
    const handle = `dup-${randomUUID().slice(0, 6)}`;
    await request(app).post('/api/v1/creators/profile').set('Authorization', `Bearer ${reg1.body.data.tokens.accessToken}`).send({ handle, displayName: 'One' }).expect(200);
    await request(app).post('/api/v1/creators/profile').set('Authorization', `Bearer ${reg2.body.data.tokens.accessToken}`).send({ handle, displayName: 'Two' }).expect(409);
  });
});
