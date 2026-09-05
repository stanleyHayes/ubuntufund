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
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import {
  eventBus,
  campaignChannel,
  liveChannel,
} from '../../src/infrastructure/realtime/EventBus.js';
import {
  CampaignCategory,
  CampaignPriority,
  PaymentMethod,
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

/**
 * Seeds an active subscription for a user (upsert — safe to call repeatedly).
 * LIVE streaming is a plan feature, so a session owner needs a plan that
 * includes it (Pro or Enterprise).
 */
async function seedSubscription(userId: string, tier: SubscriptionTier): Promise<void> {
  const now = new Date();
  await SubscriptionModel.findOneAndUpdate(
    { userId },
    {
      userId,
      tier,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    },
    { upsert: true, new: true }
  );
}

async function createActiveCampaign(
  app: Express,
  token: string,
  userId: string,
  overrides: Partial<Record<string, unknown>> = {}
): Promise<string> {
  await UserModel.findByIdAndUpdate(userId, { verificationLevel: 2 });
  // Owners in these tests go LIVE, so give them a Pro plan (liveStreaming).
  await seedSubscription(userId, SubscriptionTier.PRO);
  const res = await request(app)
    .post('/api/v1/campaigns')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Live Session Campaign',
      description: 'A campaign that goes live for real-time fundraising.',
      goalAmount: 400,
      currency: 'GHS',
      category: CampaignCategory.COMMUNITY,
      priority: CampaignPriority.NORMAL,
      beneficiaries: [],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      ...overrides,
    })
    .expect(201);
  const campaignId = res.body.data.id as string;
  await CampaignModel.findByIdAndUpdate(campaignId, { status: 'active' });
  return campaignId;
}

async function fundedDonor(app: Express, balance: number) {
  const { userId, token } = await registerUser(app, uniqueEmail('donor'));
  const walletRes = await request(app)
    .get('/api/v1/wallets')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  const walletId = walletRes.body.data[0].id as string;
  await WalletModel.findByIdAndUpdate(walletId, { $set: { balance } });
  return { userId, token };
}

describe('Live sessions + realtime projector', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  it('starts a session for the owner and returns an overlay token', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('host'));
    const campaignId = await createActiveCampaign(app, token, userId);

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/live-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Saturday Livestream', targetAmount: 300 });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.overlayToken).toEqual(expect.any(String));
    expect(res.body.data.stats).toMatchObject({
      scans: 0,
      successfulDonations: 0,
      amountRaised: 0,
    });
  });

  it('forbids a Free-plan owner from starting a session (plan gate)', async () => {
    // Build an active campaign for the owner WITHOUT a live-capable plan.
    const { userId, token } = await registerUser(app, uniqueEmail('freehost'));
    await UserModel.findByIdAndUpdate(userId, { verificationLevel: 2 });
    const created = await request(app)
      .post('/api/v1/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Free Plan Campaign',
        description: 'A campaign whose owner is on the Free plan.',
        goalAmount: 400,
        currency: 'GHS',
        category: CampaignCategory.COMMUNITY,
        priority: CampaignPriority.NORMAL,
        beneficiaries: [],
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .expect(201);
    const campaignId = created.body.data.id as string;
    await CampaignModel.findByIdAndUpdate(campaignId, { status: 'active' });

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/live-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Should Be Blocked' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/LIVE streaming/i);
  });

  it('forbids a non-owner from starting a session', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('owner'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const { token: otherToken } = await registerUser(app, uniqueEmail('intruder'));

    const res = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/live-sessions`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it('serves the public sheet without leaking the overlay token', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('pub'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const start = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/live-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    const sessionId = start.body.data.id as string;

    const res = await request(app).get(`/api/v1/live-sessions/${sessionId}/public`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(sessionId);
    expect(res.body.data.overlayToken).toBeUndefined();
    expect(res.body.data.amountRaised).toBe(0);
  });

  it('gates the overlay behind the token', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('overlay'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const start = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/live-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    const sessionId = start.body.data.id as string;
    const overlayToken = start.body.data.overlayToken as string;

    await request(app).get(`/api/v1/live-sessions/${sessionId}/overlay`).expect(403);
    await request(app)
      .get(`/api/v1/live-sessions/${sessionId}/overlay?token=wrong`)
      .expect(403);
    await request(app)
      .get(`/api/v1/live-sessions/000000000000000000000000/overlay?token=${overlayToken}`)
      .expect(404);

    const ok = await request(app).get(
      `/api/v1/live-sessions/${sessionId}/overlay?token=${overlayToken}`
    );
    expect(ok.status).toBe(200);
    expect(ok.body.data.sessionId).toBe(sessionId);
    expect(ok.body.data.config).toMatchObject({ showAmounts: true });
    expect(ok.body.data.recentDonors).toEqual([]);
  });

  it('projects a live donation onto session stats, the overlay, and the event bus', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('live'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const start = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/live-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    const sessionId = start.body.data.id as string;
    const overlayToken = start.body.data.overlayToken as string;

    const { token: donorToken } = await fundedDonor(app, 1000);

    const donate = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/donate`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        amount: 100,
        currency: 'GHS',
        paymentMethod: PaymentMethod.WALLET,
        message: 'Go go go!',
        isAnonymous: false,
        liveSessionId: sessionId,
      });
    expect(donate.status).toBe(200);

    // Session stats reflect the donation.
    const publicRes = await request(app).get(
      `/api/v1/live-sessions/${sessionId}/public`
    );
    expect(publicRes.body.data.amountRaised).toBe(100);
    expect(publicRes.body.data.successfulDonations).toBe(1);

    // Overlay shows the donor (names visible by default).
    const overlay = await request(app).get(
      `/api/v1/live-sessions/${sessionId}/overlay?token=${overlayToken}`
    );
    expect(overlay.body.data.totals.amountRaised).toBe(100);
    expect(overlay.body.data.recentDonors).toHaveLength(1);
    expect(overlay.body.data.recentDonors[0]).toMatchObject({
      name: 'Test User',
      amount: 100,
      message: 'Go go go!',
    });

    // Event bus received the projected events on both channels.
    const campaignTypes = eventBus
      .getBufferedEvents(campaignChannel(campaignId))
      .map((e) => e.type);
    expect(campaignTypes).toContain('donation');
    expect(campaignTypes).toContain('total');
    // 100/400 = 25% → a milestone fires.
    expect(campaignTypes).toContain('milestone');

    const liveDonation = eventBus
      .getBufferedEvents(liveChannel(sessionId))
      .find((e) => e.type === 'donation');
    expect(liveDonation?.data).toMatchObject({ name: 'Test User', amount: 100 });
  });

  it('honors privacy toggles on the overlay and public sheet', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('priv'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const start = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/live-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    const sessionId = start.body.data.id as string;
    const overlayToken = start.body.data.overlayToken as string;

    const { token: donorToken } = await fundedDonor(app, 1000);
    await request(app)
      .post(`/api/v1/campaigns/${campaignId}/donate`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        amount: 50,
        currency: 'GHS',
        paymentMethod: PaymentMethod.WALLET,
        message: 'secret',
        isAnonymous: false,
        liveSessionId: sessionId,
      })
      .expect(200);

    // Hide amounts + enable privacy mode (hides names + messages).
    const patched = await request(app)
      .patch(`/api/v1/live-sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ showAmounts: false, privacyMode: true });
    expect(patched.status).toBe(200);
    expect(patched.body.data.showAmounts).toBe(false);
    expect(patched.body.data.privacyMode).toBe(true);

    const overlay = await request(app).get(
      `/api/v1/live-sessions/${sessionId}/overlay?token=${overlayToken}`
    );
    expect(overlay.body.data.totals.amountRaised).toBeNull();
    expect(overlay.body.data.recentDonors[0]).toMatchObject({
      name: 'Anonymous',
      amount: null,
    });
    expect(overlay.body.data.recentDonors[0].message).toBeUndefined();

    const publicRes = await request(app).get(
      `/api/v1/live-sessions/${sessionId}/public`
    );
    expect(publicRes.body.data.amountRaised).toBeNull();
  });

  it('rotates the overlay token, revoking the old one', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('rotate'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const start = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/live-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    const sessionId = start.body.data.id as string;
    const oldToken = start.body.data.overlayToken as string;

    const rotate = await request(app)
      .post(`/api/v1/live-sessions/${sessionId}/overlay-token/rotate`)
      .set('Authorization', `Bearer ${token}`);
    expect(rotate.status).toBe(200);
    const newToken = rotate.body.data.overlayToken as string;
    expect(newToken).not.toBe(oldToken);

    await request(app)
      .get(`/api/v1/live-sessions/${sessionId}/overlay?token=${oldToken}`)
      .expect(403);
    await request(app)
      .get(`/api/v1/live-sessions/${sessionId}/overlay?token=${newToken}`)
      .expect(200);
  });

  it('ends a session', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('end'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const start = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/live-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    const sessionId = start.body.data.id as string;

    const res = await request(app)
      .patch(`/api/v1/live-sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ended' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ended');
    expect(res.body.data.endedAt).toEqual(expect.any(String));
  });
});
