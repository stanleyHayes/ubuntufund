import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { BillingCycle, CouponCommissionBase, CouponDiscountType, SubscriptionCheckoutStatus, SubscriptionTier } from '@ubuntu-fund/types';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { DeleteCouponUseCase } from '../../src/application/use-cases/DeleteCouponUseCase.js';
import { SettleSubscriptionUseCase } from '../../src/application/use-cases/SettleSubscriptionUseCase.js';
import { AffiliateCommissionService } from '../../src/application/services/AffiliateCommissionService.js';
import { MongoUnitOfWork } from '../../src/infrastructure/adapters/outbound/persistence/MongoUnitOfWork.js';
import { MongoCouponRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCouponRepository.js';
import { MongoCouponRedemptionRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCouponRedemptionRepository.js';
import { MongoSubscriptionCheckoutRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoSubscriptionCheckoutRepository.js';
import { MongoSubscriptionRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoSubscriptionRepository.js';
import { MongoAffiliateRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliateRepository.js';
import { MongoAffiliateReferralRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliateReferralRepository.js';
import { MongoAffiliateCommissionRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliateCommissionRepository.js';
import { MongoAffiliateBalanceRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliateBalanceRepository.js';
import { CouponModel } from '../../src/infrastructure/database/models/CouponModel.js';
import { CouponRedemptionModel } from '../../src/infrastructure/database/models/CouponRedemptionModel.js';
import { SubscriptionCheckoutModel } from '../../src/infrastructure/database/models/SubscriptionCheckoutModel.js';
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js';
import { AffiliateModel } from '../../src/infrastructure/database/models/AffiliateModel.js';
import { AffiliateReferralModel } from '../../src/infrastructure/database/models/AffiliateReferralModel.js';
import { AffiliateCommissionModel } from '../../src/infrastructure/database/models/AffiliateCommissionModel.js';

const models = [CouponModel, CouponRedemptionModel, SubscriptionCheckoutModel, SubscriptionModel, AffiliateModel, AffiliateReferralModel, AffiliateCommissionModel];
const newCoupon = (over: Record<string, unknown> = {}) => CouponModel.create({ code: `C${randomUUID().slice(0, 8)}`.toUpperCase(),
  discountType: CouponDiscountType.PERCENT, amount: 50, currency: 'GHS', maxRedemptions: 10, ...over });

describe('coupon deletion and commission basis', () => {
  beforeAll(async () => { await connectTestDatabase(); for (const model of models) await model.init(); });
  beforeEach(async () => { for (const model of models) await model.deleteMany({}); });
  afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

  const remove = () => new DeleteCouponUseCase(new MongoCouponRepository(), new MongoCouponRedemptionRepository());

  it('deletes an unused coupon but refuses one that was redeemed or is held by an open checkout', async () => {
    const unused = await newCoupon();
    await remove().execute(unused.id);
    expect(await CouponModel.exists({ _id: unused._id })).toBeNull();

    const counted = await newCoupon({ redemptions: 1 });
    await expect(remove().execute(counted.id)).rejects.toMatchObject({ statusCode: 409, message: expect.stringMatching(/deactivate it instead/) });

    const held = await newCoupon();
    await CouponRedemptionModel.create({ couponId: held.id, code: held.code, userId: randomUUID(), checkoutId: randomUUID(),
      baseAmount: 100, discountAmount: 50, finalAmount: 50, currency: 'GHS' });
    await expect(remove().execute(held.id)).rejects.toMatchObject({ statusCode: 409 });
    expect(await CouponModel.countDocuments()).toBe(2);
  });

  async function settleWith(commissionBase: CouponCommissionBase | undefined, deleteCoupon: boolean) {
    const userId = randomUUID();
    const coupon = await newCoupon({ commissionBase: CouponCommissionBase.LIST_PRICE });
    const affiliate = await AffiliateModel.create({ userId: randomUUID(), referralCode: randomUUID(), commissionRate: 10 });
    await AffiliateReferralModel.create({ referrerId: affiliate.id, refereeId: userId, referralCode: affiliate.referralCode });
    const checkoutRepo = new MongoSubscriptionCheckoutRepository();
    const reference = `sub-${randomUUID().slice(0, 8)}`;
    const checkout = await checkoutRepo.create({ id: '', userId, tier: SubscriptionTier.PRO, billingCycle: BillingCycle.MONTHLY,
      status: SubscriptionCheckoutStatus.PENDING, baseAmount: 100, discountAmount: 50, finalAmount: 50, currency: 'GHS',
      couponId: coupon.id, couponCode: coupon.code, commissionBase, providerRef: reference, createdAt: new Date(), updatedAt: new Date() });
    if (deleteCoupon) await CouponModel.deleteOne({ _id: coupon._id }); // e.g. deleted before this fix
    const settle = new SettleSubscriptionUseCase(new MongoUnitOfWork(), checkoutRepo, new MongoSubscriptionRepository(),
      new MongoCouponRepository(), new MongoCouponRedemptionRepository(), new AffiliateCommissionService(new MongoAffiliateRepository(),
        new MongoAffiliateReferralRepository(), new MongoAffiliateCommissionRepository(), new MongoAffiliateBalanceRepository(),
        { commissionPercent: 10, holdDays: 7 }));
    await settle.execute(checkout, reference);
    return { userId, commission: await AffiliateCommissionModel.findOne({ sourceRef: reference }) };
  }

  it('pays a LIST_PRICE commission from the checkout snapshot even when the coupon is gone', async () => {
    const { userId, commission } = await settleWith(CouponCommissionBase.LIST_PRICE, true);
    expect(commission?.baseAmount).toBe(100);
    expect(commission?.amount).toBe(10);
    expect((await SubscriptionModel.findOne({ userId }))?.tier).toBe(SubscriptionTier.PRO);
  });

  it('still activates a paid plan whose legacy coupon (no snapshot) was deleted', async () => {
    const { userId, commission } = await settleWith(undefined, true);
    expect((await SubscriptionModel.findOne({ userId }))?.tier).toBe(SubscriptionTier.PRO);
    expect(commission?.baseAmount).toBe(50);
  });

  it('falls back to the live coupon for checkouts created before the snapshot existed', async () => {
    const { commission } = await settleWith(undefined, false);
    expect(commission?.baseAmount).toBe(100);
  });
});
