import { randomBytes, randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import { beforeAll, beforeEach, afterAll, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { NewsletterSubscriptionModel } from '../../src/infrastructure/database/models/NewsletterSubscriptionModel.js';
import { NewsletterConsentTokenModel } from '../../src/infrastructure/database/models/NewsletterConsentTokenModel.js';
import { NewsletterConsentEventModel } from '../../src/infrastructure/database/models/NewsletterConsentEventModel.js';
import { AccountEmailJobModel } from '../../src/infrastructure/database/models/AccountEmailJobModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { AccountEmails } from '../../src/infrastructure/adapters/outbound/AccountEmails.js';
import { NewsletterConsentService } from '../../src/application/services/NewsletterConsentService.js';
import { SubscribeNewsletterUseCase } from '../../src/application/use-cases/SubscribeNewsletterUseCase.js';
import { ListNewsletterSubscribersUseCase } from '../../src/application/use-cases/ListNewsletterSubscribersUseCase.js';
import { MongoNewsletterSubscriptionRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoNewsletterSubscriptionRepository.js';
import { MongoUserRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoUserRepository.js';
import { NewsletterController } from '../../src/infrastructure/adapters/inbound/http/controllers/NewsletterController.js';
import { createNewsletterRoutes } from '../../src/infrastructure/adapters/inbound/http/routes/newsletterRoutes.js';
import { createAuthMiddleware } from '../../src/infrastructure/adapters/inbound/middleware/authMiddleware.js';
import { requireAdmin } from '../../src/infrastructure/adapters/inbound/middleware/requireRole.js';
import { errorHandler } from '../../src/infrastructure/adapters/inbound/middleware/errorHandler.js';
import { AuthTokenService } from '../../src/application/services/AuthTokenService.js';

let app: Express, baseApp: Express;
const sender = { configured: true, from: 'sender@example.test', replyTo: 'support@example.test', webUrl: 'https://app.example.test', send: vi.fn(async (_key: string, _payload: Record<string, unknown>) => {}) };
const emails = new AccountEmails(sender, randomBytes(32)), consent = new NewsletterConsentService(emails);
const repo = new MongoNewsletterSubscriptionRepository();
const fresh = () => `${randomUUID()}@example.test`;
beforeAll(async () => {
  await connectTestDatabase(); baseApp = await createTestApp();
  const users = new MongoUserRepository();
  const auth = createAuthMiddleware(new AuthTokenService(process.env.JWT_SECRET!, process.env.JWT_REFRESH_SECRET!), users);
  app = express(); app.use(express.json());
  app.use('/api/v1/newsletter', createNewsletterRoutes(new NewsletterController(new SubscribeNewsletterUseCase(consent), new ListNewsletterSubscribersUseCase(repo)), auth, requireAdmin, consent, users));
  app.use(baseApp); app.use(errorHandler);
  await NewsletterSubscriptionModel.init(); await NewsletterConsentTokenModel.init(); await AccountEmailJobModel.init();
});
beforeEach(async () => {
  sender.send.mockReset().mockResolvedValue();
  await NewsletterSubscriptionModel.deleteMany({}); await NewsletterConsentTokenModel.deleteMany({}); await NewsletterConsentEventModel.deleteMany({}); await AccountEmailJobModel.deleteMany({});
});
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
async function actor() {
  const email = fresh();
  const response = await request(app).post('/api/v1/auth/register').send({ email, name: 'Newsletter Test', password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201);
  return { email, id: response.body.data.user.id, auth: `Bearer ${response.body.data.tokens.accessToken}` };
}
async function subscribe(email: string) { return request(app).post('/api/v1/newsletter/subscribe').send({ email, consent: true }).expect(200); }
async function links(email: string) {
  await subscribe(email); await emails.deliverPending();
  const body = sender.send.mock.calls.at(-1)![1].text as string;
  return { confirm: /newsletter\/confirm#token=([a-f0-9]{64})/.exec(body)![1], unsubscribe: /newsletter\/unsubscribe#token=([a-f0-9]{64})/.exec(body)![1] };
}
it('requires explicit consent and reports unavailable confirmation without adding an address', async () => {
  await request(app).post('/api/v1/newsletter/subscribe').send({ email: fresh() }).expect(400);
  await request(app).post('/api/v1/newsletter/subscribe').send({ email: fresh(), consent: false }).expect(400);
  await request(app).post('/api/v1/newsletter/subscribe').send({ email: 'invalid', consent: true }).expect(400);
  await request(baseApp).post('/api/v1/newsletter/subscribe').send({ email: fresh(), consent: true }).expect(503);
  expect(await NewsletterSubscriptionModel.countDocuments()).toBe(0);
});
it('keeps requests pending, normalized and idempotent across concurrent requests', async () => {
  const email = fresh();
  await Promise.all([subscribe(email), subscribe(email.toUpperCase())]);
  expect(await NewsletterSubscriptionModel.countDocuments()).toBe(1);
  expect(await AccountEmailJobModel.countDocuments()).toBe(1);
  expect((await NewsletterSubscriptionModel.findOne())!.status).toBe('pending');
  expect(await repo.listAll()).toEqual([]);
  expect(await NewsletterConsentEventModel.countDocuments({ action: 'requested' })).toBe(1);
});
it('confirms before listing and supports public, idempotent unsubscribe and renewed consent', async () => {
  const email = fresh(), token = await links(email);
  await NewsletterSubscriptionModel.collection.insertOne({ email: fresh(), createdAt: new Date() }); // legacy address is not consent
  expect(await repo.listAll()).toEqual([]);
  await request(app).post('/api/v1/newsletter/confirm').send({ token: token.confirm }).expect(200);
  expect((await repo.listAll()).map(item => item.email)).toEqual([email]);
  await request(app).post('/api/v1/newsletter/confirm').send({ token: token.confirm }).expect(400);
  await request(app).post('/api/v1/newsletter/unsubscribe').send({ token: token.unsubscribe }).expect(200);
  await request(app).post('/api/v1/newsletter/unsubscribe').send({ token: token.unsubscribe }).expect(200);
  expect(await repo.listAll()).toEqual([]);
  const renewed = await links(email);
  await request(app).post('/api/v1/newsletter/confirm').send({ token: renewed.confirm }).expect(200);
  await request(app).post('/api/v1/newsletter/unsubscribe').send({ token: token.unsubscribe }).expect(200); // old opt-out remains usable
  expect(await repo.listAll()).toEqual([]);
  expect(await NewsletterConsentEventModel.countDocuments({ action: 'withdrawn' })).toBe(2);
});
it('withdraws from Settings, suppresses pending delivery and cannot modify a different email', async () => {
  const user = await actor();
  await request(app).put('/api/v1/newsletter/preference').set('Authorization', user.auth).send({ enabled: true }).expect(200);
  await request(app).put('/api/v1/newsletter/preference').set('Authorization', user.auth).send({ enabled: false, email: fresh() }).expect(400);
  await request(app).put('/api/v1/newsletter/preference').set('Authorization', user.auth).send({ enabled: false }).expect(200);
  await emails.deliverPending(); expect(sender.send).not.toHaveBeenCalled();
  const response = await request(app).get('/api/v1/newsletter/preference').set('Authorization', user.auth).expect(200);
  expect(response.body.data.status).toBe('off');
  expect((await AccountEmailJobModel.findOne())!.status).toBe('suppressed');
});
it('rejects expired confirmation and never treats legacy records as active preferences', async () => {
  const email = fresh(), token = await links(email);
  await NewsletterConsentTokenModel.updateMany({ purpose: 'confirm' }, { $set: { expiresAt: new Date(0) } });
  await request(app).post('/api/v1/newsletter/confirm').send({ token: token.confirm }).expect(400);
  expect(await repo.listAll()).toEqual([]);
  const legacy = fresh(); await NewsletterSubscriptionModel.collection.insertOne({ email: legacy, createdAt: new Date() });
  expect(await consent.preference(legacy)).toEqual({ status: 'off' });
});
it('rolls back consent and tokens when queue persistence fails', async () => {
  const failure = vi.spyOn(AccountEmailJobModel, 'create').mockImplementationOnce(() => { throw new Error('queue unavailable'); });
  await expect(consent.request(fresh(), 'public')).rejects.toThrow('queue unavailable');
  failure.mockRestore();
  expect(await NewsletterSubscriptionModel.countDocuments()).toBe(0);
  expect(await NewsletterConsentTokenModel.countDocuments()).toBe(0);
  expect(await NewsletterConsentEventModel.countDocuments()).toBe(0);
});
it('restricts the confirmed subscriber list to current admins', async () => {
  const user = await actor();
  await request(app).get('/api/v1/newsletter/subscribers').expect(401);
  await request(app).get('/api/v1/newsletter/subscribers').set('Authorization', user.auth).expect(403);
  await UserModel.updateOne({ _id: user.id }, { $set: { role: 'admin' } });
  const email = fresh(), token = await links(email);
  await consent.confirm(token.confirm);
  const result = await request(app).get('/api/v1/newsletter/subscribers').set('Authorization', user.auth).expect(200);
  expect(result.body.data[0].email).toBe(email); expect(result.body.data[0].confirmedAt).toBeTruthy();
  await UserModel.updateOne({ _id: user.id }, { $set: { role: 'user' } });
  await request(app).get('/api/v1/newsletter/subscribers').set('Authorization', user.auth).expect(403);
});

it('removes newsletter tokens, consent events and queued email during account erasure', async () => {
  const user = await actor();
  await request(app).put('/api/v1/newsletter/preference').set('Authorization', user.auth).send({ enabled: true }).expect(200);
  expect(await NewsletterConsentTokenModel.countDocuments()).toBe(2);
  await request(app).delete('/api/v1/profile').set('Authorization', user.auth).expect(200);
  expect(await NewsletterSubscriptionModel.countDocuments()).toBe(0);
  expect(await NewsletterConsentTokenModel.countDocuments()).toBe(0);
  expect(await NewsletterConsentEventModel.countDocuments()).toBe(0);
  expect(await AccountEmailJobModel.countDocuments()).toBe(0);
  await emails.deliverPending(); expect(sender.send).not.toHaveBeenCalled();
});
