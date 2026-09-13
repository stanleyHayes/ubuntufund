import { HandleCryptoWebhookUseCase } from '../../src/application/use-cases/HandleCryptoWebhookUseCase.js';
import { MockCryptoProvider } from '../../src/infrastructure/adapters/outbound/crypto/MockCryptoProvider.js';
import { createHmac, randomUUID } from 'node:crypto';

// The crypto rail reads its config at app-construction time, so these must be
// set before createTestApp() lazily imports src/app.ts. This secret also signs
// the mock provider's webhook fixtures.
const CRYPTO_SECRET = 'test-crypto-webhook-secret';
process.env.CRYPTO_PAYMENTS_ENABLED = 'true';
process.env.CRYPTO_PRIMARY_PROVIDER = 'mock';
process.env.CRYPTO_ALLOWED_ASSETS = 'USDT,USDC';
process.env.CRYPTO_MIN_GHS = '10';
process.env.CRYPTO_MAX_GHS = '100000';
process.env.CRYPTO_MOCK_WEBHOOK_SECRET = CRYPTO_SECRET;

import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
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
import { DonationIntentModel } from '../../src/infrastructure/database/models/DonationIntentModel.js';
import { JournalEntryModel } from '../../src/infrastructure/database/models/JournalEntryModel.js';
import { CampaignCategory, CampaignPriority } from '@ubuntu-fund/types';
import { MongoDonationIntentRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.js';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

/** Sign a raw body the way the mock crypto provider verifies it. */
function sign(rawBody: string): string {
  return createHmac('sha256', CRYPTO_SECRET).update(rawBody).digest('hex');
}

async function registerUser(app: Express, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email, password: 'SecurePass123', name: 'Crypto Creator' })
    .expect(201);
  return {
    userId: res.body.data.user.id as string,
    token: res.body.data.tokens.accessToken as string,
  };
}

async function createActiveCampaign(app: Express, token: string, creatorId: string) {
  await UserModel.findByIdAndUpdate(creatorId, { verificationLevel: 2 });
  const res = await request(app)
    .post('/api/v1/campaigns')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Crypto Campaign',
      description: 'A campaign to receive crypto donations',
      goalAmount: 5000,
      currency: 'GHS',
      category: CampaignCategory.EDUCATION,
      priority: CampaignPriority.NORMAL,
      beneficiaries: [],
      endDate: new Date(Date.now() + 7 * 864e5).toISOString(),
    })
    .expect(201);
  const campaignId = res.body.data.id as string;
  await CampaignModel.findByIdAndUpdate(campaignId, { status: 'active' });
  return campaignId;
}

/** Quote → deposit for GHS 1,080 in USDT on TRON (rate 10.8 → 100 USDT). */
async function quoteAndDeposit(app: Express, campaignId: string) {
  const quoteRes = await request(app)
    .post(`/api/v1/campaigns/${campaignId}/donations/crypto/quote`)
    .send({ fiatAmount: 1080, asset: 'USDT', network: 'TRON' })
    .expect(200);
  const quote = quoteRes.body.data;
  expect(quote.rate).toBe(10.8);
  expect(quote.cryptoAmount).toBe(100);

  const depRes = await request(app)
    .post(`/api/v1/campaigns/${campaignId}/donations/crypto`)
    .send({ quoteId: quote.quoteId, donorEmail: 'fan@example.com', donorName: 'Crypto Fan', message: 'Best wishes for the project.', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } })
    .expect(201);
  const agreementIntent = await DonationIntentModel.findById(depRes.body.data.donationIntentId);
  expect(agreementIntent?.messageAgreement?.version).toBe('2026-09-12');
  expect(agreementIntent?.messageAgreement?.acceptedAt).toBeInstanceOf(Date);
  return depRes.body.data as {
    donationIntentId: string;
    providerRef: string;
    walletAddress: string;
    status: string;
  };
}

describe('Crypto donations — stablecoin rail (mock provider)', () => {
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

  it('exposes server-driven assets/networks (allowlist ∩ provider), not client-dictated', async () => {
    const res = await request(app).get('/api/v1/payments/crypto/assets').expect(200);
    expect(res.body.data.enabled).toBe(true);
    const assets = res.body.data.assets.map((a: { asset: string }) => a.asset);
    expect(assets).toContain('USDT');
    expect(assets).toContain('USDC');
    expect(assets).not.toContain('BTC'); // not in CRYPTO_ALLOWED_ASSETS
  });

  it('runs quote → deposit → confirmed webhook → campaign credited with the locked GHS-equivalent', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('crypto'));
    const campaignId = await createActiveCampaign(app, token, userId);

    const deposit = await quoteAndDeposit(app, campaignId);
    expect(deposit.providerRef).toMatch(/^cryp-/);
    expect(deposit.walletAddress).toMatch(/^MOCK-TRON-/);
    expect(deposit.status).toBe('AWAITING_PAYMENT');

    // Not credited yet.
    let campaign = await request(app).get(`/api/v1/campaigns/${campaignId}`).expect(200);
    expect(campaign.body.data.raisedAmount).toBe(0);

    // Provider confirms the deposit → the campaign is credited the GHS-equivalent.
    const raw = JSON.stringify({
      id: `evt-${randomUUID()}`,
      type: 'deposit.confirmed',
      reference: deposit.providerRef,
      transactionHash: '0xabc123',
      cryptoAmount: 100,
      confirmations: 3,
    });
    await request(app)
      .post('/api/v1/webhooks/crypto/mock')
      .set('x-mock-signature', sign(raw))
      .set('Content-Type', 'application/json')
      .send(raw)
      .expect(200);

    const intent = await DonationIntentModel.findById(deposit.donationIntentId);
    expect(intent?.status).toBe('SUCCEEDED');
    expect(intent?.paymentRail).toBe('CRYPTO');
    expect(intent?.cryptoAsset).toBe('USDT');
    expect(intent?.originalCurrency).toBe('USDT');
    expect(intent?.transactionHash).toBe('0xabc123');
    expect(intent?.fxRate).toBe(10.8);
    const feedback = await request(app).get(`/api/v1/donation-intents/${deposit.donationIntentId}/public`).expect(200);
    expect(feedback.body.data).toMatchObject({ status: 'SUCCEEDED', contentReviewStatus: 'pending' });
    expect(feedback.headers['cache-control']).toContain('no-store');
    expect(JSON.stringify(feedback.body.data)).not.toMatch(/Crypto Fan|Best wishes|fan@example/);


    // Campaign raised = the locked GHS amount (1,080), never a re-quoted rate.
    campaign = await request(app).get(`/api/v1/campaigns/${campaignId}`).expect(200);
    expect(campaign.body.data.raisedAmount).toBe(1080);
  });

  it('is idempotent: a duplicate confirmed webhook never double-credits', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('cdup'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const deposit = await quoteAndDeposit(app, campaignId);

    const raw = JSON.stringify({
      id: `evt-dup-${randomUUID()}`,
      type: 'deposit.confirmed',
      reference: deposit.providerRef,
      confirmations: 5,
    });
    const signature = sign(raw);
    const post = () =>
      request(app)
        .post('/api/v1/webhooks/crypto/mock')
        .set('x-mock-signature', signature)
        .set('Content-Type', 'application/json')
        .send(raw);

    expect((await post()).body.status).toBe('ok');
    expect((await post()).body.status).toBe('duplicate');

    // Exactly one ledger entry; raised credited exactly once.
    const entries = await JournalEntryModel.find({ donationIntentId: deposit.donationIntentId });
    expect(entries).toHaveLength(1);
    const campaign = await request(app).get(`/api/v1/campaigns/${campaignId}`).expect(200);
    expect(campaign.body.data.raisedAmount).toBe(1080);
  });

  it('rejects a webhook with an invalid signature (401) and settles nothing', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('csig'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const deposit = await quoteAndDeposit(app, campaignId);

    const raw = JSON.stringify({
      id: `evt-${randomUUID()}`,
      type: 'deposit.confirmed',
      reference: deposit.providerRef,
      confirmations: 3,
    });
    await request(app)
      .post('/api/v1/webhooks/crypto/mock')
      .set('x-mock-signature', 'not-a-valid-signature')
      .set('Content-Type', 'application/json')
      .send(raw)
      .expect(401);

    const intent = await DonationIntentModel.findById(deposit.donationIntentId);
    expect(intent?.status).toBe('PENDING');
  });

  it('rejects an unsupported/disallowed asset at quote time (400)', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('casset'));
    const campaignId = await createActiveCampaign(app, token, userId);
    await request(app)
      .post(`/api/v1/campaigns/${campaignId}/donations/crypto/quote`)
      .send({ fiatAmount: 1080, asset: 'BTC', network: 'BITCOIN' })
      .expect(400);
  });

  it('rejects malformed recovery controls before reading deposits and preserves admin access checks', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('recovery-validation'));
    const scan = vi.spyOn(MongoDonationIntentRepository.prototype, 'findStaleCrypto').mockResolvedValue([]);
    const run = (body: object) => request(app).post('/api/v1/admin/crypto/reconcile').set('Authorization', `Bearer ${token}`).send(body);
    try {
      await request(app).post('/api/v1/admin/crypto/reconcile').send({}).expect(401);
      await run({ olderThanMinutes: -1 }).expect(403);
      await UserModel.updateOne({ _id: userId }, { $set: { role: 'admin' } });
      for (const body of [{ olderThanMinutes: -1 }, { olderThanMinutes: '30' }, { olderThanMinutes: null }, { olderThanMinutes: {} }, { olderThanMinutes: 1e300 }, { limit: 0 }]) {
        await run(body).expect(400);
      }
      expect(scan).not.toHaveBeenCalled();
      await run({}).expect(200);
      expect(scan).toHaveBeenLastCalledWith(expect.any(Date), 100);
      await run({ olderThanMinutes: 0 }).expect(200);
      expect(scan).toHaveBeenCalledTimes(2);
    } finally { scan.mockRestore(); }
  });

  it('continues after a deposit application error and retries without duplicating successful credit', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('partial-recovery'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const first = await quoteAndDeposit(app, campaignId);
    const second = await quoteAndDeposit(app, campaignId);
    await DonationIntentModel.updateMany({ _id: { $in: [first.donationIntentId, second.donationIntentId] } }, { $set: { updatedAt: new Date(Date.now() - 3600000) } }, { timestamps: false });
    await UserModel.updateOne({ _id: userId }, { $set: { role: 'admin' } });
    const original = HandleCryptoWebhookUseCase.prototype.applyEvent;
    const apply = vi.spyOn(HandleCryptoWebhookUseCase.prototype, 'applyEvent').mockImplementation(async function (this: HandleCryptoWebhookUseCase, intent, event) {
      if (intent.id === first.donationIntentId) throw new Error('Fixture settlement unavailable');
      return original.call(this, intent, event);
    });
    try {
      const result = await request(app).post('/api/v1/admin/crypto/reconcile').set('Authorization', `Bearer ${token}`).send({ olderThanMinutes: 1 }).expect(200);
      expect(result.body.data.errored).toBeGreaterThanOrEqual(1);
      expect((await DonationIntentModel.findById(second.donationIntentId))?.status).toBe('SUCCEEDED');
      expect((await DonationIntentModel.findById(first.donationIntentId))?.status).not.toBe('SUCCEEDED');
      expect((await CampaignModel.findById(campaignId))?.raisedAmount).toBe(1080);
    } finally { apply.mockRestore(); }
    await request(app).post('/api/v1/admin/crypto/reconcile').set('Authorization', `Bearer ${token}`).send({ olderThanMinutes: 1 }).expect(200);
    expect((await DonationIntentModel.findById(first.donationIntentId))?.status).toBe('SUCCEEDED');
    expect((await CampaignModel.findById(campaignId))?.raisedAmount).toBe(2160);
  });

  it('does not report settlement before required crypto confirmations', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('finality-summary'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const deposit = await quoteAndDeposit(app, campaignId);
    await DonationIntentModel.updateOne({ _id: deposit.donationIntentId }, { $set: { requiredConfirmations: 20, updatedAt: new Date(Date.now() - 3600000) } }, { timestamps: false });
    await UserModel.updateOne({ _id: userId }, { $set: { role: 'admin' } });
    const provider = vi.spyOn(MockCryptoProvider.prototype, 'getDeposit').mockResolvedValue({ status: 'confirmed', confirmations: 1 });
    try {
      const result = await request(app).post('/api/v1/admin/crypto/reconcile').set('Authorization', `Bearer ${token}`).send({ olderThanMinutes: 1 }).expect(200);
      expect(result.body.data.settled).toBe(0);
      expect(result.body.data.detected).toBeGreaterThanOrEqual(1);
      expect((await DonationIntentModel.findById(deposit.donationIntentId))?.status).toBe('PROCESSING');
      expect((await CampaignModel.findById(campaignId))?.raisedAmount).toBe(0);
    } finally { provider.mockRestore(); }
  });

  it('reconciliation settles an existing deposit while new crypto intake is disabled without double-credit', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('crec'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const deposit = await quoteAndDeposit(app, campaignId);

    // Simulate a missed webhook: backdate the intent so the sweep sees it stale.
    await DonationIntentModel.updateOne(
      { _id: deposit.donationIntentId },
      { $set: { updatedAt: new Date(Date.now() - 3600_000) } },
      { timestamps: false }
    );

    // An admin runs the crypto reconciliation sweep → provider reports confirmed.
    const admReg = await request(app).post('/api/v1/auth/register').send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('cadm'), password: 'SecurePass123', name: 'Adm' }).expect(201);
    await UserModel.findByIdAndUpdate(admReg.body.data.user.id, { role: 'admin' });
    const admLogin = await request(app).post('/api/v1/auth/login').send({ email: admReg.body.data.user.email, password: 'SecurePass123' }).expect(200);
    const adminToken = admLogin.body.data.tokens.accessToken as string;

    const { config } = await import('../../src/infrastructure/config/index.js');
    const wasEnabled = config.crypto.enabled;
    config.crypto.enabled = false;
    try {
      const assets = await request(app).get('/api/v1/payments/crypto/assets').expect(200);
      expect(assets.body.data).toMatchObject({ enabled: false, assets: [] });
      await request(app).post(`/api/v1/campaigns/${campaignId}/donations/crypto/quote`)
        .send({ fiatAmount: 1080, asset: 'USDT', network: 'TRON' }).expect(400);
      await request(app).post(`/api/v1/campaigns/${campaignId}/donations/crypto`)
        .send({ quoteId: 'disabled-quote', donorEmail: 'fixture@example.com' }).expect(400);
    const first = await request(app)
      .post('/api/v1/admin/crypto/reconcile')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ olderThanMinutes: 1 })
      .expect(200);
    expect(first.body.data.settled).toBeGreaterThanOrEqual(1);

    let campaign = await request(app).get(`/api/v1/campaigns/${campaignId}`).expect(200);
    expect(campaign.body.data.raisedAmount).toBe(1080);

    // A second sweep finds nothing stale (it's SUCCEEDED) → no double credit.
    await request(app)
      .post('/api/v1/admin/crypto/reconcile')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ olderThanMinutes: 1 })
      .expect(200);
    campaign = await request(app).get(`/api/v1/campaigns/${campaignId}`).expect(200);
    expect(campaign.body.data.raisedAmount).toBe(1080);
    } finally { config.crypto.enabled = wasEnabled; }
  });
});
