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

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`;
}

describe('Commercial config store (ADR-5 / G6)', () => {
  let app: Express;

  beforeAll(async () => {
    await connectTestDatabase();
    app = await createTestApp();
  });
  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  async function adminToken(): Promise<string> {
    const reg = await request(app).post('/api/v1/auth/register').send({ email: uniqueEmail('cfgadmin'), password: 'SecurePass123', name: 'Cfg Admin' }).expect(201);
    await UserModel.findByIdAndUpdate(reg.body.data.user.id, { role: 'admin' });
    const login = await request(app).post('/api/v1/auth/login').send({ email: reg.body.data.user.email, password: 'SecurePass123' }).expect(200);
    return login.body.data.tokens.accessToken as string;
  }

  it('resolves env defaults, applies an admin override, and records history', async () => {
    const token = await adminToken();

    const before = await request(app)
      .get('/api/v1/admin/commercial-config')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const defaultPriority = before.body.data.defaults.priorityFeePercent as number;
    expect(before.body.data.resolved.priorityFeePercent).toBe(defaultPriority);

    // Set an override, effective now.
    await request(app)
      .put('/api/v1/admin/commercial-config/priorityFeePercent')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: defaultPriority + 1.5, reason: 'test bump' })
      .expect(200);

    const after = await request(app)
      .get('/api/v1/admin/commercial-config')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(after.body.data.resolved.priorityFeePercent).toBe(defaultPriority + 1.5);
    // Defaults are untouched (the store overlays them).
    expect(after.body.data.defaults.priorityFeePercent).toBe(defaultPriority);

    const history = await request(app)
      .get('/api/v1/admin/commercial-config/priorityFeePercent/history')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(history.body.data.length).toBeGreaterThanOrEqual(1);
    expect(history.body.data[0].reason).toBe('test bump');
  });

  it('does not apply a future-dated override until its effective date', async () => {
    const token = await adminToken();
    const key = 'urgentFeePercent';
    const base = (await request(app).get('/api/v1/admin/commercial-config').set('Authorization', `Bearer ${token}`).expect(200)).body.data.resolved[key] as number;

    const future = new Date(Date.now() + 7 * 864e5).toISOString();
    await request(app)
      .put(`/api/v1/admin/commercial-config/${key}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ value: base + 5, effectiveFrom: future, reason: 'scheduled' })
      .expect(200);

    const now = await request(app).get('/api/v1/admin/commercial-config').set('Authorization', `Bearer ${token}`).expect(200);
    expect(now.body.data.resolved[key]).toBe(base); // future value not yet effective
  });

  it('rejects an unknown key (400) and a non-admin (403)', async () => {
    const token = await adminToken();
    await request(app)
      .put('/api/v1/admin/commercial-config/notARealKey')
      .set('Authorization', `Bearer ${token}`)
      .send({ value: 1 })
      .expect(400);

    const userReg = await request(app).post('/api/v1/auth/register').send({ email: uniqueEmail('cfguser'), password: 'SecurePass123', name: 'Plain User' }).expect(201);
    await request(app)
      .get('/api/v1/admin/commercial-config')
      .set('Authorization', `Bearer ${userReg.body.data.tokens.accessToken}`)
      .expect(403);
  });
});
