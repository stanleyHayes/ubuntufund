import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  BillingCycle, CouponDiscountType, SUBSCRIPTION_PLANS, SubscriptionCheckoutStatus, SubscriptionTier, type SubscriptionPlan,
} from '@ubuntu-fund/types';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { CreateSubscriptionCheckoutUseCase } from '../../src/application/use-cases/CreateSubscriptionCheckoutUseCase.js';
import { SettleSubscriptionUseCase } from '../../src/application/use-cases/SettleSubscriptionUseCase.js';
import { ReconcileSubscriptionCheckoutsUseCase } from '../../src/application/use-cases/ReconcileSubscriptionCheckoutsUseCase.js';
import { GetSubscriptionCheckoutUseCase } from '../../src/application/use-cases/GetSubscriptionCheckoutUseCase.js';
import { CouponService } from '../../src/application/services/CouponService.js';
import { MongoUnitOfWork } from '../../src/infrastructure/adapters/outbound/persistence/MongoUnitOfWork.js';
import { MongoBillingOwnership } from '../../src/infrastructure/adapters/outbound/persistence/MongoBillingOwnership.js';
import { MongoSubscriptionCheckoutRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoSubscriptionCheckoutRepository.js';
import { MongoSubscriptionRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoSubscriptionRepository.js';
import { MongoCouponRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCouponRepository.js';
import { MongoCouponRedemptionRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCouponRedemptionRepository.js';
import { MongoCouponEligibility } from '../../src/infrastructure/adapters/outbound/persistence/MongoCouponEligibility.js';
import { SubscriptionCheckoutModel } from '../../src/infrastructure/database/models/SubscriptionCheckoutModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { CouponModel } from '../../src/infrastructure/database/models/CouponModel.js';
import { CouponRedemptionModel } from '../../src/infrastructure/database/models/CouponRedemptionModel.js';
import { StoreBillingAccountModel } from '../../src/infrastructure/database/models/StoreBillingAccountModel.js';
import { ProviderTransactionNotFoundError } from '../../src/domain/errors/ProviderTransactionNotFoundError.js';

const models = [SubscriptionCheckoutModel, SubscriptionModel, CouponModel, CouponRedemptionModel, StoreBillingAccountModel];
const DAY = 86_400_000;
const seeds = SUBSCRIPTION_PLANS as Record<string, SubscriptionPlan>;

/** Paystack double: every opened charge is 'abandoned' until the test says otherwise. */
function paystack() {
  const statuses = new Map<string, string>();
  const amounts = new Map<string, number>();
  return {
    statuses,
    isConfigured: () => true,
    initializeCharge: vi.fn(async ({ amount }: { amount: number }) => {
      const reference = `sub-${randomUUID().slice(0, 8)}`;
      statuses.set(reference, 'abandoned');
      amounts.set(reference, amount);
      return { reference, authorizationUrl: `https://checkout.paystack.test/${reference}`, accessCode: 'access' };
    }),
    verifyTransaction: vi.fn(async (reference: string) => ({
      status: statuses.get(reference) ?? 'abandoned', reference, amount: amounts.get(reference) ?? 0, fees: 0, currency: 'GHS', raw: {},
    })),
  };
}

function build(plans: Record<string, Partial<SubscriptionPlan>> = {}) {
  const gateway = paystack();
  const checkoutRepo = new MongoSubscriptionCheckoutRepository();
  const subscriptionRepo = new MongoSubscriptionRepository();
  const couponRepo = new MongoCouponRepository();
  const redemptionRepo = new MongoCouponRedemptionRepository();
  const settle = new SettleSubscriptionUseCase(new MongoUnitOfWork(), checkoutRepo, subscriptionRepo, couponRepo, redemptionRepo);
  const planService = { getPlan: async (tier: string) => ({ ...(seeds[tier] ?? seeds.free), ...plans[tier] }) };
  const users = { findById: async (id: string) => ({ id, email: { value: `${id}@example.test` } }) };
  const create = new CreateSubscriptionCheckoutUseCase(new MongoBillingOwnership(), checkoutRepo, redemptionRepo, users as never,
    new CouponService(couponRepo, redemptionRepo, new MongoCouponEligibility()), gateway as never, settle, planService as never,
    undefined, subscriptionRepo);
  const sweep = new ReconcileSubscriptionCheckoutsUseCase(checkoutRepo, gateway as never, settle, redemptionRepo);
  const status = new GetSubscriptionCheckoutUseCase(checkoutRepo, gateway as never, settle, redemptionRepo);
  return { gateway, checkoutRepo, settle, create, sweep, status };
}
const buy = (s: ReturnType<typeof build>, userId: string, tier = SubscriptionTier.PRO, extra: Record<string, unknown> = {}) =>
  s.create.execute({ tier, billingCycle: BillingCycle.MONTHLY, ...extra }, userId);
async function pay(s: ReturnType<typeof build>, reference: string) {
  s.gateway.statuses.set(reference, 'success');
  const checkout = (await s.checkoutRepo.findByProviderRef(reference))!;
  await s.settle.execute(checkout, reference);
}
async function age(checkoutId: string, ms: number) {
  await SubscriptionCheckoutModel.collection.updateOne({ _id: (await SubscriptionCheckoutModel.findById(checkoutId))!._id },
    { $set: { createdAt: new Date(Date.now() - ms) } });
}

describe('subscription checkout lifecycle', () => {
  beforeAll(async () => { await connectTestDatabase(); for (const model of models) await model.init(); });
  beforeEach(async () => { for (const model of models) await model.deleteMany({}); });
  afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

  it('adds an early same-plan renewal to the end of the running period instead of discarding paid days', async () => {
    const s = build(); const userId = randomUUID();
    const first = await buy(s, userId);
    await pay(s, first.reference!);
    const before = (await SubscriptionModel.findOne({ userId }))!;
    const second = await buy(s, userId);
    await pay(s, second.reference!);
    const after = (await SubscriptionModel.findOne({ userId }))!;
    expect(after.tier).toBe(SubscriptionTier.PRO);
    expect(after.currentPeriodStart).toEqual(before.currentPeriodStart);
    expect(after.currentPeriodEnd.getTime()).toBe(before.currentPeriodEnd.getTime() + 30 * DAY);
    // Settlement stays exactly-once: a replayed webhook extends nothing.
    await s.settle.execute((await s.checkoutRepo.findByProviderRef(second.reference!))!, second.reference!);
    expect((await SubscriptionModel.findOne({ userId }))!.currentPeriodEnd).toEqual(after.currentPeriodEnd);
  });

  it('sends a member who backed out of payment back to the same payment page instead of opening a second charge', async () => {
    const s = build(); const userId = randomUUID();
    const first = await buy(s, userId);
    // Paystack reports the page the member left as 'abandoned'; it can still be paid.
    const again = await buy(s, userId);
    expect(again).toMatchObject({ resumed: true, reference: first.reference, authorizationUrl: first.authorizationUrl,
      checkout: { id: first.checkout.id }, preview: first.preview });
    expect(s.gateway.verifyTransaction).toHaveBeenCalledWith(first.reference);
    expect(s.gateway.initializeCharge).toHaveBeenCalledTimes(1);
    expect(await SubscriptionCheckoutModel.countDocuments({ userId })).toBe(1);
  });

  it('refuses a different purchase while the first could still be paid, until the member cancels it', async () => {
    const s = build(); const userId = randomUUID();
    const first = await buy(s, userId);
    const yearly = { billingCycle: BillingCycle.YEARLY };
    await expect(buy(s, userId, SubscriptionTier.PRO, yearly))
      .rejects.toMatchObject({ statusCode: 409, errors: { checkoutId: [first.checkout.id] } });
    expect(await SubscriptionCheckoutModel.countDocuments({ userId })).toBe(1);
    // Only the owner can cancel it.
    await expect(s.status.abandon(first.checkout.id, randomUUID())).rejects.toMatchObject({ statusCode: 404 });
    expect((await s.status.abandon(first.checkout.id, userId)).status).toBe('expired');
    const second = await buy(s, userId, SubscriptionTier.PRO, yearly);
    expect(second.checkout.billingCycle).toBe(BillingCycle.YEARLY);
    // The old page paid late anyway: that charge still activates the plan.
    await pay(s, first.reference!);
    expect((await SubscriptionCheckoutModel.findById(first.checkout.id))?.status).toBe('succeeded');
  });

  it('will not cancel a checkout Paystack is still processing, and settles one that was paid', async () => {
    const s = build(); const userId = randomUUID();
    const first = await buy(s, userId);
    s.gateway.statuses.set(first.reference!, 'ongoing');
    await expect(s.status.abandon(first.checkout.id, userId)).rejects.toMatchObject({ statusCode: 409 });
    expect((await SubscriptionCheckoutModel.findById(first.checkout.id))?.status).toBe('pending');
    s.gateway.statuses.set(first.reference!, 'success');
    expect((await s.status.abandon(first.checkout.id, userId)).status).toBe('succeeded');
    expect((await SubscriptionModel.findOne({ userId }))?.tier).toBe(SubscriptionTier.PRO);
  });

  it('does not lock a member out over a no-charge activation that never committed', async () => {
    const s = build(); const userId = randomUUID();
    const coupon = await CouponModel.create({ code: `ZERO${randomUUID().slice(0, 6)}`.toUpperCase(), discountType: CouponDiscountType.PERCENT,
      amount: 100, currency: 'GHS', maxRedemptions: 10, perUserLimit: 1 });
    const stuck = await s.checkoutRepo.create({ id: '', userId, tier: SubscriptionTier.PRO, billingCycle: BillingCycle.MONTHLY,
      status: SubscriptionCheckoutStatus.PENDING, baseAmount: 149, discountAmount: 149, finalAmount: 0, currency: 'GHS',
      couponId: coupon.id, couponCode: coupon.code, createdAt: new Date(), updatedAt: new Date() });
    await s.checkoutRepo.setProviderRef(stuck.id, `sub_free_${randomUUID()}`);
    // Its seat never got the reference either: stopped between the two writes.
    await CouponRedemptionModel.create({ couponId: coupon.id, code: coupon.code, userId, checkoutId: stuck.id, status: 'pending',
      seat: 0, baseAmount: 149, discountAmount: 149, finalAmount: 0, currency: 'GHS' });
    // Settlement for it is synchronous, so a few minutes on nothing is coming.
    await age(stuck.id, 10 * 60 * 1000);
    const again = await buy(s, userId, SubscriptionTier.PRO, { couponCode: coupon.code });
    expect(again.activatedWithoutCharge).toBe(true);
    expect((await SubscriptionCheckoutModel.findById(stuck.id))?.status).toBe('expired');
    expect(s.gateway.verifyTransaction).not.toHaveBeenCalled();
    expect((await SubscriptionModel.findOne({ userId }))?.tier).toBe(SubscriptionTier.PRO);
  });

  it('treats a reference Paystack has never seen as unpaid instead of blocking every purchase', async () => {
    const s = build(); const userId = randomUUID();
    const first = await buy(s, userId);
    await age(first.checkout.id, 2 * 60 * 60 * 1000);
    s.gateway.verifyTransaction.mockImplementation(async (reference: string) => { throw new ProviderTransactionNotFoundError(reference); });
    await expect(buy(s, userId, SubscriptionTier.STARTER)).resolves.toMatchObject({ authorizationUrl: expect.any(String) });
    expect((await SubscriptionCheckoutModel.findById(first.checkout.id))?.status).toBe('expired');
  });

  it('activates a paid checkout whose webhook is late instead of charging again', async () => {
    const s = build(); const userId = randomUUID();
    const first = await buy(s, userId);
    s.gateway.statuses.set(first.reference!, 'success');
    await expect(buy(s, userId, SubscriptionTier.STARTER)).rejects.toMatchObject({ statusCode: 409, message: expect.stringMatching(/went through/) });
    expect((await SubscriptionCheckoutModel.findById(first.checkout.id))?.status).toBe('succeeded');
    expect((await SubscriptionModel.findOne({ userId }))?.tier).toBe(SubscriptionTier.PRO);
    expect(s.gateway.initializeCharge).toHaveBeenCalledTimes(1);
  });

  it('expires an abandoned checkout older than an hour, frees its coupon seat and opens the new one', async () => {
    const s = build(); const userId = randomUUID();
    const coupon = await CouponModel.create({ code: `ONCE${randomUUID().slice(0, 6)}`.toUpperCase(), discountType: CouponDiscountType.PERCENT,
      amount: 10, currency: 'GHS', maxRedemptions: 10, perUserLimit: 1 });
    const first = await buy(s, userId, SubscriptionTier.PRO, { couponCode: coupon.code });
    await age(first.checkout.id, 2 * 60 * 60 * 1000);
    const second = await buy(s, userId, SubscriptionTier.PRO, { couponCode: coupon.code });
    expect((await SubscriptionCheckoutModel.findById(first.checkout.id))?.status).toBe('expired');
    expect((await CouponRedemptionModel.findOne({ checkoutId: first.checkout.id }))?.status).toBe('released');
    expect(second.preview.discountAmount).toBeGreaterThan(0);
  });

  it('closes a checkout whose payment page could not be opened, so the member can retry at once', async () => {
    const s = build(); const userId = randomUUID();
    s.gateway.initializeCharge.mockRejectedValueOnce(new Error('Paystack unreachable'));
    await expect(buy(s, userId)).rejects.toThrow('Paystack unreachable');
    expect(await SubscriptionCheckoutModel.findOne({ userId })).toMatchObject({ status: 'expired' });
    await expect(buy(s, userId)).resolves.toMatchObject({ authorizationUrl: expect.any(String) });
  });

  it('requires explicit confirmation before a different plan replaces one still in force', async () => {
    const s = build(); const userId = randomUUID();
    const plus = await buy(s, userId, SubscriptionTier.STARTER);
    await pay(s, plus.reference!);
    await expect(buy(s, userId, SubscriptionTier.PRO)).rejects.toMatchObject({ statusCode: 409, errors: { code: ['replace_current_plan'] } });
    expect(await SubscriptionCheckoutModel.countDocuments({ userId })).toBe(1);
    const pro = await buy(s, userId, SubscriptionTier.PRO, { replaceCurrentPlan: true });
    await pay(s, pro.reference!);
    expect((await SubscriptionModel.findOne({ userId }))?.tier).toBe(SubscriptionTier.PRO);
  });

  it('refuses self-serve Enterprise and non-public plans before claiming the billing rail', async () => {
    const s = build({ organization: { isPublic: false } }); const userId = randomUUID();
    await expect(buy(s, userId, SubscriptionTier.ENTERPRISE)).rejects.toMatchObject({ statusCode: 403 });
    await expect(buy(s, userId, SubscriptionTier.ORGANIZATION)).rejects.toMatchObject({ statusCode: 403 });
    expect(await SubscriptionCheckoutModel.countDocuments({ userId })).toBe(0);
    expect((await StoreBillingAccountModel.findOne({ userId }))?.provider).toBeUndefined();
    expect(s.gateway.initializeCharge).not.toHaveBeenCalled();
  });

  it('treats a zero price as a cycle that is not offered, while a 100% coupon on a real price still activates', async () => {
    const s = build({ pro: { priceYearly: 0 } }); const userId = randomUUID();
    await expect(s.create.execute({ tier: SubscriptionTier.PRO, billingCycle: BillingCycle.YEARLY }, userId))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(await SubscriptionCheckoutModel.countDocuments({ userId })).toBe(0);
    expect(await SubscriptionModel.countDocuments({ userId })).toBe(0);
    const coupon = await CouponModel.create({ code: `FREE${randomUUID().slice(0, 6)}`.toUpperCase(), discountType: CouponDiscountType.PERCENT,
      amount: 100, currency: 'GHS', maxRedemptions: 10 });
    const free = await buy(s, userId, SubscriptionTier.PRO, { couponCode: coupon.code });
    expect(free.activatedWithoutCharge).toBe(true);
    expect((await SubscriptionModel.findOne({ userId }))?.tier).toBe(SubscriptionTier.PRO);
  });
});

describe('subscription checkout reconciliation sweep', () => {
  beforeAll(async () => { await connectTestDatabase(); for (const model of models) await model.init(); });
  beforeEach(async () => { for (const model of models) await model.deleteMany({}); });
  afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

  it('expires a checkout abandoned for a day and returns the coupon seat for reuse', async () => {
    const s = build(); const userId = randomUUID();
    const coupon = await CouponModel.create({ code: `SEAT${randomUUID().slice(0, 6)}`.toUpperCase(), discountType: CouponDiscountType.PERCENT,
      amount: 20, currency: 'GHS', maxRedemptions: 10, perUserLimit: 1 });
    const first = await buy(s, userId, SubscriptionTier.PRO, { couponCode: coupon.code });
    await age(first.checkout.id, 25 * 60 * 60 * 1000);
    expect(await s.sweep.reconcileStale()).toMatchObject({ scanned: 1, expired: 1 });
    expect((await SubscriptionCheckoutModel.findById(first.checkout.id))?.status).toBe('expired');
    expect((await CouponRedemptionModel.findOne({ checkoutId: first.checkout.id }))?.status).toBe('released');
    // The member's single seat is free again.
    await expect(buy(s, userId, SubscriptionTier.PRO, { couponCode: coupon.code })).resolves.toMatchObject({ preview: { discountAmount: expect.any(Number) } });
  });

  it('settles a paid checkout whose webhook never arrived and leaves a recent unpaid one alone', async () => {
    const s = build(); const payer = randomUUID(), browsing = randomUUID();
    const paid = await buy(s, payer);
    const open = await buy(s, browsing);
    s.gateway.statuses.set(paid.reference!, 'success');
    await age(paid.checkout.id, 40 * 60 * 1000);
    await age(open.checkout.id, 40 * 60 * 1000);
    expect(await s.sweep.reconcileStale()).toMatchObject({ scanned: 2, settled: 1, pending: 1 });
    expect((await SubscriptionModel.findOne({ userId: payer }))?.tier).toBe(SubscriptionTier.PRO);
    expect((await SubscriptionCheckoutModel.findById(open.checkout.id))?.status).toBe('pending');
  });

  it('expires a day-old checkout whose charge never opened, and leaves provider errors for the next run', async () => {
    const s = build(); const userId = randomUUID(), other = randomUUID();
    const orphan = await s.checkoutRepo.create({ id: '', userId, tier: SubscriptionTier.PRO, billingCycle: BillingCycle.MONTHLY,
      status: SubscriptionCheckoutStatus.PENDING, baseAmount: 149, discountAmount: 0, finalAmount: 149, currency: 'GHS',
      createdAt: new Date(), updatedAt: new Date() });
    await age(orphan.id, 25 * 60 * 60 * 1000);
    const flaky = await buy(s, other);
    await age(flaky.checkout.id, 25 * 60 * 60 * 1000);
    s.gateway.verifyTransaction.mockImplementation(async (reference: string) => {
      if (reference === flaky.reference) throw new Error('Paystack unreachable');
      return { status: 'abandoned', reference, amount: 0, fees: 0, currency: 'GHS', raw: {} };
    });
    expect(await s.sweep.reconcileStale()).toMatchObject({ scanned: 2, expired: 1, errors: 1 });
    expect((await SubscriptionCheckoutModel.findById(orphan.id))?.status).toBe('expired');
    expect((await SubscriptionCheckoutModel.findById(flaky.checkout.id))?.status).toBe('pending');
  });

  it('still activates a charge Paystack confirms after the checkout expired', async () => {
    const s = build(); const userId = randomUUID();
    const late = await buy(s, userId);
    await age(late.checkout.id, 25 * 60 * 60 * 1000);
    await s.sweep.reconcileStale();
    expect((await SubscriptionCheckoutModel.findById(late.checkout.id))?.status).toBe('expired');
    // The signed charge.success arrives late: money was taken, so access is granted.
    await s.settle.execute((await s.checkoutRepo.findByProviderRef(late.reference!))!, late.reference!);
    expect((await SubscriptionCheckoutModel.findById(late.checkout.id))?.status).toBe('succeeded');
    expect((await SubscriptionModel.findOne({ userId }))?.tier).toBe(SubscriptionTier.PRO);
  });

  it('expires a charge Paystack has kept processing for over a day, but not a recent one', async () => {
    const s = build(); const stuckUser = randomUUID(), recentUser = randomUUID();
    const stuck = await buy(s, stuckUser);
    const recent = await buy(s, recentUser);
    s.gateway.statuses.set(stuck.reference!, 'ongoing');
    s.gateway.statuses.set(recent.reference!, 'ongoing');
    await age(stuck.checkout.id, 25 * 60 * 60 * 1000);
    await age(recent.checkout.id, 2 * 60 * 60 * 1000);
    expect(await s.sweep.reconcileStale()).toMatchObject({ scanned: 2, expired: 1, pending: 1 });
    expect((await SubscriptionCheckoutModel.findById(stuck.checkout.id))?.status).toBe('expired');
    expect((await SubscriptionCheckoutModel.findById(recent.checkout.id))?.status).toBe('pending');
    // The member whose charge was stuck is no longer blocked from buying.
    await expect(buy(s, stuckUser)).resolves.toMatchObject({ authorizationUrl: expect.any(String) });
  });

  it('rotates rows it cannot resolve behind ones it has not visited, so a backlog never starves newer checkouts', async () => {
    const s = build();
    const stuck = [await buy(s, randomUUID()), await buy(s, randomUUID())];
    for (const checkout of stuck) {
      s.gateway.statuses.set(checkout.reference!, 'ongoing');
      await age(checkout.checkout.id, 3 * 60 * 60 * 1000);
    }
    const payer = randomUUID();
    const paid = await buy(s, payer);
    s.gateway.statuses.set(paid.reference!, 'success');
    await age(paid.checkout.id, 60 * 60 * 1000);
    // Oldest first on the first visit: only the two stuck rows fit.
    expect(await s.sweep.reconcileStale({ limit: 2 })).toMatchObject({ scanned: 2, pending: 2 });
    // Next run reaches the newer paid checkout instead of the same two again.
    expect(await s.sweep.reconcileStale({ limit: 2 })).toMatchObject({ scanned: 2, settled: 1, pending: 1 });
    expect((await SubscriptionModel.findOne({ userId: payer }))?.tier).toBe(SubscriptionTier.PRO);
  });

  it('lets the member see an old abandoned checkout as expired when they check it', async () => {
    const s = build(); const userId = randomUUID();
    const old = await buy(s, userId);
    await age(old.checkout.id, 25 * 60 * 60 * 1000);
    expect((await s.status.verify(old.checkout.id, userId)).status).toBe('expired');
  });
});
