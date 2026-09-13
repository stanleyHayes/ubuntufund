import { randomBytes, randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, afterAll, it, expect, vi } from 'vitest';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { AccountEmails } from '../../src/infrastructure/adapters/outbound/AccountEmails.js';
import { MongoUserRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoUserRepository.js';
import { AuthTokenService } from '../../src/application/services/AuthTokenService.js';
import { createAuthMiddleware } from '../../src/infrastructure/adapters/inbound/middleware/authMiddleware.js';
import { errorHandler } from '../../src/infrastructure/adapters/inbound/middleware/errorHandler.js';
import { createEmailVerificationRoutes } from '../../src/infrastructure/adapters/inbound/http/routes/emailVerificationRoutes.js';
import { AccountEmailJobModel } from '../../src/infrastructure/database/models/AccountEmailJobModel.js';
import { EmailVerificationTokenModel } from '../../src/infrastructure/database/models/EmailVerificationTokenModel.js';
import { ActivityAlertPreferenceModel } from '../../src/infrastructure/database/models/ActivityAlertPreferenceModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';

let app: Express, verificationApp: Express;
const sender = { configured: true, from: 'sender@example.test', replyTo: 'support@example.test', webUrl: 'https://app.example.test', send: vi.fn(async (_key: string, _payload: Record<string, unknown>) => {}) };
const repository = new MongoUserRepository(), emails = new AccountEmails(sender, randomBytes(32));
beforeAll(async () => {
  await connectTestDatabase(); app = await createTestApp();
  verificationApp = express(); verificationApp.use(express.json());
  const auth = createAuthMiddleware(new AuthTokenService(process.env.JWT_SECRET!, process.env.JWT_REFRESH_SECRET!), repository);
  verificationApp.use('/api/v1/email-verification', createEmailVerificationRoutes(auth, repository, emails));
  verificationApp.use(errorHandler);
  await AccountEmailJobModel.init(); await EmailVerificationTokenModel.init();
});
beforeEach(async () => { sender.send.mockReset().mockResolvedValue(); await AccountEmailJobModel.deleteMany({}); await EmailVerificationTokenModel.deleteMany({}); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function actor() {
  const result = await request(app).post('/api/v1/auth/register').send({ name: 'Verify Test', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { user: (await repository.findById(result.body.data.user.id))!, auth: `Bearer ${result.body.data.tokens.accessToken}` };
}
async function link(account: Awaited<ReturnType<typeof actor>>) {
  await request(verificationApp).post('/api/v1/email-verification').set('Authorization', account.auth).send({}).expect(200);
  await emails.deliverPending();
  const body = sender.send.mock.calls.at(-1)![1].text as string;
  return /verify-email#token=([a-f0-9]{64})/.exec(body)![1];
}

it('authenticates requests, refuses arbitrary recipient fields and reports unavailable delivery honestly', async () => {
  const account = await actor();
  await request(app).get('/api/v1/email-verification').expect(401);
  await request(verificationApp).post('/api/v1/email-verification').send({}).expect(401);
  await request(verificationApp).post('/api/v1/email-verification').set('Authorization', account.auth).send({ email: 'another@example.test' }).expect(400);
  await request(app).post('/api/v1/email-verification').set('Authorization', account.auth).send({}).expect(503);
  expect(await EmailVerificationTokenModel.countDocuments()).toBe(0);
});

it('confirms ownership without opting in and permits a later explicit activity-email choice', async () => {
  const account = await actor();
  const choice = { category: 'withdrawals', channel: 'email', enabled: true };
  await request(app).put('/api/v1/profile/activity-alerts').set('Authorization', account.auth).send(choice).expect(409);
  const token = await link(account);
  const outcomes = await Promise.all([request(verificationApp).post('/api/v1/email-verification/confirm').send({ token }), request(verificationApp).post('/api/v1/email-verification/confirm').send({ token })]);
  expect(outcomes.map(item => item.status).sort()).toEqual([200, 400]);
  expect(await ActivityAlertPreferenceModel.exists({ userId: account.user.id })).toBeNull();
  await repository.update(account.user); // stale false cannot undo confirmation
  expect((await UserModel.findById(account.user.id))!.emailVerified).toBe(true);
  await request(app).put('/api/v1/profile/activity-alerts').set('Authorization', account.auth).send(choice).expect(200);
  const settings = await request(app).get('/api/v1/profile/activity-alerts').set('Authorization', account.auth).expect(200);
  expect(settings.body.data.preferences.withdrawals).toEqual({ inApp: false, email: true });
});

it('does not accept a verification token for password recovery', async () => {
  const account = await actor(), token = await link(account);
  await request(app).post('/api/v1/auth/reset-password').send({ token, newPassword: 'WrongPurpose123' }).expect(400);
  expect((await UserModel.findById(account.user.id))!.emailVerified).toBe(false);
});

it.each(['email', 'credentials', 'closed', 'expired'])('rejects a link after %s changes', async reason => {
  const account = await actor(), token = await link(account);
  if (reason === 'email') await UserModel.updateOne({ _id: account.user.id }, { $set: { email: `${randomUUID()}@example.test` } });
  if (reason === 'credentials') await UserModel.updateOne({ _id: account.user.id }, { $set: { authVersion: randomUUID() } });
  if (reason === 'closed') await UserModel.updateOne({ _id: account.user.id }, { $set: { deletedAt: new Date() } });
  if (reason === 'expired') await EmailVerificationTokenModel.updateMany({ userId: account.user.id }, { $set: { expiresAt: new Date(0) } });
  await request(verificationApp).post('/api/v1/email-verification/confirm').send({ token }).expect(400);
  expect((await UserModel.findById(account.user.id))!.emailVerified).toBe(false);
});

it('does not restore an administrator role from a stale account snapshot', async () => {
  const account = await actor();
  await UserModel.updateOne({ _id: account.user.id }, { $set: { role: 'admin' } });
  const stale = (await repository.findById(account.user.id))!;
  await UserModel.updateOne({ _id: account.user.id }, { $set: { role: 'user' } });
  await repository.update(stale);
  expect((await UserModel.findById(account.user.id))!.role).toBe('user');
});
