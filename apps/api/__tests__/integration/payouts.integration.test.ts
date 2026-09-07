import { createHmac, randomUUID } from 'node:crypto';

// The Paystack rail reads its secret from config at app-construction time, so it
// MUST be set before createTestApp() (which lazily imports src/app.ts) runs.
const PAYSTACK_SECRET = 'sk_test_paystack_secret_for_payout_tests';
process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET;
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_paystack_public_for_payout_tests';
process.env.PUBLIC_WEB_URL = 'https://give.example.test';
// Maker-checker kicks in at GHS 40k: every existing single-transfer test below
// stays under it (single approval), while the dual-approval + batching tests go
// over it. Set before createTestApp() reads config.
process.env.PAYOUT_DUAL_APPROVAL_AMOUNT = '40000';

import {
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  expect,
  vi,
} from 'vitest';
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
import { JournalLineModel } from '../../src/infrastructure/database/models/JournalLineModel.js';
import { CampaignCategory, CampaignPriority } from '@ubuntu-fund/types';

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

/** HMAC-SHA512 the raw body exactly as Paystack does. */
function sign(rawBody: string): string {
  return createHmac('sha512', PAYSTACK_SECRET).update(rawBody).digest('hex');
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

async function createAdmin(app: Express, email: string) {
  const { userId } = await registerUser(app, email);
  await UserModel.findByIdAndUpdate(userId, { role: 'admin' });
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'SecurePass123' })
    .expect(200);
  return { userId, token: loginRes.body.data.tokens.accessToken as string };
}

async function createActiveCampaign(
  app: Express,
  creatorToken: string,
  creatorId: string
) {
  await UserModel.findByIdAndUpdate(creatorId, { verificationLevel: 2 });
  const createRes = await request(app)
    .post('/api/v1/campaigns')
    .set('Authorization', `Bearer ${creatorToken}`)
    .send({
      title: 'Payout Campaign',
      description: 'A campaign whose funds will be paid out',
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

/**
 * Settle a `donationAmount` donation on a campaign via the authoritative
 * charge.success webhook (no processor fee, no tip), leaving beneficiary-net in
 * `pendingBalance`. The creator is on the Free plan (3.5% platform fee), so the
 * net cleared is `donationAmount * 0.965`.
 */
async function fundCampaign(
  app: Express,
  campaignId: string,
  donationAmount: number
) {
  const checkout = await request(app)
    .post('/api/v1/donation-intents')
    .send({
      campaignId,
      amount: donationAmount,
      tip: 0,
      provider: 'paystack',
      donorEmail: 'donor@example.com',
      donorName: 'Donor',
      isAnonymous: false,
    })
    .expect(201);
  const reference = checkout.body.data.reference as string;

  const event = {
    event: 'charge.success',
    data: {
      reference,
      amount: donationAmount * 100,
      fees: 0,
      currency: 'GHS',
      status: 'success',
    },
  };
  const raw = JSON.stringify(event);
  await request(app)
    .post('/api/v1/webhooks/paystack')
    .set('x-paystack-signature', sign(raw))
    .set('Content-Type', 'application/json')
    .send(raw)
    .expect(200);
}

async function addRecipient(
  app: Express,
  campaignId: string,
  ownerToken: string
) {
  return request(app)
    .post(`/api/v1/campaigns/${campaignId}/payout-recipient`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      type: 'mobile_money',
      accountNumber: '0551234567',
      bankCode: 'MTN',
      accountName: 'Jane Beneficiary',
    });
}

async function sendTransferWebhook(
  app: Express,
  eventType: 'transfer.success' | 'transfer.failed' | 'transfer.reversed',
  reference: string
) {
  const event = {
    event: eventType,
    data: { reference, status: eventType.split('.')[1] },
  };
  const raw = JSON.stringify(event);
  return request(app)
    .post('/api/v1/webhooks/paystack')
    .set('x-paystack-signature', sign(raw))
    .set('Content-Type', 'application/json')
    .send(raw);
}

describe('Payouts Integration', () => {
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

  beforeEach(() => {
    // Route every Paystack call the payout flow makes. No real network.
    const fetchMock = vi.fn(async (url: unknown, opts: unknown) => {
      const u = String(url);
      const body = (opts as { body?: string })?.body
        ? (JSON.parse((opts as { body: string }).body) as Record<string, unknown>)
        : {};

      if (u.includes('/transaction/initialize')) {
        const reference = body.reference as string;
        return jsonResponse({
          status: true,
          message: 'Authorization URL created',
          data: {
            authorization_url: `https://checkout.paystack.com/${reference}`,
            access_code: `acc_${reference}`,
            reference,
          },
        });
      }
      if (u.includes('/transferrecipient')) {
        return jsonResponse({
          status: true,
          message: 'Recipient created',
          data: { recipient_code: `RCP_${randomUUID().slice(0, 8)}` },
        });
      }
      if (u.includes('/balance')) {
        return jsonResponse({
          status: true,
          message: 'Balances retrieved',
          // 1,000,000 GHS in pesewas — always enough for the test payouts.
          data: [{ currency: 'GHS', balance: 100_000_000 }],
        });
      }
      if (u.includes('/transfer')) {
        const reference = body.reference as string;
        return jsonResponse({
          status: true,
          message: 'Transfer has been queued',
          data: {
            transfer_code: `TRF_${randomUUID().slice(0, 8)}`,
            status: 'pending',
            reference,
          },
        });
      }
      throw new Error(`unexpected fetch to ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  function jsonResponse(payload: unknown): Response {
    return {
      ok: true,
      status: 200,
      json: async () => payload,
    } as unknown as Response;
  }

  it('registers a payout recipient for the campaign (owner)', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('rcp'));
    const campaignId = await createActiveCampaign(app, token, userId);

    const res = await addRecipient(app, campaignId, token);
    expect(res.status).toBe(201);
    expect(res.body.data.recipientCode).toMatch(/^RCP_/);
    expect(res.body.data.type).toBe('mobile_money');
    expect(res.body.data.campaignId).toBe(campaignId);
  });

  it('non-owners cannot register a payout recipient', async () => {
    const owner = await registerUser(app, uniqueEmail('own'));
    const campaignId = await createActiveCampaign(app, owner.token, owner.userId);
    const stranger = await registerUser(app, uniqueEmail('stranger'));

    const res = await addRecipient(app, campaignId, stranger.token);
    expect(res.status).toBe(403);
  });

  it('request + approve initiates a transfer and reserves available funds', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('flow'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const admin = await createAdmin(app, uniqueEmail('admin'));

    await fundCampaign(app, campaignId, 1000); // pending net 965 (Free 3.5%)
    await addRecipient(app, campaignId, token);

    // Owner requests a payout of the full cleared amount.
    const reqRes = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/payouts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 965 });
    expect(reqRes.status).toBe(201);
    expect(reqRes.body.data.status).toBe('PENDING');
    const payoutId = reqRes.body.data.id as string;

    // Requesting clears pending → available (no reservation yet).
    let balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.pendingBalance).toBe(0);
    expect(balance?.availableBalance).toBe(965);

    // Admin approves → transfer initiated, funds reserved out of available.
    const approveRes = await request(app)
      .post(`/api/v1/payouts/${payoutId}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('PROCESSING');
    expect(approveRes.body.data.providerRef).toMatch(/^pout-/);
    expect(approveRes.body.data.transferCode).toMatch(/^TRF_/);
    expect(approveRes.body.data.approvedBy).toBe(admin.userId);

    balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.availableBalance).toBe(0); // in transit
    expect(balance?.paidOutBalance).toBe(0);
  });

  it('a non-admin cannot approve a payout', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('noadmin'));
    const campaignId = await createActiveCampaign(app, token, userId);
    await fundCampaign(app, campaignId, 1000);
    await addRecipient(app, campaignId, token);
    const reqRes = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/payouts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 500 });
    const payoutId = reqRes.body.data.id as string;

    const res = await request(app)
      .post(`/api/v1/payouts/${payoutId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('settles on transfer.success: Payout PAID, funds paidOut, ledger posted, idempotent', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('paid'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const admin = await createAdmin(app, uniqueEmail('admin'));

    await fundCampaign(app, campaignId, 1000);
    await addRecipient(app, campaignId, token);
    const reqRes = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/payouts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 965 });
    const payoutId = reqRes.body.data.id as string;
    const approveRes = await request(app)
      .post(`/api/v1/payouts/${payoutId}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    const reference = approveRes.body.data.providerRef as string;

    // transfer.success → PAID.
    const wh = await sendTransferWebhook(app, 'transfer.success', reference);
    expect(wh.status).toBe(200);

    let payout = await PayoutModel.findById(payoutId);
    expect(payout?.status).toBe('PAID');

    let balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.paidOutBalance).toBe(965);
    expect(balance?.availableBalance).toBe(0);
    expect(balance?.pendingBalance).toBe(0);

    // Immutable payout disbursement journal: debit beneficiary, credit payout.
    const payoutCredits = await JournalLineModel.find({
      accountKind: 'payout',
      accountOwnerId: campaignId,
      direction: 'credit',
    });
    expect(payoutCredits).toHaveLength(1);
    expect(payoutCredits[0]!.amount).toBe(965);
    const beneficiaryDebits = await JournalLineModel.find({
      accountKind: 'beneficiary',
      accountOwnerId: campaignId,
      direction: 'debit',
    });
    expect(beneficiaryDebits).toHaveLength(1);
    expect(beneficiaryDebits[0]!.amount).toBe(965);

    // Duplicate webhook is a no-op: still PAID, balances + ledger unchanged.
    const dup = await sendTransferWebhook(app, 'transfer.success', reference);
    expect(dup.status).toBe(200);
    payout = await PayoutModel.findById(payoutId);
    expect(payout?.status).toBe('PAID');
    balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.paidOutBalance).toBe(965);
    const payoutCreditsAfter = await JournalLineModel.find({
      accountKind: 'payout',
      accountOwnerId: campaignId,
      direction: 'credit',
    });
    expect(payoutCreditsAfter).toHaveLength(1);
  });

  it('applies a priority payout fee: transfers the net, retains the fee (spec §17)', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('priority'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const admin = await createAdmin(app, uniqueEmail('admin'));

    await fundCampaign(app, campaignId, 1000); // net 965 available (Free 3.5%)
    await addRecipient(app, campaignId, token);
    const reqRes = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/payouts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 965, type: 'priority' });
    expect(reqRes.status).toBe(201);
    // Priority fee = max(0.5% of 965 = 4.83, min 10) = 10; net = 955.
    expect(reqRes.body.data.type).toBe('priority');
    expect(reqRes.body.data.fee).toBe(10);
    expect(reqRes.body.data.netAmount).toBe(955);

    const payoutId = reqRes.body.data.id as string;
    const approveRes = await request(app)
      .post(`/api/v1/payouts/${payoutId}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    const reference = approveRes.body.data.providerRef as string;
    await sendTransferWebhook(app, 'transfer.success', reference);

    // Gross 965 left available; 955 disbursed (paidOut) + 10 retained (payoutFees).
    const balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.paidOutBalance).toBe(955);
    expect(balance?.payoutFees).toBe(10);
    expect(balance?.availableBalance).toBe(0);
  });

  it('caps an early payout at the reserve ceiling (80% of eligible)', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('early'));
    const campaignId = await createActiveCampaign(app, token, userId);

    await fundCampaign(app, campaignId, 1000); // eligible 965
    await addRecipient(app, campaignId, token);
    // 80% of 965 = 772; an early request for 900 exceeds the ceiling.
    const res = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/payouts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 900, type: 'early' });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/capped at 80%/i);
  });

  it('reverts to available on transfer.failed (no funds paid out)', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('fail'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const admin = await createAdmin(app, uniqueEmail('admin'));

    await fundCampaign(app, campaignId, 1000);
    await addRecipient(app, campaignId, token);
    const reqRes = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/payouts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 965 });
    const payoutId = reqRes.body.data.id as string;
    const approveRes = await request(app)
      .post(`/api/v1/payouts/${payoutId}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    const reference = approveRes.body.data.providerRef as string;

    // Reserved out of available.
    let balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.availableBalance).toBe(0);

    const wh = await sendTransferWebhook(app, 'transfer.failed', reference);
    expect(wh.status).toBe(200);

    const payout = await PayoutModel.findById(payoutId);
    expect(payout?.status).toBe('FAILED');

    balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.availableBalance).toBe(965); // returned
    expect(balance?.paidOutBalance).toBe(0);

    // No payout journal entry was posted (nothing left the platform).
    const payoutLines = await JournalLineModel.find({
      accountKind: 'payout',
      accountOwnerId: campaignId,
    });
    expect(payoutLines).toHaveLength(0);
  });

  it('returns paidOut → available with a reversing journal on transfer.reversed', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('rev'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const admin = await createAdmin(app, uniqueEmail('admin'));

    await fundCampaign(app, campaignId, 1000);
    await addRecipient(app, campaignId, token);
    const reqRes = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/payouts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 965 });
    const payoutId = reqRes.body.data.id as string;
    const approveRes = await request(app)
      .post(`/api/v1/payouts/${payoutId}/approve`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    const reference = approveRes.body.data.providerRef as string;

    await sendTransferWebhook(app, 'transfer.success', reference);
    const reversed = await sendTransferWebhook(app, 'transfer.reversed', reference);
    expect(reversed.status).toBe(200);

    const payout = await PayoutModel.findById(payoutId);
    expect(payout?.status).toBe('REVERSED');

    const balance = await CampaignBalanceModel.findOne({ campaignId });
    expect(balance?.paidOutBalance).toBe(0);
    expect(balance?.availableBalance).toBe(965);

    // One disbursement + one reversing entry: net payout credits === debits.
    const payoutLines = await JournalLineModel.find({
      accountKind: 'payout',
      accountOwnerId: campaignId,
    });
    const credits = payoutLines
      .filter((l) => l.direction === 'credit')
      .reduce((s, l) => s + l.amount, 0);
    const debits = payoutLines
      .filter((l) => l.direction === 'debit')
      .reduce((s, l) => s + l.amount, 0);
    expect(credits).toBe(965);
    expect(debits).toBe(965);
  });

  // Maker-checker + batching (spec §16, §17). These share one owner and two
  // admins to stay under the 30/15-min auth rate limit the whole file draws on.
  describe('high-value payouts: maker-checker + batching', () => {
    let owner: { userId: string; token: string };
    let admin1: { userId: string; token: string };
    let admin2: { userId: string; token: string };

    beforeAll(async () => {
      owner = await registerUser(app, uniqueEmail('hv-owner'));
      admin1 = await createAdmin(app, uniqueEmail('hv-admin1'));
      admin2 = await createAdmin(app, uniqueEmail('hv-admin2'));
    });

    async function fundedCampaignWithRecipient(
      donation: number
    ): Promise<string> {
      const campaignId = await createActiveCampaign(app, owner.token, owner.userId);
      await fundCampaign(app, campaignId, donation);
      await addRecipient(app, campaignId, owner.token);
      return campaignId;
    }

    function requestPayout(campaignId: string, amount: number) {
      return request(app)
        .post(`/api/v1/campaigns/${campaignId}/payouts`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ amount });
    }

    function approve(payoutId: string, token: string) {
      return request(app)
        .post(`/api/v1/payouts/${payoutId}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
    }

    it('requires two distinct admins to approve a high-value payout (maker-checker)', async () => {
      const campaignId = await fundedCampaignWithRecipient(50000); // net 48250
      const reqRes = await requestPayout(campaignId, 48250); // ≥ 40k, ≤ 50k ceiling
      expect(reqRes.status).toBe(201);
      const payoutId = reqRes.body.data.id as string;

      // First approval records the maker, stays PENDING, reserves nothing.
      const first = await approve(payoutId, admin1.token);
      expect(first.status).toBe(200);
      expect(first.body.data.status).toBe('PENDING');
      expect(first.body.data.firstApprovedBy).toBe(admin1.userId);
      let balance = await CampaignBalanceModel.findOne({ campaignId });
      expect(balance?.availableBalance).toBe(48250); // not reserved yet

      // The same admin cannot be both maker and checker.
      const sameAdmin = await approve(payoutId, admin1.token);
      expect(sameAdmin.status).toBe(409);

      // A second, distinct admin initiates the transfer.
      const second = await approve(payoutId, admin2.token);
      expect(second.status).toBe(200);
      expect(second.body.data.status).toBe('PROCESSING');
      expect(second.body.data.approvedBy).toBe(admin2.userId);
      balance = await CampaignBalanceModel.findOne({ campaignId });
      expect(balance?.availableBalance).toBe(0); // now reserved
    });

    it('splits a payout above the ceiling into legs and settles PAID when all succeed', async () => {
      const campaignId = await fundedCampaignWithRecipient(120000); // net 115800
      const reqRes = await requestPayout(campaignId, 115800);
      expect(reqRes.status).toBe(201);
      const payoutId = reqRes.body.data.id as string;

      // Dual approval (≥ 40k); the checker triggers the batched transfer.
      await approve(payoutId, admin1.token).expect(200);
      const approved = await approve(payoutId, admin2.token);
      expect(approved.status).toBe(200);
      expect(approved.body.data.status).toBe('PROCESSING');
      expect(approved.body.data.legs).toHaveLength(3);

      const payout = await PayoutModel.findById(payoutId);
      const legs = payout!.legs!;
      expect(legs.map((l) => l.amount)).toEqual([50000, 50000, 15800]);

      // Each leg's transfer.success settles that leg; the last drives PAID.
      for (const leg of legs) {
        await sendTransferWebhook(app, 'transfer.success', leg.reference);
      }

      const settled = await PayoutModel.findById(payoutId);
      expect(settled?.status).toBe('PAID');

      const balance = await CampaignBalanceModel.findOne({ campaignId });
      expect(balance?.paidOutBalance).toBe(115800);
      expect(balance?.availableBalance).toBe(0);
      expect(balance?.payoutFees).toBe(0);

      // One disbursement journal per settled leg, summing to the net.
      const payoutCredits = await JournalLineModel.find({
        accountKind: 'payout',
        accountOwnerId: campaignId,
        direction: 'credit',
      });
      expect(payoutCredits).toHaveLength(3);
      expect(payoutCredits.reduce((s, l) => s + l.amount, 0)).toBe(115800);
    });

    it('flags a batched payout NEEDS_REVIEW when a leg fails after others sent', async () => {
      const campaignId = await fundedCampaignWithRecipient(120000);
      const reqRes = await requestPayout(campaignId, 115800);
      const payoutId = reqRes.body.data.id as string;

      await approve(payoutId, admin1.token).expect(200);
      await approve(payoutId, admin2.token).expect(200);

      const payout = await PayoutModel.findById(payoutId);
      const legs = payout!.legs!;

      // Two legs succeed, the third fails — money already left on the winners.
      await sendTransferWebhook(app, 'transfer.success', legs[0]!.reference);
      await sendTransferWebhook(app, 'transfer.success', legs[1]!.reference);
      await sendTransferWebhook(app, 'transfer.failed', legs[2]!.reference);

      const settled = await PayoutModel.findById(payoutId);
      expect(settled?.status).toBe('NEEDS_REVIEW');

      const balance = await CampaignBalanceModel.findOne({ campaignId });
      expect(balance?.paidOutBalance).toBe(100000); // legs 0 + 1 disbursed
      expect(balance?.availableBalance).toBe(15800); // leg 2 returned
    });
  });

  it('cannot request a payout larger than the eligible balance', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('over'));
    const campaignId = await createActiveCampaign(app, token, userId);

    await fundCampaign(app, campaignId, 1000); // eligible net 965
    await addRecipient(app, campaignId, token);

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/payouts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 2000 });
    expect(res.status).toBe(422);

    // No payout was created.
    const payouts = await PayoutModel.find({ campaignId });
    expect(payouts).toHaveLength(0);
  });

  it('cannot request a payout before registering a recipient', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('norcp'));
    const campaignId = await createActiveCampaign(app, token, userId);
    await fundCampaign(app, campaignId, 1000);

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/payouts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 500 });
    expect(res.status).toBe(400);
  });

  it('lists banks / telcos for payout setup (auth)', async () => {
    const { token } = await registerUser(app, uniqueEmail('banks'));
    // Bank directory returns a provider list; stub it for this call.
    const fetchMock = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes('/bank')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: true,
            data: [
              { name: 'MTN', code: 'MTN', currency: 'GHS', type: 'mobile_money', active: true },
            ],
          }),
        } as unknown as Response;
      }
      throw new Error(`unexpected fetch to ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .get('/api/v1/banks?currency=GHS&type=mobile_money')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].code).toBe('MTN');
  });
});
