import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { BillingCycle, SubscriptionCheckoutStatus, SubscriptionTier } from '@ubuntu-fund/types';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { SettleSubscriptionUseCase } from '../../src/application/use-cases/SettleSubscriptionUseCase.js';
import { RevokeRefundedSubscriptionUseCase } from '../../src/application/use-cases/RevokeRefundedSubscriptionUseCase.js';
import { HandlePaystackWebhookUseCase } from '../../src/application/use-cases/HandlePaystackWebhookUseCase.js';
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
import { AffiliateModel } from '../../src/infrastructure/database/models/AffiliateModel.js';
import { AffiliateReferralModel } from '../../src/infrastructure/database/models/AffiliateReferralModel.js';
import { AffiliateCommissionModel } from '../../src/infrastructure/database/models/AffiliateCommissionModel.js';
import { AffiliateBalanceModel } from '../../src/infrastructure/database/models/AffiliateBalanceModel.js';

const models = [SubscriptionCheckoutModel, SubscriptionModel, AffiliateModel, AffiliateReferralModel, AffiliateCommissionModel, AffiliateBalanceModel];
const DAY = 86_400_000;

function build() {
  const checkoutRepo = new MongoSubscriptionCheckoutRepository();
  const subscriptionRepo = new MongoSubscriptionRepository();
  const affiliate = new AffiliateCommissionService(new MongoAffiliateRepository(), new MongoAffiliateReferralRepository(),
    new MongoAffiliateCommissionRepository(), new MongoAffiliateBalanceRepository(), { commissionPercent: 10, holdDays: 7 });
  const settle = new SettleSubscriptionUseCase(new MongoUnitOfWork(), checkoutRepo, subscriptionRepo,
    new MongoCouponRepository(), new MongoCouponRedemptionRepository(), affiliate);
  const revoke = new RevokeRefundedSubscriptionUseCase(new MongoUnitOfWork(), checkoutRepo, subscriptionRepo);
  const gateway = { isConfigured: () => true, verifyWebhookSignature: () => true };
  const webhook = new HandlePaystackWebhookUseCase(gateway as never, {} as never, {} as never, {} as never, {} as never, {} as never,
    {} as never, checkoutRepo, settle, {} as never, affiliate, undefined, undefined, undefined, undefined, undefined, revoke);
  const refund = (reference: string, amount?: number) => webhook.execute({ signature: 'signed',
    rawBody: Buffer.from(JSON.stringify({ event: 'refund.processed', data: { transaction_reference: reference, currency: 'GHS', ...(amount ? { amount } : {}) } })) });
  return { checkoutRepo, settle, revoke, refund };
}

async function paid(s: ReturnType<typeof build>, userId: string, tier: string = SubscriptionTier.PRO, finalAmount = 149) {
  const reference = `sub-${randomUUID().slice(0, 8)}`;
  const checkout = await s.checkoutRepo.create({ id: '', userId, tier, billingCycle: BillingCycle.MONTHLY,
    status: SubscriptionCheckoutStatus.PENDING, baseAmount: finalAmount, discountAmount: 0, finalAmount, currency: 'GHS',
    providerRef: reference, createdAt: new Date(), updatedAt: new Date() });
  await s.settle.execute(checkout, reference);
  return reference;
}

describe('refunded web subscription payments', () => {
  beforeAll(async () => { await connectTestDatabase(); for (const model of models) await model.init(); });
  beforeEach(async () => { for (const model of models) await model.deleteMany({}); });
  afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

  it('expires the plan a full refund paid for and reverses the affiliate commission', async () => {
    const s = build(); const userId = randomUUID();
    const affiliate = await AffiliateModel.create({ userId: randomUUID(), referralCode: randomUUID(), commissionRate: 10 });
    await AffiliateReferralModel.create({ referrerId: affiliate.id, refereeId: userId, referralCode: affiliate.referralCode });
    const reference = await paid(s, userId);
    expect((await AffiliateBalanceModel.findOne({ affiliateId: affiliate.id }))?.pendingBalance).toBeCloseTo(14.9);
    await s.refund(reference, 14900);
    const row = (await SubscriptionModel.findOne({ userId }))!;
    expect(row.status).toBe('expired');
    expect(row.currentPeriodEnd.getTime()).toBeLessThanOrEqual(Date.now());
    expect((await AffiliateCommissionModel.findOne({ sourceRef: reference }))?.status).toBe('reversed');
    expect((await AffiliateBalanceModel.findOne({ affiliateId: affiliate.id }))?.pendingBalance).toBe(0);
  });

  it('only takes back the time an early renewal added', async () => {
    const s = build(); const userId = randomUUID();
    await paid(s, userId);
    const firstEnd = (await SubscriptionModel.findOne({ userId }))!.currentPeriodEnd;
    const renewal = await paid(s, userId);
    expect((await SubscriptionModel.findOne({ userId }))!.currentPeriodEnd.getTime()).toBe(firstEnd.getTime() + 30 * DAY);
    expect(await s.revoke.execute({ reference: renewal })).toBe('shortened');
    const row = (await SubscriptionModel.findOne({ userId }))!;
    expect(row.status).toBe('active');
    expect(row.currentPeriodEnd).toEqual(firstEnd);
  });

  it('leaves a newer, different plan alone when an older replaced payment is refunded', async () => {
    const s = build(); const userId = randomUUID();
    const plus = await paid(s, userId, SubscriptionTier.STARTER, 49);
    await paid(s, userId, SubscriptionTier.PRO);
    const before = (await SubscriptionModel.findOne({ userId }))!;
    expect(await s.revoke.execute({ reference: plus })).toBe('ignored');
    const after = (await SubscriptionModel.findOne({ userId }))!;
    expect(after.tier).toBe(SubscriptionTier.PRO);
    expect(after.status).toBe('active');
    expect(after.currentPeriodEnd).toEqual(before.currentPeriodEnd);
  });

  it('is idempotent when the refund event is replayed', async () => {
    const s = build(); const userId = randomUUID();
    const reference = await paid(s, userId);
    await s.refund(reference);
    const once = (await SubscriptionModel.findOne({ userId }))!;
    await s.refund(reference);
    expect(await s.revoke.execute({ reference })).toBe('ignored');
    expect((await SubscriptionModel.findOne({ userId }))!.currentPeriodEnd).toEqual(once.currentPeriodEnd);
  });

  it('keeps access on a partial refund (owner decision pending)', async () => {
    const s = build(); const userId = randomUUID();
    const reference = await paid(s, userId);
    expect(await s.revoke.execute({ reference, refundedMinor: 5000, currency: 'GHS' })).toBe('partial');
    expect((await SubscriptionModel.findOne({ userId }))!.status).toBe('active');
  });
});
