import { randomUUID } from 'node:crypto';
import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';

/**
 * Rate limits and audit IPs must follow the real client, not the proxy the
 * request arrived through. In production every request reaches Express from
 * Render's internal proxy, so keying on req.ip made each limiter one bucket
 * shared by the whole platform (31 bad logins locked everyone out). The
 * Cloudflare edge overwrites CF-Connecting-IP, so that is the client address;
 * X-Forwarded-For stays attacker-controlled and must never move the key.
 */
describe('client IP resolution for rate limits and audit', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  const remaining = (res: request.Response) => Number(res.headers['x-ratelimit-remaining']);

  it('gives two Cloudflare client addresses separate general buckets', async () => {
    const first = await request(app).get('/api/v1/campaigns').set('CF-Connecting-IP', '198.51.100.1');
    const again = await request(app).get('/api/v1/campaigns').set('CF-Connecting-IP', '198.51.100.1');
    const other = await request(app).get('/api/v1/campaigns').set('CF-Connecting-IP', '198.51.100.2');

    expect(first.headers['x-ratelimit-limit']).toBe('300');
    expect(remaining(first)).toBe(299);
    expect(remaining(again)).toBe(298);
    expect(remaining(other)).toBe(299);
  });

  it('does not let forged forwarding headers pick a fresh bucket', async () => {
    const forgedHeaders = ['X-Forwarded-For', 'X-Vercel-Forwarded-For', 'X-Real-IP', 'True-Client-IP'];
    const results: number[] = [];
    for (const [index, header] of forgedHeaders.entries()) {
      const res = await request(app).get('/api/v1/campaigns').set(header, `203.0.113.${index + 1}`);
      results.push(remaining(res));
    }
    // Every forged request landed in the same (socket-peer) bucket.
    expect(results).toEqual([299, 298, 297, 296]);
  });

  it('shares one bucket across an IPv6 client’s /64', async () => {
    const a = await request(app).get('/api/v1/campaigns').set('CF-Connecting-IP', '2001:db8:1:2::a');
    const b = await request(app).get('/api/v1/campaigns').set('CF-Connecting-IP', '2001:db8:1:2:ffff::b');
    const c = await request(app).get('/api/v1/campaigns').set('CF-Connecting-IP', '2001:db8:1:3::a');
    expect(remaining(a)).toBe(299);
    expect(remaining(b)).toBe(298);
    expect(remaining(c)).toBe(299);
  });

  it('locks out only the client that exhausted the credential limit', async () => {
    const attacker = '198.51.100.66';
    let last: request.Response | undefined;
    for (let attempt = 0; attempt < 31; attempt += 1) {
      last = await request(app)
        .post('/api/v1/auth/login')
        .set('CF-Connecting-IP', attacker)
        .send({ email: 'not-an-email', password: 'x' });
    }
    expect(last?.status).toBe(429);

    // A spoofed forwarding header does not get the attacker out of the lockout…
    const spoofed = await request(app)
      .post('/api/v1/auth/login')
      .set('CF-Connecting-IP', attacker)
      .set('X-Forwarded-For', '198.51.100.77')
      .send({ email: 'not-an-email', password: 'x' });
    expect(spoofed.status).toBe(429);

    // …and everyone else can still sign in.
    const bystander = await request(app)
      .post('/api/v1/auth/login')
      .set('CF-Connecting-IP', '198.51.100.67')
      .send({ email: 'not-an-email', password: 'x' });
    expect(bystander.status).toBe(400);
    expect(bystander.headers['x-ratelimit-remaining']).toBe('29');
  });

  it('meters live polling and SSE reads separately from the general budget', async () => {
    const ip = '198.51.100.90';
    const live = await request(app).get('/api/v1/live-sessions/video/config').set('CF-Connecting-IP', ip);
    expect(live.headers['x-ratelimit-limit']).toBe('1800');
    expect(remaining(live)).toBe(1799);

    // The live read did not spend the general bucket.
    const general = await request(app).get('/api/v1/campaigns').set('CF-Connecting-IP', ip);
    expect(general.headers['x-ratelimit-limit']).toBe('300');
    expect(remaining(general)).toBe(299);

    // Writes on the live resource stay on the general limiter.
    const write = await request(app).post('/api/v1/live-sessions/abc/video/viewer-token').set('CF-Connecting-IP', ip);
    expect(write.headers['x-ratelimit-limit']).toBe('300');
    expect(remaining(write)).toBe(298);
  });

  it('records the resolved client address in the audit log', async () => {
    const registered = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `client-ip-${randomUUID()}@example.com`,
        password: 'SecurePass123',
        name: 'Audit Address',
        legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true },
      })
      .expect(201);
    const userId = registered.body.data.user.id as string;

    await request(app)
      .put('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${registered.body.data.tokens.accessToken}`)
      .set('CF-Connecting-IP', '198.51.100.23')
      .set('X-Forwarded-For', '203.0.113.9')
      .expect(200);

    await vi.waitFor(async () => {
      const row = await AuditLogModel.findOne({ actorId: userId, action: 'notifications.update' }).lean();
      expect(row?.ip).toBe('198.51.100.23');
    });
  });
});
