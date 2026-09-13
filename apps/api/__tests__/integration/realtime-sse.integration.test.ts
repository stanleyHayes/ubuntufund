import { createReviewedDonation } from '../helpers/reviewedDonation.js';
import { ContentRestrictionModel } from '../../src/infrastructure/database/models/ContentRestrictionModel.js';
import { DonationModel } from '../../src/infrastructure/database/models/DonationModel.js';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
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

interface ParsedFrame {
  id?: number;
  event?: string;
  data?: string;
}

/** Parse one SSE frame; returns null for comment-only / non-event frames. */
function parseFrame(raw: string): ParsedFrame | null {
  const out: ParsedFrame = {};
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    const idx = line.indexOf(':');
    const field = idx === -1 ? line : line.slice(0, idx);
    let value = idx === -1 ? '' : line.slice(idx + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'id') out.id = Number(value);
    else if (field === 'event') out.event = value;
    else if (field === 'data') out.data = value;
  }
  return out.event === undefined ? null : out;
}

interface SseConnection {
  closed: Promise<void>;
  statusCode: number;
  contentType?: string;
  events: ParsedFrame[];
  waitFor: (pred: (f: ParsedFrame) => boolean, timeoutMs?: number) => Promise<ParsedFrame>;
  close: () => void;
}

function openSse(
  port: number,
  path: string,
  headers: Record<string, string> = {}
): Promise<SseConnection> {
  return new Promise((resolve, reject) => {
    const req = http.get({ port, path, headers, host: '127.0.0.1' }, (res) => {
      const events: ParsedFrame[] = [];
      const waiters: {
        pred: (f: ParsedFrame) => boolean;
        resolve: (f: ParsedFrame) => void;
      }[] = [];
      let buffer = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        buffer += chunk;
        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const frame = parseFrame(raw);
          if (!frame) continue;
          events.push(frame);
          for (const w of waiters.slice()) {
            if (w.pred(frame)) {
              w.resolve(frame);
              waiters.splice(waiters.indexOf(w), 1);
            }
          }
        }
      });

      resolve({
        closed: new Promise<void>(done => res.once('end', done)),
        statusCode: res.statusCode ?? 0,
        contentType: res.headers['content-type'],
        events,
        waitFor: (pred, timeoutMs = 5000) =>
          new Promise<ParsedFrame>((res2, rej2) => {
            const existing = events.find(pred);
            if (existing) {
              res2(existing);
              return;
            }
            const timer = setTimeout(
              () => rej2(new Error('timed out waiting for SSE frame')),
              timeoutMs
            );
            waiters.push({
              pred,
              resolve: (f) => {
                clearTimeout(timer);
                res2(f);
              },
            });
          }),
        close: () => req.destroy(),
      });
    });
    req.on('error', reject);
  });
}

async function registerUser(app: Express, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email, password: 'SecurePass123', name: 'Stream Donor' })
    .expect(201);
  return {
    userId: res.body.data.user.id as string,
    token: res.body.data.tokens.accessToken as string,
  };
}

async function createActiveCampaign(app: Express, token: string, userId: string) {
  await UserModel.findByIdAndUpdate(userId, { verificationLevel: 2 });
  // Session owners go LIVE, which is a plan feature — give them a Pro plan.
  const now = new Date();
  await SubscriptionModel.findOneAndUpdate(
    { userId },
    {
      userId,
      tier: SubscriptionTier.PRO,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    },
    { upsert: true, new: true }
  );
  const res = await request(app)
    .post('/api/v1/campaigns')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'SSE Campaign',
      description: 'A campaign streaming donations over server-sent events.',
      goalAmount: 400,
      currency: 'GHS',
      category: CampaignCategory.COMMUNITY,
      priority: CampaignPriority.NORMAL,
      beneficiaries: [],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .expect(201);
  const campaignId = res.body.data.id as string;
  await CampaignModel.findByIdAndUpdate(campaignId, { status: 'active' });
  return campaignId;
}

async function fundedDonor(app: Express, balance: number) {
  const { token } = await registerUser(app, uniqueEmail('donor'));
  const walletRes = await request(app)
    .get('/api/v1/wallets')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  const walletId = walletRes.body.data[0].id as string;
  await WalletModel.findByIdAndUpdate(walletId, { $set: { balance } });
  return token;
}

describe('Realtime SSE gateway', () => {
  let app: Express;
  let server: http.Server;
  let port: number;
  const open: SseConnection[] = [];

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    for (const conn of open) conn.close();
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  it('sets SSE headers and streams a live donation on the campaign channel', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('host'));
    const campaignId = await createActiveCampaign(app, token, userId);

    const conn = await openSse(port, `/api/v1/campaigns/${campaignId}/events`);
    open.push(conn);
    expect(conn.statusCode).toBe(200);
    expect(conn.contentType).toContain('text/event-stream');

    const donorToken = await fundedDonor(app, 1000);
    await request(app)
      .post(`/api/v1/campaigns/${campaignId}/donate`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        amount: 100,
        currency: 'GHS',
        paymentMethod: PaymentMethod.WALLET,
        isAnonymous: false,
      })
      .expect(200);

    const frame = await conn.waitFor((f) => f.event === 'donation');
    const data = JSON.parse(frame.data as string);
    expect(data).toMatchObject({ name: 'Anonymous', amount: 100 });
    expect(data.message).toBeUndefined();
    expect(frame.id).toEqual(expect.any(Number));
  });

  it('resumes buffered events via Last-Event-ID', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('resume'));
    const campaignId = await createActiveCampaign(app, token, userId);

    // Donate first so the event lands in the channel ring buffer.
    const donorToken = await fundedDonor(app, 1000);
    await request(app)
      .post(`/api/v1/campaigns/${campaignId}/donate`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        amount: 100,
        message: 'Message later hidden by moderation',
        legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
        currency: 'GHS',
        paymentMethod: PaymentMethod.WALLET,
        isAnonymous: false,
      })
      .expect(200);

    await DonationModel.updateMany({ campaignId }, { $set: { messageHiddenAt: new Date(), isAnonymous: true }, $unset: { message: 1 } });
    // A fresh connection resuming from id 0 replays the buffered donation.
    const conn = await openSse(port, `/api/v1/campaigns/${campaignId}/events`, {
      'Last-Event-ID': '0',
    });
    open.push(conn);
    const frame = await conn.waitFor((f) => f.event === 'donation');
    expect(JSON.parse(frame.data as string)).toMatchObject({ amount: 100, name: 'Anonymous' });
    expect(JSON.parse(frame.data as string).message).toBeUndefined();
  });

  it('gates the live-session SSE feed behind the overlay token', async () => {
    const { userId, token } = await registerUser(app, uniqueEmail('overlay'));
    const campaignId = await createActiveCampaign(app, token, userId);
    const start = await request(app)
      .post(`/api/v1/campaigns/${campaignId}/live-sessions`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    const sessionId = start.body.data.id as string;
    const overlayToken = start.body.data.overlayToken as string;

    // No token → 403 (JSON error, not a stream).
    const denied = await openSse(port, `/api/v1/live-sessions/${sessionId}/events`);
    open.push(denied);
    expect(denied.statusCode).toBe(403);

    // Valid token → stream, and a live donation arrives.
    const conn = await openSse(
      port,
      `/api/v1/live-sessions/${sessionId}/events?token=${overlayToken}`
    );
    open.push(conn);
    expect(conn.statusCode).toBe(200);

    const donorToken = await fundedDonor(app, 1000);
    await request(app)
      .post(`/api/v1/campaigns/${campaignId}/donate`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        amount: 100,
        currency: 'GHS',
        paymentMethod: PaymentMethod.WALLET,
        isAnonymous: false,
        liveSessionId: sessionId,
      })
      .expect(200);

    const frame = await conn.waitFor((f) => f.event === 'donation');
    expect(JSON.parse(frame.data as string)).toMatchObject({ amount: 100 });
    await request(app).patch(`/api/v1/live-sessions/${sessionId}`).set('Authorization', `Bearer ${token}`).send({ privacyMode: true, showAmounts: false }).expect(200);
    const replay = await openSse(port, `/api/v1/live-sessions/${sessionId}/events?token=${overlayToken}`);
    open.push(replay);
    const privateFrame = await replay.waitFor(f => f.event === 'donation');
    expect(JSON.parse(privateFrame.data as string)).toMatchObject({ name: 'Anonymous', amount: null });
    expect(JSON.parse(privateFrame.data as string).message).toBeUndefined();
  });

  it('closes an existing stream before delivering newly blocked campaign data and refuses buffered replay', async () => {
    const owner = await registerUser(app, uniqueEmail('blocked-stream'));
    const campaignId = await createActiveCampaign(app, owner.token, owner.userId);
    const conn = await openSse(port, `/api/v1/campaigns/${campaignId}/events`);
    open.push(conn);
    expect(conn.statusCode).toBe(200);
    await CampaignModel.findByIdAndUpdate(campaignId, { status: 'blocked' });
    const { eventBus, campaignChannel } = await import('../../src/infrastructure/realtime/EventBus.js');
    eventBus.publish(campaignChannel(campaignId), 'total', { campaignId, raisedAmount: 777 });
    await conn.closed;
    expect(conn.events).toEqual([]);
    await request(app).get(`/api/v1/campaigns/${campaignId}/events`).set('Last-Event-ID', '0').expect(404);
  });

  it('rebuilds replay from current donation identity and rejects cross-campaign or fabricated fields', async () => {
    const owner = await registerUser(app, uniqueEmail('replay-identity'));
    const donor = await registerUser(app, uniqueEmail('replay-donor'));
    const viewer = await registerUser(app, uniqueEmail('replay-viewer'));
    const campaignId = await createActiveCampaign(app, owner.token, owner.userId);
    const donation = await createReviewedDonation({ donorName: 'Reviewed donor name', campaignId, donorId: donor.userId, amount: 42, currency: 'GHS', isAnonymous: false, message: 'Current donor message' });
    const { eventBus, campaignChannel } = await import('../../src/infrastructure/realtime/EventBus.js');
    const channel = campaignChannel(campaignId);
    eventBus.publish(channel, 'donation', { donationId: donation.id, name: 'Stale donor name', donorId: donor.userId, email: 'private@example.com', amount: 999999, message: 'Stale message' });
    await UserModel.updateOne({ _id: donor.userId }, { $set: { name: 'Current donor name' } });
    const conn = await openSse(port, `/api/v1/campaigns/${campaignId}/events`); open.push(conn);
    const frame = await conn.waitFor(f => f.event === 'donation');
    expect(JSON.parse(frame.data!)).toEqual({ donationId: donation.id, name: 'Reviewed donor name', amount: 42, message: 'Current donor message', createdAt: donation.createdAt.toISOString() });
    await request(app).put(`/api/v1/safety/blocks/${donor.userId}`).set('Authorization', `Bearer ${viewer.token}`).expect(200);
    const blocked = await openSse(port, `/api/v1/campaigns/${campaignId}/events`, { Authorization: `Bearer ${viewer.token}` }); open.push(blocked);
    expect(JSON.parse((await blocked.waitFor(f => f.event === 'donation')).data!)).toMatchObject({ name: 'Anonymous', amount: 42 });
    expect(JSON.parse(blocked.events.find(f => f.event === 'donation')!.data!)).not.toHaveProperty('message');
    await ContentRestrictionModel.create({ userId: donor.userId, restrictedBy: owner.userId, reason: 'Replay identity restriction' });
    const restricted = await openSse(port, `/api/v1/campaigns/${campaignId}/events`); open.push(restricted);
    expect(JSON.parse((await restricted.waitFor(f => f.event === 'donation')).data!)).toMatchObject({ name: 'Anonymous', amount: 42 });
    const otherDonation = await DonationModel.create({ campaignId: 'aaaaaaaaaaaaaaaaaaaaaaaa', donorId: donor.userId, amount: 777, currency: 'GHS' });
    eventBus.publish(channel, 'donation', { donationId: otherDonation.id, name: 'Wrong campaign', amount: 777 });
    eventBus.publish(channel, 'donation', { donationId: 'not-a-donation', name: 'Fabricated donor', amount: 777 });
    eventBus.publish(channel, 'total', { marker: 'after-invalid-events' });
    await restricted.waitFor(f => f.event === 'total' && f.data!.includes('after-invalid-events'));
    expect(restricted.events.filter(f => f.event === 'donation')).toHaveLength(1);
  });

  it('applies donor restriction to overlay snapshots while preserving donation and session totals', async () => {
    const owner = await registerUser(app, uniqueEmail('overlay-identity'));
    const donor = await registerUser(app, uniqueEmail('overlay-private-donor'));
    const campaignId = await createActiveCampaign(app, owner.token, owner.userId);
    const start = await request(app).post(`/api/v1/campaigns/${campaignId}/live-sessions`).set('Authorization', `Bearer ${owner.token}`).send({}).expect(201);
    const donation = await createReviewedDonation({ donorName: 'Reviewed supporter', campaignId, donorId: donor.userId, amount: 35, currency: 'GHS', message: 'Do not publish restricted message', isAnonymous: false });
    const path = `/api/v1/live-sessions/${start.body.data.id}/overlay?token=${start.body.data.overlayToken}`;
    const before = await request(app).get(path).expect(200);
    expect(before.body.data.recentDonors[0]).toMatchObject({ name: 'Reviewed supporter', message: 'Do not publish restricted message' });
    await ContentRestrictionModel.create({ userId: donor.userId, restrictedBy: owner.userId, reason: 'Overlay identity restriction' });
    const after = await request(app).get(path).expect(200);
    expect(after.body.data.recentDonors[0]).toMatchObject({ donationId: donation.id, name: 'Anonymous', amount: before.body.data.recentDonors[0].amount });
    expect(after.body.data.recentDonors[0]).not.toHaveProperty('message');
    expect(after.body.data.totals).toEqual(before.body.data.totals);
    expect(await DonationModel.exists({ _id: donation.id })).toBeTruthy();
  });

  it('withholds a buffered reviewed message after its approved snapshot changes', async () => {
    const owner = await registerUser(app, uniqueEmail('changed-review'));
    const campaignId = await createActiveCampaign(app, owner.token, owner.userId);
    const donation = await createReviewedDonation({ donorName: 'Reviewed guest', campaignId, donorId: 'guest', amount: 42, currency: 'GHS', isAnonymous: false, message: 'Reviewed message' });
    const { eventBus, campaignChannel } = await import('../../src/infrastructure/realtime/EventBus.js');
    eventBus.publish(campaignChannel(campaignId), 'donation', { donationId: donation.id, name: 'Reviewed guest', amount: 42, message: 'Reviewed message' });
    await DonationModel.updateOne({ _id: donation.id }, { $set: { message: 'Unreviewed replacement' } });
    const conn = await openSse(port, `/api/v1/campaigns/${campaignId}/events`); open.push(conn);
    const frame = JSON.parse((await conn.waitFor(event => event.event === 'donation')).data!);
    expect(frame).toMatchObject({ donationId: donation.id, name: 'Anonymous', amount: 42 });
    expect(frame.message).toBeUndefined();
    expect((await DonationModel.findById(donation.id))?.message).toBe('Unreviewed replacement');
  });

  it('404s the SSE feed for an unknown campaign', async () => {
    const conn = await openSse(
      port,
      '/api/v1/campaigns/000000000000000000000000/events'
    );
    open.push(conn);
    expect(conn.statusCode).toBe(404);
  });
});
