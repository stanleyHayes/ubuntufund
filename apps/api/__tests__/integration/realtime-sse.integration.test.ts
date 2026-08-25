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
import { CampaignCategory, CampaignPriority, PaymentMethod } from '@ubuntu-fund/types';

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
    .send({ email, password: 'SecurePass123', name: 'Stream Donor' })
    .expect(201);
  return {
    userId: res.body.data.user.id as string,
    token: res.body.data.tokens.accessToken as string,
  };
}

async function createActiveCampaign(app: Express, token: string, userId: string) {
  await UserModel.findByIdAndUpdate(userId, { verificationLevel: 2 });
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
    expect(data).toMatchObject({ name: 'Stream Donor', amount: 100 });
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
        currency: 'GHS',
        paymentMethod: PaymentMethod.WALLET,
        isAnonymous: false,
      })
      .expect(200);

    // A fresh connection resuming from id 0 replays the buffered donation.
    const conn = await openSse(port, `/api/v1/campaigns/${campaignId}/events`, {
      'Last-Event-ID': '0',
    });
    open.push(conn);
    const frame = await conn.waitFor((f) => f.event === 'donation');
    expect(JSON.parse(frame.data as string)).toMatchObject({ amount: 100 });
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
