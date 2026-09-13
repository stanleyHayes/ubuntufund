import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, afterEach, it, expect, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { BillingCycle, LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types';
import { createTestApp } from '../helpers/testApp.js';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import * as configuration from '../../src/infrastructure/config/storeBilling.js';
import { MongoStoreBilling } from '../../src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.js';
import { StoreReceiptCipher } from '../../src/infrastructure/adapters/outbound/payments/StoreReceiptCipher.js';
import { StoreBillingAccountModel } from '../../src/infrastructure/database/models/StoreBillingAccountModel.js';
import { StorePurchaseModel } from '../../src/infrastructure/database/models/StorePurchaseModel.js';
import { StoreBillingNotificationModel } from '../../src/infrastructure/database/models/StoreBillingNotificationModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js';
import { AppError } from '../../src/infrastructure/adapters/inbound/middleware/errorHandler.js';
import type { StorePurchaseVerifierPort, VerifiedStorePurchase } from '../../src/domain/ports/outbound/StorePurchaseVerifierPort.js';

const purchases = new Map<string, VerifiedStorePurchase>();
const verifier = {
  verify: vi.fn<StorePurchaseVerifierPort['verify']>(async (_store, reference) => {
    const result = purchases.get(reference);
    if (!result) throw new AppError('Unknown test purchase.', 422);
    return { ...result };
  }),
  acknowledge: vi.fn(async () => {}),
  appleNotification: vi.fn(async () => { throw new AppError('Invalid test signature.', 401); }),
  googleNotification: vi.fn(async (authorization: string, body: unknown) => {
    if (authorization !== 'Bearer verified-test-oidc') throw new AppError('Invalid test notification.', 401);
    return (body as { reference: string }).reference;
  }),
};
const billing = new MongoStoreBilling(verifier, new StoreReceiptCipher(Buffer.alloc(32, 1)));
const runtime = { products: [{ store: 'google' as const, productId: 'pro', basePlanId: 'monthly', tier: 'pro', billingCycle: BillingCycle.MONTHLY }],
  verifier, billing } as unknown as configuration.StoreBillingRuntime;
let app: Express;
let configSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  await connectTestDatabase();
  configSpy = vi.spyOn(configuration, 'configureStoreBilling').mockReturnValue(runtime);
  app = await createTestApp();
  for (const model of [StoreBillingAccountModel, StorePurchaseModel, StoreBillingNotificationModel, SubscriptionModel]) await model.init();
});
afterEach(() => { configSpy.mockReturnValue(runtime); });
afterAll(async () => { vi.restoreAllMocks(); await dropTestDatabase(); await disconnectTestDatabase(); });

async function user() {
  const response = await request(app).post('/api/v1/auth/register').send({ name: 'Store API test',
    email: `${randomUUID()}@example.test`, password: 'SecurePass123',
    legalAcceptance: { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true },
  }).expect(201);
  return { id: response.body.data.user.id, token: `Bearer ${response.body.data.tokens.accessToken}` };
}

async function prepare() {
  const actor = await user();
  const response = await request(app).post('/api/v1/store-billing/prepare').set('Authorization', actor.token)
    .send({ store: 'google', productId: 'pro', basePlanId: 'monthly' }).expect(200);
  const reference = `private-${randomUUID()}`;
  const purchase: VerifiedStorePurchase = {
    store: 'google', reference, transactionId: 'test-order', accountToken: response.body.data.accountToken,
    productId: 'pro', basePlanId: 'monthly', tier: 'pro', billingCycle: BillingCycle.MONTHLY,
    periodStart: new Date(Date.now() - 1000), periodEnd: new Date(Date.now() + 86_400_000),
    active: true, pending: false, autoRenew: true, needsAcknowledgement: true, environment: 'production', verifiedAt: new Date(),
  };
  purchases.set(reference, purchase);
  return { actor, reference, purchase };
}

it('serves authenticated catalog/preflight, rejects client entitlements and verifies/restores the purchase', async () => {
  await request(app).get('/api/v1/store-billing/catalog/google').expect(401);
  const f = await prepare();
  const catalog = await request(app).get('/api/v1/store-billing/catalog/google').set('Authorization', f.actor.token).expect(200);
  expect(catalog.headers['cache-control']).toContain('no-store');
  expect(catalog.body.data).toMatchObject({ available: true, provider: 'google', products: [{ tier: 'pro', basePlanId: 'monthly' }] });
  await request(app).get('/api/v1/store-billing/catalog/unsupported').set('Authorization', f.actor.token).expect(400);
  await request(app).post('/api/v1/store-billing/verify').set('Authorization', f.actor.token)
    .send({ store: 'google', reference: f.reference, tier: 'enterprise', periodEnd: '2100-01-01' }).expect(400);
  const verified = await request(app).post('/api/v1/store-billing/verify').set('Authorization', f.actor.token)
    .send({ store: 'google', reference: f.reference }).expect(200);
  expect(verified.body.data).toMatchObject({ active: true, subscription: { tier: 'pro', billingProvider: 'google' } });
  expect(JSON.stringify(verified.body)).not.toContain(f.reference);
  expect(verified.body.data.subscription).not.toHaveProperty('storePurchaseKey');
  await request(app).post('/api/v1/store-billing/verify').set('Authorization', f.actor.token)
    .send({ store: 'google', reference: f.reference }).expect(200);
  expect(await StorePurchaseModel.countDocuments({ userId: f.actor.id })).toBe(1);
  expect((await SubscriptionModel.findOne({ userId: f.actor.id }))?.currentPeriodEnd).toEqual(f.purchase.periodEnd);
  await request(app).post('/api/v1/subscriptions/cancel').set('Authorization', f.actor.token).expect(409);
  const other = await user();
  await request(app).post('/api/v1/store-billing/verify').set('Authorization', other.token)
    .send({ store: 'google', reference: f.reference }).expect(403);
});

it('accepts only authenticated provider events, persists before acknowledgement and handles revocation after restart', async () => {
  const f = await prepare();
  await request(app).post('/api/v1/store-billing/verify').set('Authorization', f.actor.token)
    .send({ store: 'google', reference: f.reference }).expect(200);
  await request(app).post('/api/v1/webhooks/store/google').send({ reference: f.reference }).expect(401);
  await request(app).post('/api/v1/webhooks/store/apple').send({ signedPayload: 'forged' }).expect(401);
  expect(await StoreBillingNotificationModel.countDocuments()).toBe(0);
  await request(app).post('/api/v1/webhooks/store/google').set('Authorization', 'Bearer verified-test-oidc')
    .send({ reference: f.reference }).expect(200);
  expect(await StoreBillingNotificationModel.countDocuments()).toBe(1);
  expect((await SubscriptionModel.findOne({ userId: f.actor.id }))?.status).toBe('active');
  f.purchase.active = false;
  f.purchase.autoRenew = false;
  f.purchase.needsAcknowledgement = false;
  const restarted = new MongoStoreBilling(verifier, new StoreReceiptCipher(Buffer.alloc(32, 1)));
  await restarted.reconcileNotifications();
  expect(await StoreBillingNotificationModel.countDocuments()).toBe(0);
  expect((await SubscriptionModel.findOne({ userId: f.actor.id }))?.status).toBe('expired');
});

it('does not acknowledge a provider event when durable enqueue fails', async () => {
  const f = await prepare();
  const spy = vi.spyOn(billing, 'enqueueNotification').mockRejectedValueOnce(new Error('injected database outage'));
  await request(app).post('/api/v1/webhooks/store/google').set('Authorization', 'Bearer verified-test-oidc')
    .send({ reference: f.reference }).expect(500);
  expect(await StoreBillingNotificationModel.countDocuments()).toBe(0);
  spy.mockRestore();
});

it('preserves a newer notification arriving during processing of the same purchase', async () => {
  const f = await prepare();
  await billing.enqueueNotification('google', f.reference);
  let began!: () => void;
  const started = new Promise<void>((resolve) => { began = resolve; });
  let release!: (value: VerifiedStorePurchase) => void;
  verifier.verify.mockImplementationOnce(async () => {
    began();
    return new Promise((resolve) => { release = resolve; });
  });
  const first = billing.reconcileNotifications(1);
  await started;
  await billing.enqueueNotification('google', f.reference);
  f.purchase.active = false;
  f.purchase.autoRenew = false;
  release({ ...f.purchase });
  await first;
  const retained = await StoreBillingNotificationModel.findOne();
  expect(retained?.revision).toBe(2);
  expect(retained?.leaseUntil).toBeUndefined();
  await billing.reconcileNotifications(1);
  expect(await StoreBillingNotificationModel.countDocuments()).toBe(0);
  expect((await SubscriptionModel.findOne({ userId: f.actor.id }))?.status).toBe('expired');
});

it('disables purchase initiation without store configuration while preserving the existing account provider', async () => {
  const f = await prepare();
  configSpy.mockReturnValue(null);
  const disabled = await createTestApp();
  const catalog = await request(disabled).get('/api/v1/store-billing/catalog/google').set('Authorization', f.actor.token).expect(200);
  expect(catalog.body.data).toMatchObject({ available: false, provider: 'google', products: [] });
  await request(disabled).post('/api/v1/store-billing/prepare').set('Authorization', f.actor.token)
    .send({ store: 'google', productId: 'pro', basePlanId: 'monthly' }).expect(503);
});

it('offers administrators sanitized recovery work and atomically audits queued retries', async () => {
  const f = await prepare();
  await billing.verifyForUser(f.actor.id, 'google', f.reference);
  const saved = await StorePurchaseModel.findOne({ userId: f.actor.id });
  const later = new Date('2030-01-01');
  await StorePurchaseModel.updateOne({ _id: saved!._id }, { $set: { acknowledgementPending: true, reviewRequired: true, lastError: 'purchase_review_required', nextCheckAt: later } });
  await billing.enqueueNotification('google', f.reference);
  const notification = await StoreBillingNotificationModel.findOne();
  await StoreBillingNotificationModel.updateOne({ _id: notification!._id }, { $set: { leaseUntil: later, processingToken: 'worker-lease' } });
  await request(app).get('/api/v1/admin/store-billing').expect(401);
  await request(app).get('/api/v1/admin/store-billing').set('Authorization', f.actor.token).expect(403);
  const admin = await user();
  await UserModel.updateOne({ _id: admin.id }, { $set: { role: 'admin' } });
  const queue = await request(app).get('/api/v1/admin/store-billing').set('Authorization', admin.token).expect(200);
  expect(queue.headers['cache-control']).toContain('no-store');
  expect(queue.body.data.purchases).toEqual(expect.arrayContaining([expect.objectContaining({ _id: saved!._id, acknowledgementPending: true })]));
  expect(JSON.stringify(queue.body)).not.toContain(f.reference);
  expect(JSON.stringify(queue.body)).not.toContain('referenceCiphertext');
  const path = `/api/v1/admin/store-billing/purchase/${saved!._id}/retry`;
  const auditFailure = vi.spyOn(AuditLogModel, 'create').mockRejectedValueOnce(new Error('audit unavailable'));
  await request(app).post(path).set('Authorization', admin.token).send({ reason: 'Store permissions have been reviewed.' }).expect(500);
  auditFailure.mockRestore();
  expect((await StorePurchaseModel.findById(saved!._id))?.nextCheckAt).toEqual(later);
  await request(app).post(path).set('Authorization', admin.token).send({ reason: 'Store permissions have been reviewed.' }).expect(202);
  expect((await StorePurchaseModel.findById(saved!._id))?.reviewRequired).toBe(true);
  expect(await AuditLogModel.exists({ actorId: admin.id, action: 'STORE_BILLING_RETRY' })).toBeTruthy();
  await request(app).post(`/api/v1/admin/store-billing/notification/${notification!._id}/retry`).set('Authorization', admin.token).send({ reason: 'Queue delivery configuration reviewed.' }).expect(202);
  expect((await StoreBillingNotificationModel.findById(notification!._id))?.processingToken).toBe('worker-lease');
  await UserModel.updateOne({ _id: admin.id }, { $set: { role: 'user' } });
  await request(app).post(path).set('Authorization', admin.token).send({ reason: 'Former administrator must be denied.' }).expect(403);
});

it('does not delay a newer notification when an older provider lookup fails', async () => {
  await StoreBillingNotificationModel.deleteMany({});
  const f = await prepare();
  await billing.enqueueNotification('google', f.reference);
  let reject!: (error: Error) => void;
  let began!: () => void;
  const started = new Promise<void>(resolve => { began = resolve; });
  verifier.verify.mockImplementationOnce(async () => {
    began(); return new Promise((_resolve, fail) => { reject = fail; });
  });
  const older = billing.reconcileNotifications(1);
  await started;
  await billing.enqueueNotification('google', f.reference);
  reject(new AppError('old account lookup failed', 409));
  await older;
  const current = await StoreBillingNotificationModel.findOne();
  expect(current?.revision).toBe(2);
  expect(current?.nextAttemptAt.getTime()).toBeLessThanOrEqual(Date.now());
  expect(current?.lastError).toBeUndefined();
  expect(current?.leaseUntil).toBeUndefined();
  await billing.reconcileNotifications(1);
  expect(await StoreBillingNotificationModel.countDocuments()).toBe(0);
});
