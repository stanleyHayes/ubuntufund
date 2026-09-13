import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { MfaModel } from '../../src/infrastructure/database/models/MfaModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { totpAtCounter } from '../../src/application/services/Totp.js';
let app: Express;
const password = 'SecurePass123';
beforeAll(async () => { process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 42).toString('base64'); await connectTestDatabase(); app = await createTestApp(); });
afterAll(async () => { delete process.env.MFA_ENCRYPTION_KEY; await dropTestDatabase(); await disconnectTestDatabase(); });
async function account() {
  const email = `${randomUUID()}@example.test`;
  const r = await request(app).post('/api/v1/auth/register').send({ name: 'MFA user', email, password, legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { email, id: r.body.data.user.id, auth: `Bearer ${r.body.data.tokens.accessToken}`, refresh: r.body.data.tokens.refreshToken };
}
async function enrolled() {
  const user = await account();
  const setup = (await request(app).post('/api/v1/auth/mfa/setup').set('Authorization', user.auth).send({ password }).expect(200)).body.data;
  const code = totpAtCounter(setup.secret, Math.floor(Date.now() / 30_000));
  const enabled = (await request(app).post('/api/v1/auth/mfa/enable').set('Authorization', user.auth).send({ password, code, enrollmentId: setup.enrollmentId }).expect(200)).body.data;
  return { ...user, oldAuth: user.auth, setup, code, codes: enabled.recoveryCodes as string[], auth: `Bearer ${enabled.tokens.accessToken}` };
}
it('is opt-in after login, confirms enrollment, protects secrets and revokes pre-enrollment sessions', async () => {
  await request(app).post('/api/v1/auth/mfa/setup').send({ password }).expect(401);
  const user = await account();
  expect((await request(app).get('/api/v1/auth/mfa').set('Authorization', user.auth).expect(200)).body.data.enabled).toBe(false);
  const setup = await request(app).post('/api/v1/auth/mfa/setup').set('Authorization', user.auth).send({ password }).expect(200);
  expect(setup.headers['cache-control']).toBe('private, no-store');
  expect(setup.body.data.qrCode).toMatch(/^data:image\/png;base64,/);
  const uri = new URL(setup.body.data.uri);
  expect(uri.searchParams.get('issuer')).toBe('Ujimora');
  expect(uri.searchParams.get('digits')).toBe('6');
  expect(uri.searchParams.get('image')).toContain('/favicon-192.png');
  expect((await MfaModel.findOne({ userId: user.id }))?.secretCipher).not.toContain(setup.body.data.secret);
  await request(app).post('/api/v1/auth/login').send({ email: user.email, password }).expect(200);
  const code = totpAtCounter(setup.body.data.secret, Math.floor(Date.now() / 30_000));
  const enabled = await request(app).post('/api/v1/auth/mfa/enable').set('Authorization', user.auth).send({ password, code, enrollmentId: setup.body.data.enrollmentId }).expect(200);
  expect(enabled.body.data.recoveryCodes).toHaveLength(10);
  expect(new Set(enabled.body.data.recoveryCodes).size).toBe(10);
  const row = await MfaModel.findOne({ userId: user.id });
  expect(row?.expiresAt).toBeUndefined();
  expect(row?.recoveryHashes).not.toContain(enabled.body.data.recoveryCodes[0]);
  await request(app).get('/api/v1/auth/mfa').set('Authorization', user.auth).expect(401);
  await request(app).post('/api/v1/auth/refresh').send({ refreshToken: user.refresh }).expect(401);
  const login = await request(app).post('/api/v1/auth/login').send({ email: user.email, password }).expect(401);
  expect(login.body.data?.tokens).toBeUndefined();
  await request(app).post('/api/v1/auth/login').send({ email: user.email, password, mfaCode: code }).expect(401);
});
it('accepts each recovery code once across concurrent logins and replacement app instances', async () => {
  const user = await enrolled(), otherApp = await createTestApp();
  const results = await Promise.all([app, otherApp].map(server => request(server).post('/api/v1/auth/login').send({ email: user.email, password, mfaCode: user.codes[0] })));
  expect(results.map(row => row.status).sort()).toEqual([200, 401]);
  expect((await MfaModel.findOne({ userId: user.id }))?.recoveryHashes).toHaveLength(9);
  await request(otherApp).post('/api/v1/auth/login').send({ email: user.email, password, mfaCode: user.codes[0] }).expect(401);
});
it('regenerates recovery codes and disables only with password plus a factor; changes revoke old sessions', async () => {
  const user = await enrolled();
  await request(app).post('/api/v1/auth/mfa/disable').set('Authorization', user.auth).send({ password: 'wrong', code: user.codes[0] }).expect(400);
  const changed = await request(app).post('/api/v1/auth/mfa/recovery-codes').set('Authorization', user.auth).send({ password, code: user.codes[0] }).expect(200);
  await request(app).post('/api/v1/auth/login').send({ email: user.email, password, mfaCode: user.codes[1] }).expect(401);
  await request(app).get('/api/v1/auth/mfa').set('Authorization', user.auth).expect(401);
  const disabled = await request(app).post('/api/v1/auth/mfa/disable').set('Authorization', `Bearer ${changed.body.data.tokens.accessToken}`).send({ password, code: changed.body.data.recoveryCodes[0] }).expect(200);
  expect(disabled.body.data.recoveryCodes).toEqual([]);
  expect(await MfaModel.findOne({ userId: user.id })).toBeNull();
  await request(app).post('/api/v1/auth/login').send({ email: user.email, password }).expect(200);
  expect(await AuditLogModel.countDocuments({ actorId: user.id, resource: 'account-security' })).toBe(3);
});
it('rolls back factor consumption and credential rotation when the audit transaction fails', async () => {
  const user = await enrolled(), before = await UserModel.findById(user.id);
  const spy = vi.spyOn(AuditLogModel, 'create').mockRejectedValueOnce(new Error('audit unavailable'));
  try { await request(app).post('/api/v1/auth/mfa/disable').set('Authorization', user.auth).send({ password, code: user.codes[0] }).expect(500); } finally { spy.mockRestore(); }
  expect((await MfaModel.findOne({ userId: user.id }))?.recoveryHashes).toHaveLength(10);
  expect((await UserModel.findById(user.id))?.authVersion).toBe(before?.authVersion);
  await request(app).post('/api/v1/auth/mfa/disable').set('Authorization', user.auth).send({ password, code: user.codes[0] }).expect(200);
});
it('rejects expired, replaced and cross-account enrollment identifiers', async () => {
  const first = await account(), second = await account();
  const setup = (await request(app).post('/api/v1/auth/mfa/setup').set('Authorization', first.auth).send({ password }).expect(200)).body.data;
  await request(app).post('/api/v1/auth/mfa/setup').set('Authorization', second.auth).send({ password }).expect(200);
  const payload = { password, enrollmentId: setup.enrollmentId, code: totpAtCounter(setup.secret, Math.floor(Date.now() / 30_000)) };
  await request(app).post('/api/v1/auth/mfa/enable').set('Authorization', second.auth).send(payload).expect(409);
  await MfaModel.updateOne({ userId: first.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  await request(app).post('/api/v1/auth/mfa/enable').set('Authorization', first.auth).send(payload).expect(409);
});
it('retains code attempt limits across API instances and fails closed if encryption is missing', async () => {
  const user = await enrolled();
  await MfaModel.updateOne({ userId: user.id }, { $set: { attempts: 10, windowUntil: new Date(Date.now() + 600_000) } });
  const second = await createTestApp();
  await request(second).post('/api/v1/auth/login').send({ email: user.email, password, mfaCode: user.codes[0] }).expect(429);
  await MfaModel.updateOne({ userId: user.id }, { $set: { windowUntil: new Date(0) } });
  process.env.MFA_ENCRYPTION_KEY = '';
  try {
    const unavailable = await createTestApp();
    await request(unavailable).post('/api/v1/auth/login').send({ email: user.email, password }).expect(401);
    await request(unavailable).post('/api/v1/auth/login').send({ email: user.email, password, mfaCode: user.code }).expect(503);
    await request(unavailable).post('/api/v1/auth/login').send({ email: user.email, password, mfaCode: user.codes[0] }).expect(200);
  } finally { process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 42).toString('base64'); }
});

it('accepts a fresh TOTP exactly once under concurrent login requests', async () => {
  const user = await enrolled();
  const counter = Math.floor(Date.now() / 30_000);
  await MfaModel.updateOne({ userId: user.id }, { $set: { lastCounter: counter - 1 } });
  const mfaCode = totpAtCounter(user.setup.secret, counter);
  const results = await Promise.all([1, 2].map(() => request(app).post('/api/v1/auth/login').send({ email: user.email, password, mfaCode })));
  expect(results.map(row => row.status).sort()).toEqual([200, 401]);
  expect((await MfaModel.findOne({ userId: user.id }))?.lastCounter).toBe(counter);
});
