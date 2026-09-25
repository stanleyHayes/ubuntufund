import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { BillingCycle } from '@ubuntu-fund/types';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import type { StorePurchaseVerifierPort, VerifiedStorePurchase } from '../../src/domain/ports/outbound/StorePurchaseVerifierPort.js';
import { MongoStoreBilling } from '../../src/infrastructure/adapters/outbound/persistence/MongoStoreBilling.js';
import { MongoBillingOwnership } from '../../src/infrastructure/adapters/outbound/persistence/MongoBillingOwnership.js';
import { MongoSubscriptionRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoSubscriptionRepository.js';
import { GetMySubscriptionUseCase } from '../../src/application/use-cases/GetMySubscriptionUseCase.js';
import { StoreReceiptCipher, storePurchaseKey } from '../../src/infrastructure/adapters/outbound/payments/StoreReceiptCipher.js';
import { StoreBillingAccountModel } from '../../src/infrastructure/database/models/StoreBillingAccountModel.js';
import { StorePurchaseModel } from '../../src/infrastructure/database/models/StorePurchaseModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { SubscriptionCheckoutModel } from '../../src/infrastructure/database/models/SubscriptionCheckoutModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';

const models = [StoreBillingAccountModel, StorePurchaseModel, SubscriptionModel, SubscriptionCheckoutModel, UserModel];
const cipher = new StoreReceiptCipher(Buffer.alloc(32, 7));

function services() {
  const verifier = {
    verify: vi.fn<StorePurchaseVerifierPort['verify']>(), acknowledge: vi.fn(async () => {}),
    appleNotification: vi.fn(async () => null), googleNotification: vi.fn(async () => null),
  };
  return { verifier, billing: new MongoStoreBilling(verifier, cipher) };
}

async function user() {
  return (await UserModel.create({ email: `${randomUUID()}@example.test`, name: 'Store billing test', passwordHash: 'not-a-login-hash' })).id;
}

async function fixture() {
  const userId = await user();
  const { billing, verifier } = services();
  const account = await billing.account(userId);
  const purchase: VerifiedStorePurchase = {
    store: 'google', reference: 'private-purchase-token', transactionId: 'order-1', accountToken: account.accountToken,
    productId: 'pro', basePlanId: 'monthly', tier: 'pro', billingCycle: BillingCycle.MONTHLY,
    periodStart: new Date(Date.now() - 86_400_000), periodEnd: new Date(Date.now() + 86_400_000),
    active: true, pending: false, autoRenew: true, environment: 'production', needsAcknowledgement: true, verifiedAt: new Date(),
  };
  verifier.verify.mockImplementation(async () => ({ ...purchase }));
  return { userId, account, billing, verifier, purchase };
}

describe('store purchase ownership and recovery', () => {
  beforeAll(async () => { await connectTestDatabase(); for (const model of models) await model.init(); });
  beforeEach(async () => { for (const model of models) await model.deleteMany({}); });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

  it('atomically chooses one billing provider when web and native checkout race', async () => {
    const userId = await user();
    const results = await Promise.allSettled([
      new MongoBillingOwnership().claimProvider(userId, 'web'),
      new MongoBillingOwnership().claimProvider(userId, 'apple'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await StoreBillingAccountModel.countDocuments({ userId })).toBe(1);
    const winner = (await StoreBillingAccountModel.findOne({ userId }))!.provider;
    await expect(new MongoBillingOwnership().claimProvider(userId, winner === 'web' ? 'apple' : 'web'))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('refuses native checkout while a legacy web payment is pending', async () => {
    const userId = await user();
    await SubscriptionCheckoutModel.create({ userId, tier: 'pro', billingCycle: 'monthly', status: 'pending',
      baseAmount: 100, discountAmount: 0, finalAmount: 100, currency: 'GHS' });
    await expect(new MongoBillingOwnership().claimProvider(userId, 'google')).rejects.toMatchObject({ statusCode: 409 });
    expect((await StoreBillingAccountModel.findOne({ userId }))?.provider).toBeUndefined();
  });

  it('refuses native checkout over an active legacy web entitlement', async () => {
    const userId = await user();
    await SubscriptionModel.create({ userId, tier: 'pro', billingCycle: 'monthly', status: 'active',
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86_400_000) });
    await expect(new MongoBillingOwnership().claimProvider(userId, 'apple')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('does not claim or grant a purchase with another account binding', async () => {
    const f = await fixture();
    f.purchase.accountToken = randomUUID();
    await expect(f.billing.verifyForUser(f.userId, 'google', f.purchase.reference)).rejects.toMatchObject({ statusCode: 403 });
    expect(await StorePurchaseModel.countDocuments()).toBe(0);
    expect(await SubscriptionModel.countDocuments()).toBe(0);
    expect(f.verifier.acknowledge).not.toHaveBeenCalled();
    expect((await StoreBillingAccountModel.findOne({ userId: f.userId }))?.provider).toBeUndefined();
  });

  it('persists a unique claim and committed entitlement before acknowledgement, keeping receipts private', async () => {
    const f = await fixture();
    f.verifier.acknowledge.mockImplementation(async () => {
      expect((await SubscriptionModel.findOne({ userId: f.userId }))?.status).toBe('active');
      expect(await StorePurchaseModel.countDocuments({ userId: f.userId })).toBe(1);
    });
    expect(await f.billing.verifyForUser(f.userId, 'google', f.purchase.reference)).toMatchObject({ active: true, applied: true });
    const key = storePurchaseKey('google', f.purchase.reference);
    expect((await StorePurchaseModel.findById(key))?.referenceCiphertext).toBeUndefined();
    const privateRow = await StorePurchaseModel.findById(key).select('+referenceCiphertext');
    expect(privateRow!.referenceCiphertext).not.toContain(f.purchase.reference);
    expect(cipher.decrypt('google', privateRow!.referenceCiphertext)).toBe(f.purchase.reference);
    expect(() => cipher.decrypt('apple', privateRow!.referenceCiphertext)).toThrow();
    expect(privateRow?.acknowledgementPending).toBe(false);
    await f.billing.verifyForUser(f.userId, 'google', f.purchase.reference);
    expect(await StorePurchaseModel.countDocuments()).toBe(1);
    expect((await SubscriptionModel.findOne({ userId: f.userId }))?.currentPeriodEnd).toEqual(f.purchase.periodEnd);
  });

  it('records the store environment so App Review / TestFlight sandbox access is never revenue', async () => {
    const f = await fixture();
    f.purchase.environment = 'sandbox';
    await f.billing.verifyForUser(f.userId, 'google', f.purchase.reference);
    expect((await StorePurchaseModel.findOne({ userId: f.userId }))?.environment).toBe('sandbox');
    const subscription = await new MongoSubscriptionRepository().findByUserId(f.userId);
    expect(subscription).toMatchObject({ tier: 'pro', status: 'active', billingEnvironment: 'sandbox' });
    f.purchase.environment = 'production';
    await f.billing.verifyForUser(f.userId, 'google', f.purchase.reference);
    expect((await new MongoSubscriptionRepository().findByUserId(f.userId))?.billingEnvironment).toBe('production');
  });

  it('never transfers an already claimed reference even if provider binding were changed', async () => {
    const f = await fixture();
    await f.billing.verifyForUser(f.userId, 'google', f.purchase.reference);
    const otherId = await user();
    f.purchase.accountToken = (await f.billing.account(otherId)).accountToken;
    await expect(f.billing.verifyForUser(otherId, 'google', f.purchase.reference)).rejects.toMatchObject({ statusCode: 409 });
    expect(await StorePurchaseModel.countDocuments({ userId: f.userId })).toBe(1);
    expect(await SubscriptionModel.countDocuments({ userId: otherId })).toBe(0);
  });

  it('retries acknowledgement after restart without extending or duplicating access', async () => {
    const f = await fixture();
    f.verifier.acknowledge.mockRejectedValue(new Error('temporary provider outage'));
    await f.billing.verifyForUser(f.userId, 'google', f.purchase.reference);
    expect((await StorePurchaseModel.findOne({ userId: f.userId }))?.acknowledgementPending).toBe(true);
    await StorePurchaseModel.updateOne({ userId: f.userId }, { $set: { nextCheckAt: new Date(0) } });
    const recovered = services();
    recovered.verifier.verify.mockResolvedValue(f.purchase);
    await recovered.billing.reconcile();
    expect(recovered.verifier.acknowledge).toHaveBeenCalledOnce();
    expect((await StorePurchaseModel.findOne({ userId: f.userId }))?.acknowledgementPending).toBe(false);
    expect((await SubscriptionModel.findOne({ userId: f.userId }))?.currentPeriodEnd).toEqual(f.purchase.periodEnd);
  });

  it('does not let a slow older active verification overwrite a newer revocation', async () => {
    const f = await fixture();
    let release!: (p: VerifiedStorePurchase) => void;
    let began!: () => void;
    const started = new Promise<void>((resolve) => { began = resolve; });
    f.verifier.verify.mockImplementationOnce(async () => {
      began();
      return new Promise((resolve) => { release = resolve; });
    });
    const older = f.billing.verifyForUser(f.userId, 'google', f.purchase.reference);
    await started;
    f.verifier.verify.mockResolvedValue({ ...f.purchase, active: false, autoRenew: false, needsAcknowledgement: false });
    await f.billing.verifyForUser(f.userId, 'google', f.purchase.reference);
    release(f.purchase);
    expect(await older).toMatchObject({ active: false, applied: false });
    expect((await SubscriptionModel.findOne({ userId: f.userId }))?.status).toBe('expired');
    expect((await StorePurchaseModel.findOne({ userId: f.userId }))?.active).toBe(false);
  });

  it('retires a linked Google purchase and does not restore it over its replacement', async () => {
    const f = await fixture();
    await f.billing.verifyForUser(f.userId, 'google', f.purchase.reference);
    const old = { ...f.purchase };
    Object.assign(f.purchase, { reference: 'replacement-token', linkedReference: old.reference, tier: 'organization' });
    await f.billing.verifyForUser(f.userId, 'google', f.purchase.reference);
    const replacementKey = storePurchaseKey('google', f.purchase.reference);
    expect((await StorePurchaseModel.findById(storePurchaseKey('google', old.reference)))?.replacedBy).toBe(replacementKey);
    f.verifier.verify.mockResolvedValue(old);
    expect(await f.billing.verifyForUser(f.userId, 'google', old.reference)).toMatchObject({ active: false, applied: false });
    expect((await SubscriptionModel.findOne({ userId: f.userId }))?.storePurchaseKey).toBe(replacementKey);
  });

  it('does not retire a linked active subscription for a pending replacement', async () => {
    const f = await fixture();
    await f.billing.verifyForUser(f.userId, 'google', f.purchase.reference);
    const oldKey = storePurchaseKey('google', f.purchase.reference);
    Object.assign(f.purchase, { reference: 'pending-replacement', linkedReference: f.purchase.reference, active: false, pending: true, needsAcknowledgement: false });
    await f.billing.verifyForUser(f.userId, 'google', f.purchase.reference);
    expect((await StorePurchaseModel.findById(oldKey))?.replacedBy).toBeUndefined();
    expect((await SubscriptionModel.findOne({ userId: f.userId }))?.status).toBe('active');
  });

  it('blocks web mutation of a store-managed plan even if store credentials are unavailable', async () => {
    const f = await fixture();
    await f.billing.verifyForUser(f.userId, 'google', f.purchase.reference);
    const repository = new MongoSubscriptionRepository();
    const subscription = (await repository.findByUserId(f.userId))!;
    expect(subscription.billingProvider).toBe('google');
    await expect(repository.update({ ...subscription, tier: 'free' })).rejects.toMatchObject({ statusCode: 409 });
    await expect(new MongoBillingOwnership().claimProvider(f.userId, 'web')).rejects.toMatchObject({ statusCode: 409 });
    expect((await repository.findByUserId(f.userId))?.tier).toBe('pro');
  });

  it('never reactivates a closed account from a delayed store renewal', async () => {
    const f = await fixture();
    await UserModel.updateOne({ _id: f.userId }, { $set: { deletedAt: new Date() } });
    await expect(f.billing.verifyForUser(f.userId, 'google', f.purchase.reference)).rejects.toMatchObject({ statusCode: 410 });
    expect(await SubscriptionModel.countDocuments()).toBe(0);
    expect(f.verifier.acknowledge).not.toHaveBeenCalled();
  });

  it('rolls receipt and entitlement writes back together when activation fails', async () => {
    const f = await fixture();
    const original = SubscriptionModel.findOneAndUpdate.bind(SubscriptionModel);
    const fail = vi.spyOn(SubscriptionModel, 'findOneAndUpdate').mockImplementationOnce((...args: Parameters<typeof original>) => {
      const query = original(...args);
      const exec = query.exec.bind(query);
      query.exec = async () => { await exec(); throw new Error('injected activation failure'); };
      return query;
    });
    await expect(f.billing.verifyForUser(f.userId, 'google', f.purchase.reference)).rejects.toThrow('injected activation');
    expect(await StorePurchaseModel.countDocuments()).toBe(0);
    expect(await SubscriptionModel.countDocuments()).toBe(0);
    expect(f.verifier.acknowledge).not.toHaveBeenCalled();
    fail.mockRestore();
    await f.billing.verifyForUser(f.userId, 'google', f.purchase.reference);
    expect(await StorePurchaseModel.countDocuments()).toBe(1);
    expect((await SubscriptionModel.findOne({ userId: f.userId }))?.tier).toBe('pro');
  });

  it('preserves a paid activation when concurrent first reads provision the free plan', async () => {
    const f = await fixture();
    const mine = new GetMySubscriptionUseCase(new MongoSubscriptionRepository());
    await Promise.all([f.billing.verifyForUser(f.userId, 'google', f.purchase.reference), mine.execute(f.userId), mine.execute(f.userId)]);
    expect(await SubscriptionModel.countDocuments({ userId: f.userId })).toBe(1);
    expect((await SubscriptionModel.findOne({ userId: f.userId }))?.tier).toBe('pro');
  });

  it('keeps the previous expiry during a provider outage and queues reconciliation retry', async () => {
    const f = await fixture();
    await f.billing.verifyForUser(f.userId, 'google', f.purchase.reference);
    await StorePurchaseModel.updateOne({ userId: f.userId }, { $set: { nextCheckAt: new Date(0) } });
    f.verifier.verify.mockRejectedValue(new Error('request contains a secret token'));
    await f.billing.reconcile();
    const row = await StorePurchaseModel.findOne({ userId: f.userId });
    expect(row?.lastError).toBe('verification_retry_pending');
    expect(row?.nextCheckAt.getTime()).toBeGreaterThan(Date.now());
    expect((await SubscriptionModel.findOne({ userId: f.userId }))?.currentPeriodEnd).toEqual(f.purchase.periodEnd);
  });

  it('does not let an older failed sweep mark a newer successful verification as failed', async () => {
    const f = await fixture();
    await f.billing.verifyForUser(f.userId, 'google', f.purchase.reference);
    await StorePurchaseModel.updateOne({ userId: f.userId }, { $set: { nextCheckAt: new Date(0) } });
    let reject!: (error: Error) => void;
    let began!: () => void;
    const started = new Promise<void>(resolve => { began = resolve; });
    f.verifier.verify.mockImplementationOnce(async () => {
      began(); return new Promise((_resolve, fail) => { reject = fail; });
    });
    const older = f.billing.reconcile(1);
    await started;
    await f.billing.verifyForUser(f.userId, 'google', f.purchase.reference);
    const current = await StorePurchaseModel.findOne({ userId: f.userId });
    reject(new Error('old provider failure'));
    await older;
    const after = await StorePurchaseModel.findOne({ userId: f.userId });
    expect(after?.lastError).toBeUndefined();
    expect(after?.nextCheckAt).toEqual(current?.nextCheckAt);
    expect(after?.reviewRequired).toBe(false);
  });
});
