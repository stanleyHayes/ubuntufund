import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { CommercialConfigModel } from '../../src/infrastructure/database/models/CommercialConfigModel.js';

const THRESHOLDS = ['campaigns.tierThreshold1', 'campaigns.tierThreshold2', 'campaigns.tierThreshold3', 'campaigns.tierThreshold4'];
let app: Express, auth: string;
const put = (body: object, token = auth) => request(app).put('/api/v1/admin/commercial-config').set('Authorization', token).send(body);
const settings = (tier: number, thresholds: number[], email: string) => ({
  changes: [{ key: 'campaigns.autoApproveMaxTier', value: tier }, ...THRESHOLDS.map((key, i) => ({ key, value: thresholds[i] })), { key: 'alerts.reviewEmail', value: email }],
  reason: 'Batch review settings test',
});

beforeAll(async () => {
  await connectTestDatabase(); app = await createTestApp();
  const res = await request(app).post('/api/v1/auth/register').send({ name: 'Config admin', email: `cfg-${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  await UserModel.findByIdAndUpdate(res.body.data.user.id, { role: 'admin' });
  auth = `Bearer ${res.body.data.tokens.accessToken}`;
});
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

describe('batch commercial config writes', () => {
  it('writes every setting with one shared effectiveFrom and resolves them together', async () => {
    const res = await put(settings(2, [1000, 5000, 20000, 100000], 'review@example.test')).expect(200);
    expect(res.body.data).toHaveLength(6);
    const rows = await CommercialConfigModel.find({ reason: 'Batch review settings test' }).lean();
    expect(rows).toHaveLength(6);
    expect(new Set(rows.map(row => new Date(row.effectiveFrom).getTime())).size).toBe(1);
    const resolved = (await request(app).get('/api/v1/admin/commercial-config').set('Authorization', auth).expect(200)).body.data.resolved;
    expect(resolved).toMatchObject({ 'campaigns.autoApproveMaxTier': 2, 'campaigns.tierThreshold2': 5000, 'alerts.reviewEmail': 'review@example.test' });
  });

  it('writes nothing when any entry is invalid', async () => {
    const before = await CommercialConfigModel.countDocuments();
    const bad = settings(3, [1000, 5000, 20000, 100000], 'not-an-email');
    await put(bad).expect(400);
    await put({ changes: [{ key: 'campaigns.autoApproveMaxTier', value: 3 }, { key: 'nope', value: 1 }] }).expect(400);
    await put({ changes: [{ key: 'campaigns.autoApproveMaxTier', value: 3 }, { key: 'campaigns.autoApproveMaxTier', value: 4 }] }).expect(400);
    await put({ changes: [] }).expect(400);
    expect(await CommercialConfigModel.countDocuments()).toBe(before);
  });

  it('rejects thresholds that would not be strictly ascending, including merged with current values', async () => {
    const before = await CommercialConfigModel.countDocuments();
    await put(settings(3, [1000, 900, 20000, 100000], 'review@example.test')).expect(400);
    // Current threshold 3 is 20000, so a new threshold 2 of 25000 breaks the order.
    await put({ changes: [{ key: 'campaigns.tierThreshold2', value: 25000 }] }).expect(400);
    expect(await CommercialConfigModel.countDocuments()).toBe(before);
  });

  it('rolls back earlier writes when a later write fails', async () => {
    const before = await CommercialConfigModel.countDocuments();
    const original = CommercialConfigModel.create.bind(CommercialConfigModel);
    let calls = 0;
    const spy = vi.spyOn(CommercialConfigModel, 'create').mockImplementation(((...args: Parameters<typeof original>) => {
      if (++calls === 3) throw new Error('Injected store failure');
      return original(...args);
    }) as typeof CommercialConfigModel.create);
    await put(settings(4, [2000, 6000, 30000, 150000], 'ops@example.test')).expect(500);
    spy.mockRestore();
    expect(await CommercialConfigModel.countDocuments()).toBe(before);
  });

  it('is admin-only', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ name: 'Member', email: `member-${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
    await put(settings(5, [1, 2, 3, 4], ''), `Bearer ${res.body.data.tokens.accessToken}`).expect(403);
  });
});
