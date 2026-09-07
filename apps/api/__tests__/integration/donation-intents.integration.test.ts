import { randomUUID } from 'node:crypto';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
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
import { WalletModel } from '../../src/infrastructure/database/models/WalletModel.js';
import { CampaignBalanceModel } from '../../src/infrastructure/database/models/CampaignBalanceModel.js';
import { JournalEntryModel } from '../../src/infrastructure/database/models/JournalEntryModel.js';
import { JournalLineModel } from '../../src/infrastructure/database/models/JournalLineModel.js';
import { DonationIntentModel } from '../../src/infrastructure/database/models/DonationIntentModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import {
  CampaignCategory,
  CampaignPriority,
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
} from '@ubuntu-fund/types';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

async function registerUser(app: Express, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SecurePass123', name: 'Test User' })
    .expect(201);
  return {
    userId: res.body.data.user.id as string,
    token: res.body.data.tokens.accessToken as string,
  };
}

async function createActiveCampaign(app: Express, creatorToken: string, creatorId: string) {
  await UserModel.findByIdAndUpdate(creatorId, { verificationLevel: 2 });
  const createRes = await request(app)
    .post('/api/v1/campaigns')
    .set('Authorization', `Bearer ${creatorToken}`)
    .send({
      title: 'Intent Campaign',
      description: 'A campaign to receive donation intents',
      goalAmount: 5000,
      currency: 'GHS',
      category: CampaignCategory.EDUCATION,
      priority: CampaignPriority.NORMAL,
      beneficiaries: [],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .expect(201);
  const campaignId = createRes.body.data.id as string;
  await CampaignModel.findByIdAndUpdate(campaignId, { status: 'active' });
  return campaignId;
}

async function getWalletId(app: Express, token: string): Promise<string> {
  const res = await request(app)
    .get('/api/v1/wallets')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  return res.body.data[0].id as string;
}

async function fundWallet(walletId: string, balance: number): Promise<void> {
  await WalletModel.findByIdAndUpdate(walletId, { $set: { balance } });
}

describe('Donation Intents Integration', () => {
  let app: Express;
  // This suite asserts the Paystack rail's "not configured" behaviour, so the
  // app MUST be built with the Paystack secret absent regardless of the
  // developer's local .env. config/index.ts reads these at construction time
  // via dotenv (override:false), so an empty string assigned before
  // createTestApp() survives — a `delete` would let dotenv repopulate it from
  // .env. Originals are restored in afterAll to avoid leaking into later files.
  const PAYSTACK_ENV_KEYS = ['PAYSTACK_SECRET_KEY', 'PAYSTACK_PUBLIC_KEY'] as const;
  const savedPaystackEnv: Partial<Record<(typeof PAYSTACK_ENV_KEYS)[number], string | undefined>> = {};

  beforeAll(async () => {
    for (const key of PAYSTACK_ENV_KEYS) {
      savedPaystackEnv[key] = process.env[key];
      process.env[key] = '';
    }
    await connectTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    for (const key of PAYSTACK_ENV_KEYS) {
      const value = savedPaystackEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  it('settles a wallet donation intent: debits wallet, posts a balanced ledger entry, projects raised + balance', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(app, uniqueEmail('creator'));
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId);

    const { userId: donorId, token: donorToken } = await registerUser(app, uniqueEmail('donor'));
    const walletId = await getWalletId(app, donorToken);
    await fundWallet(walletId, 1000);

    const res = await request(app)
      .post('/api/v1/donation-intents')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        campaignId,
        amount: 500,
        tip: 50,
        provider: 'wallet',
        message: 'For the kids',
        isAnonymous: false,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('SUCCEEDED');
    expect(res.body.data.provider).toBe('wallet');
    const intentId = res.body.data.id as string;

    // Wallet debited amount + tip.
    const walletRes = await request(app)
      .get(`/api/v1/wallets/${walletId}`)
      .set('Authorization', `Bearer ${donorToken}`);
    expect(walletRes.body.data.balance).toBe(450);

    // Campaign raised total projected (tip excluded).
    const campaignRes = await request(app).get(`/api/v1/campaigns/${campaignId}`);
    expect(campaignRes.body.data.raisedAmount).toBe(500);

    // Balanced, immutable journal entry recorded for the intent.
    const entry = await JournalEntryModel.findOne({ donationIntentId: intentId });
    expect(entry).not.toBeNull();
    const lines = await JournalLineModel.find({ journalEntryId: entry!._id!.toString() });
    const debits = lines.filter((l) => l.direction === 'debit').reduce((s, l) => s + l.amount, 0);
    const credits = lines.filter((l) => l.direction === 'credit').reduce((s, l) => s + l.amount, 0);
    expect(debits).toBe(credits);
    // amount(500) + tip(500->debit tip 50) => debit 550 == credit 550
    expect(debits).toBe(550);
    const campaignDebit = lines.find((l) => l.accountKind === 'campaign' && l.direction === 'debit');
    expect(campaignDebit?.amount).toBe(500);

    // Campaign balance read model: beneficiary-net pending, tip tracked.
    // The creator is on the Free plan (3.5% platform fee): net = 500 - 17.50.
    const balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.totalRaised).toBe(500);
    expect(balance?.pendingBalance).toBe(482.5); // 500 - 17.50 platform (Free 3.5%)
    expect(balance?.platformFees).toBe(17.5);
    expect(balance?.availableBalance).toBe(0);
    expect(balance?.tips).toBe(50);

    // Public status polling.
    const publicRes = await request(app).get(`/api/v1/donation-intents/${intentId}/public`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.status).toBe('SUCCEEDED');
    expect(publicRes.body.data.idempotencyKey).toBeUndefined();

    // Donation recorded under the donor, visible in their history.
    const mineRes = await request(app)
      .get('/api/v1/donations/mine')
      .set('Authorization', `Bearer ${donorToken}`);
    expect(mineRes.body.data.some((d: { campaignId: string }) => d.campaignId === campaignId)).toBe(true);
    void donorId;
  });

  it('applies the campaign creator\'s plan platform fee rate (Pro 2.5%, not Free 3.5%)', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(app, uniqueEmail('procreator'));
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId);
    // Put the creator on the Pro plan (2% platform fee).
    const now = new Date();
    await SubscriptionModel.create({
      userId: creatorId,
      tier: SubscriptionTier.PRO,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    });

    const { token: donorToken } = await registerUser(app, uniqueEmail('prodonor'));
    const walletId = await getWalletId(app, donorToken);
    await fundWallet(walletId, 1000);

    const res = await request(app)
      .post('/api/v1/donation-intents')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ campaignId, amount: 500, provider: 'wallet', isAnonymous: false });
    expect(res.status).toBe(201);

    // Pro plan → 2.5% of 500 = 12.50 platform fee, net 487.50 (vs Free 3.5% = 17.50 / net 482.50).
    const balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.platformFees).toBe(12.5);
    expect(balance?.pendingBalance).toBe(487.5);
  });

  it('is idempotent: the same Idempotency-Key never charges twice', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(app, uniqueEmail('creator2'));
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId);
    const { token: donorToken } = await registerUser(app, uniqueEmail('donor2'));
    const walletId = await getWalletId(app, donorToken);
    await fundWallet(walletId, 1000);

    const key = `idem-${randomUUID()}`;
    const body = { campaignId, amount: 300, provider: 'wallet', isAnonymous: false };

    const first = await request(app)
      .post('/api/v1/donation-intents')
      .set('Authorization', `Bearer ${donorToken}`)
      .set('Idempotency-Key', key)
      .send(body);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/donation-intents')
      .set('Authorization', `Bearer ${donorToken}`)
      .set('Idempotency-Key', key)
      .send(body);
    expect(second.status).toBe(201);

    // Same intent resolved both times.
    expect(second.body.data.id).toBe(first.body.data.id);

    // Debited exactly once.
    const walletRes = await request(app)
      .get(`/api/v1/wallets/${walletId}`)
      .set('Authorization', `Bearer ${donorToken}`);
    expect(walletRes.body.data.balance).toBe(700);

    // Exactly one intent + one ledger entry for the key.
    const intents = await DonationIntentModel.find({ idempotencyKey: key });
    expect(intents).toHaveLength(1);
    const entries = await JournalEntryModel.find({ donationIntentId: first.body.data.id });
    expect(entries).toHaveLength(1);
  });

  it('rejects a wallet intent with insufficient balance and takes no money', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(app, uniqueEmail('creator3'));
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId);
    const { token: donorToken } = await registerUser(app, uniqueEmail('donor3'));
    const walletId = await getWalletId(app, donorToken);
    await fundWallet(walletId, 100);

    const res = await request(app)
      .post('/api/v1/donation-intents')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ campaignId, amount: 500, provider: 'wallet', isAnonymous: false });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Insufficient wallet balance');

    const walletRes = await request(app)
      .get(`/api/v1/wallets/${walletId}`)
      .set('Authorization', `Bearer ${donorToken}`);
    expect(walletRes.body.data.balance).toBe(100);

    const campaignRes = await request(app).get(`/api/v1/campaigns/${campaignId}`);
    expect(campaignRes.body.data.raisedAmount).toBe(0);
  });

  it('returns 501 for a Paystack intent when the gateway is not configured', async () => {
    // This suite runs with PAYSTACK_SECRET_KEY unset, so the Paystack rail is
    // disabled: the request is rejected before any intent is persisted.
    const { userId: creatorId, token: creatorToken } = await registerUser(app, uniqueEmail('creator4'));
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId);

    // No Authorization header → guest checkout.
    const res = await request(app)
      .post('/api/v1/donation-intents')
      .send({
        campaignId,
        amount: 200,
        provider: 'paystack',
        donorEmail: 'guest@example.com',
        donorName: 'Generous Guest',
        isAnonymous: false,
      });
    expect(res.status).toBe(501);
    expect(res.body.message).toBe('Payments are not configured');

    // Nothing persisted or settled: no intent created, raised untouched.
    const intents = await DonationIntentModel.find({ campaignId });
    expect(intents).toHaveLength(0);
    const campaignRes = await request(app).get(`/api/v1/campaigns/${campaignId}`);
    expect(campaignRes.body.data.raisedAmount).toBe(0);
  });

  it('rejects a guest wallet intent (wallet requires authentication)', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(app, uniqueEmail('creator5'));
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId);

    const res = await request(app)
      .post('/api/v1/donation-intents')
      .send({ campaignId, amount: 100, provider: 'wallet', isAnonymous: false });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Wallet donations require an authenticated account');
  });

  it('lets the donor edit their donation message but blocks others', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(app, uniqueEmail('creator6'));
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId);
    const { token: donorToken } = await registerUser(app, uniqueEmail('donor6'));
    const walletId = await getWalletId(app, donorToken);
    await fundWallet(walletId, 1000);

    await request(app)
      .post('/api/v1/donation-intents')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ campaignId, amount: 250, provider: 'wallet', isAnonymous: false })
      .expect(201);

    const mineRes = await request(app)
      .get('/api/v1/donations/mine')
      .set('Authorization', `Bearer ${donorToken}`);
    const donationId = mineRes.body.data[0].id as string;

    const editRes = await request(app)
      .post(`/api/v1/donations/${donationId}/message`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ message: 'Wishing you all the best!' });
    expect(editRes.status).toBe(200);
    expect(editRes.body.data.message).toBe('Wishing you all the best!');

    const { token: strangerToken } = await registerUser(app, uniqueEmail('stranger6'));
    const blockedRes = await request(app)
      .post(`/api/v1/donations/${donationId}/message`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .send({ message: 'Not my donation' });
    expect(blockedRes.status).toBe(403);
  });
});
