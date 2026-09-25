import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { backfillSubscriptionPaymentReferences } from '../../scripts/backfill-subscription-payment-references.js';
import { RevokeRefundedSubscriptionUseCase } from '../../src/application/use-cases/RevokeRefundedSubscriptionUseCase.js';
import { MongoUnitOfWork } from '../../src/infrastructure/adapters/outbound/persistence/MongoUnitOfWork.js';
import { MongoSubscriptionCheckoutRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoSubscriptionCheckoutRepository.js';
import { MongoSubscriptionRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoSubscriptionRepository.js';
import { SubscriptionCheckoutModel } from '../../src/infrastructure/database/models/SubscriptionCheckoutModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';

const DAY = 86_400_000;
const models = [SubscriptionCheckoutModel, SubscriptionModel];

/** A web plan settled before paymentReferences existed, and the charges behind it. */
async function legacyPlan(opts: { tier?: string; start: Date; charges: { cycle: 'monthly' | 'yearly'; settledAt: Date; ref?: string }[] }) {
  const userId = randomUUID();
  const tier = opts.tier ?? 'pro';
  const days = opts.charges.reduce((total, charge) => total + (charge.cycle === 'yearly' ? 365 : 30), 0);
  const subscription = await SubscriptionModel.create({ userId, tier, status: 'active', billingCycle: opts.charges[0]?.cycle ?? 'monthly',
    billingProvider: 'web', currentPeriodStart: opts.start, currentPeriodEnd: new Date(opts.start.getTime() + days * DAY) });
  const refs: string[] = [];
  for (const charge of opts.charges) {
    const ref = charge.ref ?? `sub-${randomUUID().slice(0, 8)}`;
    refs.push(ref);
    await SubscriptionCheckoutModel.collection.insertOne({ userId, tier, billingCycle: charge.cycle, status: 'succeeded',
      baseAmount: 149, discountAmount: 0, finalAmount: 149, currency: 'GHS', providerRef: ref,
      createdAt: charge.settledAt, updatedAt: charge.settledAt });
  }
  return { userId, subscription, refs };
}

describe('backfill of subscription payment references', () => {
  beforeAll(async () => { await connectTestDatabase(); for (const model of models) await model.init(); });
  beforeEach(async () => { for (const model of models) await model.deleteMany({}); });
  afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

  it('links a pre-deploy yearly plan to its charge so a refund revokes it, and is idempotent', async () => {
    const start = new Date(Date.now() - 40 * DAY);
    const yearly = await legacyPlan({ start, charges: [{ cycle: 'yearly', settledAt: new Date(start.getTime() + 2_000) }] });
    const revoke = new RevokeRefundedSubscriptionUseCase(new MongoUnitOfWork(), new MongoSubscriptionCheckoutRepository(), new MongoSubscriptionRepository());
    // Before the backfill the refund is ignored and the member keeps the plan.
    expect(await revoke.execute({ reference: yearly.refs[0] })).toBe('ignored');

    expect(await backfillSubscriptionPaymentReferences({ apply: false })).toMatchObject({ candidates: 1, matched: 1, updated: 0 });
    expect((await SubscriptionModel.findById(yearly.subscription._id))?.paymentReferences).toBeUndefined();
    expect(await backfillSubscriptionPaymentReferences({ apply: true })).toMatchObject({ matched: 1, updated: 1, unmatched: [] });
    expect((await SubscriptionModel.findById(yearly.subscription._id))?.paymentReferences).toEqual(yearly.refs);
    expect(await backfillSubscriptionPaymentReferences({ apply: true })).toMatchObject({ candidates: 0, updated: 0 });

    expect(await revoke.execute({ reference: yearly.refs[0] })).toBe('revoked');
    expect((await SubscriptionModel.findById(yearly.subscription._id))?.status).toBe('expired');
  });

  it('includes early renewals and leaves an older replaced period out', async () => {
    const start = new Date(Date.now() - 20 * DAY);
    const plan = await legacyPlan({ start, charges: [
      { cycle: 'monthly', settledAt: new Date(start.getTime() + 1_000) },
      { cycle: 'monthly', settledAt: new Date(start.getTime() + 10 * DAY) },
    ] });
    // A charge from an earlier, lapsed Pro period.
    await SubscriptionCheckoutModel.collection.insertOne({ userId: plan.userId, tier: 'pro', billingCycle: 'monthly', status: 'succeeded',
      baseAmount: 149, discountAmount: 0, finalAmount: 149, currency: 'GHS', providerRef: 'sub-oldperiod',
      createdAt: new Date(start.getTime() - 60 * DAY), updatedAt: new Date(start.getTime() - 60 * DAY) });
    await backfillSubscriptionPaymentReferences({ apply: true });
    expect((await SubscriptionModel.findById(plan.subscription._id))?.paymentReferences).toEqual(plan.refs);
  });

  it('reports rows it cannot reconcile instead of guessing', async () => {
    const start = new Date(Date.now() - 5 * DAY);
    // Granted without a checkout (e.g. by staff): nothing to link.
    const granted = await SubscriptionModel.create({ userId: randomUUID(), tier: 'pro', status: 'active', billingCycle: 'monthly',
      billingProvider: 'web', currentPeriodStart: start, currentPeriodEnd: new Date(start.getTime() + 30 * DAY) });
    // Periods that do not add up to the stored end date.
    const odd = await legacyPlan({ start, charges: [{ cycle: 'monthly', settledAt: new Date(start.getTime() + 1_000) }] });
    await SubscriptionModel.updateOne({ _id: odd.subscription._id }, { $set: { currentPeriodEnd: new Date(start.getTime() + 45 * DAY) } });
    // Store-billed and lapsed plans are out of scope.
    await SubscriptionModel.create({ userId: randomUUID(), tier: 'pro', status: 'active', billingCycle: 'monthly', billingProvider: 'apple',
      currentPeriodStart: start, currentPeriodEnd: new Date(start.getTime() + 30 * DAY) });
    await SubscriptionModel.create({ userId: randomUUID(), tier: 'pro', status: 'active', billingCycle: 'monthly', billingProvider: 'web',
      currentPeriodStart: new Date(Date.now() - 60 * DAY), currentPeriodEnd: new Date(Date.now() - 30 * DAY) });
    const summary = await backfillSubscriptionPaymentReferences({ apply: true });
    expect(summary).toMatchObject({ candidates: 2, matched: 0, updated: 0 });
    expect(summary.unmatched.sort()).toEqual([String(granted._id), String(odd.subscription._id)].sort());
  });
});
