import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { BillingCycle, CouponDiscountType, SubscriptionCheckoutStatus, SubscriptionTier } from '@ubuntu-fund/types';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { SettleSubscriptionUseCase } from '../../src/application/use-cases/SettleSubscriptionUseCase.js';
import { AffiliateCommissionService } from '../../src/application/services/AffiliateCommissionService.js';
import { MongoUnitOfWork } from '../../src/infrastructure/adapters/outbound/persistence/MongoUnitOfWork.js';
import { MongoSubscriptionCheckoutRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoSubscriptionCheckoutRepository.js';
import { MongoSubscriptionRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoSubscriptionRepository.js';
import { MongoCouponRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCouponRepository.js';
import { MongoCouponRedemptionRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCouponRedemptionRepository.js';
import { MongoAffiliateRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliateRepository.js';
import { MongoAffiliateReferralRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliateReferralRepository.js';
import { MongoAffiliateCommissionRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliateCommissionRepository.js';
import { MongoAffiliateBalanceRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliateBalanceRepository.js';
import { SubscriptionCheckoutModel } from '../../src/infrastructure/database/models/SubscriptionCheckoutModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { CouponModel } from '../../src/infrastructure/database/models/CouponModel.js';
import { CouponRedemptionModel } from '../../src/infrastructure/database/models/CouponRedemptionModel.js';
import { AffiliateModel } from '../../src/infrastructure/database/models/AffiliateModel.js';
import { AffiliateReferralModel } from '../../src/infrastructure/database/models/AffiliateReferralModel.js';
import { AffiliateCommissionModel } from '../../src/infrastructure/database/models/AffiliateCommissionModel.js';
import { AffiliateBalanceModel } from '../../src/infrastructure/database/models/AffiliateBalanceModel.js';

const models = [SubscriptionCheckoutModel, SubscriptionModel, CouponModel, CouponRedemptionModel,
  AffiliateModel, AffiliateReferralModel, AffiliateCommissionModel, AffiliateBalanceModel];

function build() {
  const checkoutRepo = new MongoSubscriptionCheckoutRepository();
  const subscriptionRepo = new MongoSubscriptionRepository();
  const couponRepo = new MongoCouponRepository();
  const redemptionRepo = new MongoCouponRedemptionRepository();
  const balanceRepo = new MongoAffiliateBalanceRepository();
  const affiliate = new AffiliateCommissionService(new MongoAffiliateRepository(), new MongoAffiliateReferralRepository(),
    new MongoAffiliateCommissionRepository(), balanceRepo, { commissionPercent: 10, holdDays: 7 });
  return { checkoutRepo, subscriptionRepo, couponRepo, redemptionRepo, balanceRepo,
    settle: new SettleSubscriptionUseCase(new MongoUnitOfWork(), checkoutRepo, subscriptionRepo, couponRepo, redemptionRepo, affiliate) };
}

async function fixture() {
  const userId = randomUUID();
  const coupon = await CouponModel.create({ code: `SAVE-${randomUUID()}`, discountType: CouponDiscountType.PERCENT,
    amount: 10, currency: 'GHS', maxRedemptions: 10 });
  const affiliate = await AffiliateModel.create({ userId: randomUUID(), referralCode: randomUUID(), commissionRate: 10 });
  await AffiliateReferralModel.create({ referrerId: affiliate.id, refereeId: userId, referralCode: affiliate.referralCode });
  const createCheckout = async () => {
    const repository = new MongoSubscriptionCheckoutRepository();
    const reference = `sub_${randomUUID()}`;
    const checkout = await repository.create({ id: '', userId, tier: SubscriptionTier.PRO,
      billingCycle: BillingCycle.MONTHLY, status: SubscriptionCheckoutStatus.PENDING,
      baseAmount: 100, discountAmount: 10, finalAmount: 90, currency: 'GHS',
      couponId: coupon.id, couponCode: coupon.code, providerRef: reference,
      createdAt: new Date(), updatedAt: new Date(),
    });
    await CouponRedemptionModel.create({ couponId: coupon.id, code: coupon.code, userId,
      checkoutId: checkout.id, providerRef: reference, baseAmount: 100, discountAmount: 10, finalAmount: 90, currency: 'GHS' });
    return { checkout, reference };
  };
  return { userId, coupon, affiliate, createCheckout, ...await createCheckout() };
}

describe('atomic subscription settlement recovery', () => {
  beforeAll(async () => {
    await connectTestDatabase();
    for (const model of models) await model.init();
  });
  beforeEach(async () => { for (const model of models) await model.deleteMany({}); });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

  async function assertRolledBack(userId: string, checkoutId: string, couponId: string) {
    expect((await SubscriptionCheckoutModel.findById(checkoutId))?.status).toBe('pending');
    expect(await SubscriptionModel.countDocuments({ userId })).toBe(0);
    expect((await CouponModel.findById(couponId))?.redemptions).toBe(0);
    expect((await CouponRedemptionModel.findOne({ checkoutId }))?.status).toBe('pending');
    expect((await AffiliateReferralModel.findOne({ refereeId: userId }))?.status).toBe('pending');
    expect(await AffiliateCommissionModel.countDocuments()).toBe(0);
    expect(await AffiliateBalanceModel.countDocuments()).toBe(0);
  }

  it.each(['subscription', 'coupon', 'redemption', 'affiliate balance'] as const)
  ('rolls back a failure after the %s write and recovers with a fresh service instance', async (stage) => {
    const f = await fixture();
    const services = build();
    const failAfter = <T extends (...args: never[]) => unknown>(original: T) => async (...args: Parameters<T>) => {
      await original(...args);
      throw new Error(`injected ${stage} failure`);
    };
    if (stage === 'subscription') {
      vi.spyOn(services.subscriptionRepo, 'save').mockImplementation(failAfter(MongoSubscriptionRepository.prototype.save.bind(services.subscriptionRepo)));
    } else if (stage === 'coupon') {
      vi.spyOn(services.couponRepo, 'incrementRedemptionIfUnderLimit').mockImplementation(failAfter(MongoCouponRepository.prototype.incrementRedemptionIfUnderLimit.bind(services.couponRepo)));
    } else if (stage === 'redemption') {
      vi.spyOn(services.redemptionRepo, 'attachSubscription').mockImplementation(failAfter(MongoCouponRedemptionRepository.prototype.attachSubscription.bind(services.redemptionRepo)));
    } else {
      vi.spyOn(services.balanceRepo, 'accrueCommission').mockImplementation(failAfter(MongoAffiliateBalanceRepository.prototype.accrueCommission.bind(services.balanceRepo)));
    }
    await expect(services.settle.execute(f.checkout, f.reference)).rejects.toThrow('injected');
    await assertRolledBack(f.userId, f.checkout.id, f.coupon.id);
    vi.restoreAllMocks();
    const recovered = build();
    expect((await recovered.settle.execute(f.checkout, f.reference))?.status).toBe('succeeded');
    const beforeReplay = await SubscriptionModel.findOne({ userId: f.userId }).lean();
    expect(beforeReplay?.tier).toBe(SubscriptionTier.PRO);
    expect((await CouponModel.findById(f.coupon.id))?.redemptions).toBe(1);
    expect((await AffiliateBalanceModel.findOne({ affiliateId: f.affiliate.id }))?.pendingBalance).toBe(9);
    await recovered.settle.execute(f.checkout, f.reference);
    expect((await SubscriptionModel.findOne({ userId: f.userId }))?.currentPeriodEnd).toEqual(beforeReplay?.currentPeriodEnd);
    expect((await CouponModel.findById(f.coupon.id))?.redemptions).toBe(1);
    expect(await AffiliateCommissionModel.countDocuments()).toBe(1);
    expect((await AffiliateBalanceModel.findOne({ affiliateId: f.affiliate.id }))?.pendingBalance).toBe(9);
  });

  it('commits one activation/coupon/commission for concurrent duplicate deliveries', async () => {
    const f = await fixture();
    const results = await Promise.all(Array.from({ length: 3 }, () => build().settle.execute(f.checkout, f.reference)));
    expect(results.every((r) => r?.status === 'succeeded')).toBe(true);
    expect(await SubscriptionModel.countDocuments({ userId: f.userId })).toBe(1);
    expect((await CouponModel.findById(f.coupon.id))?.redemptions).toBe(1);
    expect(await AffiliateCommissionModel.countDocuments()).toBe(1);
    expect((await AffiliateBalanceModel.findOne({ affiliateId: f.affiliate.id }))?.pendingBalance).toBe(9);
  });

  it('keeps a first-subscription affiliate commission unique across concurrent distinct paid checkouts', async () => {
    const f = await fixture();
    const second = await f.createCheckout();
    await Promise.all([build().settle.execute(f.checkout, f.reference), build().settle.execute(second.checkout, second.reference)]);
    expect(await SubscriptionCheckoutModel.countDocuments({ status: 'succeeded' })).toBe(2);
    expect((await CouponModel.findById(f.coupon.id))?.redemptions).toBe(2);
    expect(await AffiliateCommissionModel.countDocuments()).toBe(1);
    expect((await AffiliateBalanceModel.findOne({ affiliateId: f.affiliate.id }))?.pendingBalance).toBe(9);
  });

  it('rejects a mismatched payment reference before any effects can commit', async () => {
    const f = await fixture();
    await expect(build().settle.execute(f.checkout, 'another-charge')).rejects.toMatchObject({ statusCode: 409 });
    await assertRolledBack(f.userId, f.checkout.id, f.coupon.id);
  });
});
