import { randomUUID } from 'node:crypto';
import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types';
import { LegalAcceptanceEventModel } from '../../src/infrastructure/database/models/LegalAcceptanceEventModel.js';
const acceptance = { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true };
const account = () => ({ email: `legal-${randomUUID()}@example.com`, password: 'SecurePass123', name: 'Legal Test' });
describe('Versioned account agreement', () => {
  let app: Express;
  beforeAll(async () => { await connectTestDatabase(); app = await createTestApp(); });
  afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
  it.each([undefined, { ...acceptance, acceptedTerms: false }, { ...acceptance, ageConfirmed: false }, { ...acceptance, version: 'old' }])('rejects missing, unchecked or obsolete acceptance: %j', async legalAcceptance => {
    await request(app).post('/api/v1/auth/register').send({ ...account(), legalAcceptance }).expect(400);
  });
  it('keeps every accepted version as history instead of overwriting the signup record', async () => {
    // Consent evidence keeps the real client address (CF-Connecting-IP), not Render's proxy.
    const result = await request(app).post('/api/v1/auth/register').set('User-Agent', 'legal-history-test').set('CF-Connecting-IP', '198.51.100.31').send({ ...account(), legalAcceptance: acceptance }).expect(201);
    const { user, tokens } = result.body.data;
    const bearer = `Bearer ${tokens.accessToken}`;
    const signup = await LegalAcceptanceEventModel.find({ userId: user.id }).lean();
    expect(signup).toHaveLength(1);
    expect(signup[0]).toMatchObject({ ...acceptance, source: 'register', userAgent: 'legal-history-test', ip: '198.51.100.31' });
    expect(signup[0].acceptedAt.toISOString()).toBe(user.legalAcceptance.acceptedAt);
    // Simulate a user whose stored acceptance is an older version (v1 → current).
    await UserModel.updateOne({ _id: user.id }, { $set: { 'legalAcceptance.version': '2020-01-01' } });
    const first = await request(app).post('/api/v1/profile/legal-acceptance').set('Authorization', bearer).set('CF-Connecting-IP', '198.51.100.32').send(acceptance).expect(200);
    await request(app).post('/api/v1/profile/legal-acceptance').set('Authorization', bearer).send(acceptance).expect(200);
    let history = await LegalAcceptanceEventModel.find({ userId: user.id }).sort({ acceptedAt: 1 }).lean();
    expect(history.map(event => event.source)).toEqual(['register', 'reaccept']);
    expect(history[1].ip).toBe('198.51.100.32');
    // Racing re-acceptances of a newer version record exactly one event.
    await UserModel.updateOne({ _id: user.id }, { $set: { 'legalAcceptance.version': '2021-01-01' } });
    await Promise.all([1, 2, 3].map(() => request(app).post('/api/v1/profile/legal-acceptance').set('Authorization', bearer).send(acceptance).expect(200)));
    expect(await LegalAcceptanceEventModel.countDocuments({ userId: user.id })).toBe(3);
    history = await LegalAcceptanceEventModel.find({ userId: user.id }).sort({ acceptedAt: 1 }).limit(2).lean();
    expect(history[1]).toMatchObject({ ...acceptance });
    expect(history[1].acceptedAt.toISOString()).toBe(first.body.data.acceptedAt);
    expect((await UserModel.findById(user.id))?.legalAcceptance).toMatchObject(acceptance);
  });
  it('reports the server-side agreement status so clients with an older bundle still see the notice', async () => {
    const result = await request(app).post('/api/v1/auth/register').send({ ...account(), legalAcceptance: acceptance }).expect(201);
    const bearer = `Bearer ${result.body.data.tokens.accessToken}`;
    await request(app).get('/api/v1/profile/legal-acceptance').expect(401);
    const current = await request(app).get('/api/v1/profile/legal-acceptance').set('Authorization', bearer).expect(200);
    expect(current.headers['cache-control']).toContain('no-store');
    expect(current.body.data).toMatchObject({ current: true, requiredVersion: LEGAL_ACCEPTANCE_VERSION, record: acceptance });
    // As if the API shipped a newer version than the one this user accepted.
    await UserModel.updateOne({ _id: result.body.data.user.id }, { $set: { 'legalAcceptance.version': '2020-01-01' } });
    const stale = await request(app).get('/api/v1/profile/legal-acceptance').set('Authorization', bearer).expect(200);
    expect(stale.body.data).toMatchObject({ current: false, requiredVersion: LEGAL_ACCEPTANCE_VERSION, record: { version: '2020-01-01' } });
  });
  it('does not create an account without its consent record', async () => {
    const data = account();
    const failure = vi.spyOn(LegalAcceptanceEventModel, 'create').mockRejectedValueOnce(new Error('History unavailable'));
    try { await request(app).post('/api/v1/auth/register').send({ ...data, legalAcceptance: acceptance }).expect(500); }
    finally { failure.mockRestore(); }
    expect(await UserModel.exists({ email: data.email })).toBeNull();
    await request(app).post('/api/v1/auth/register').send({ ...data, legalAcceptance: acceptance }).expect(201);
  });
  it('records server time and requires legacy users to acknowledge before posting while allowing privacy controls', async () => {
    const data = account();
    const result = await request(app).post('/api/v1/auth/register').send({ ...data, legalAcceptance: { ...acceptance, acceptedAt: '2000-01-01' } }).expect(201);
    const { user, tokens } = result.body.data;
    expect(user.legalAcceptance.acceptedAt).not.toContain('2000-01-01');
    expect(user.legalAcceptance).toMatchObject(acceptance);
    await UserModel.updateOne({ _id: user.id }, { $unset: { legalAcceptance: 1 } });
    const bearer = `Bearer ${tokens.accessToken}`;
    await request(app).get('/api/v1/profile').set('Authorization', bearer).expect(200);
    await request(app).put('/api/v1/profile').set('Authorization', bearer).send({ notificationPreferences: { marketingEmails: false } }).expect(200);
    await request(app).post('/api/v1/campaigns').set('Authorization', bearer).send({}).expect(428);
    await request(app).post('/api/v1/campaigns/example/comments').set('Authorization', bearer).send({ content: 'Hello' }).expect(428);
    await request(app).post('/api/v1/profile/legal-acceptance').set('Authorization', bearer).send({ ...acceptance, ageConfirmed: false }).expect(400);
    const saved = await request(app).post('/api/v1/profile/legal-acceptance').set('Authorization', bearer).send(acceptance).expect(200);
    const retried = await request(app).post('/api/v1/profile/legal-acceptance').set('Authorization', bearer).send(acceptance).expect(200);
    expect(retried.body.data.acceptedAt).toBe(saved.body.data.acceptedAt);
    const login = await request(app).post('/api/v1/auth/login').send({ email: data.email, password: data.password }).expect(200);
    expect(login.body.data.user.legalAcceptance).toMatchObject(acceptance);
    // Validation is reached after acknowledgement rather than the policy gate.
    await request(app).post('/api/v1/campaigns').set('Authorization', bearer).send({}).expect(400);
  });
});
