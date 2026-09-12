import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoCommercialConfigRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCommercialConfigRepository.js';
import {
  CommercialConfigService,
  AFFILIATE_REFERRAL_DISCOUNT_KEY,
} from '../../src/application/services/CommercialConfigService.js';
import { CommercialConfigModel } from '../../src/infrastructure/database/models/CommercialConfigModel.js';
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js';
import type { PayoutsConfig } from '../../src/infrastructure/config/index.js';

/**
 * Built here rather than imported: pulling in the real config module requires
 * JWT_SECRET and the rest of the app's environment, which this has no use for.
 */
const PAYOUTS: PayoutsConfig = {
  priorityFeePercent: 0.5,
  priorityMinFee: 10,
  earlyFeePercent: 1,
  earlyMinFee: 20,
  urgentFeePercent: 2,
  urgentMinFee: 40,
  assistedFeePercent: 1,
  assistedFixedFee: 15,
  earlyMaxWithdrawalPercent: 60,
  maxTransferAmount: 50_000,
  dualApprovalAmount: 20_000,
};

/**
 * The referral discount is a live pricing lever. It has to be settable from the
 * admin dashboard, take effect without a deploy, and keep the audit trail the
 * versioned store exists to provide.
 */

let service: CommercialConfigService;

beforeAll(async () => {
  await connectTestDatabase();
  service = new CommercialConfigService(
    new MongoCommercialConfigRepository(),
    PAYOUTS,
    { commissionPercent: 10, holdDays: 14, referralDiscountPercent: 10 }
  );
});

afterAll(async () => {
  await dropTestDatabase();
  await disconnectTestDatabase();
});

beforeEach(async () => {
  await CommercialConfigModel.deleteMany({});
});

describe('the admin-controlled referral discount', () => {
  it('falls back to the env default when nothing has been set', async () => {
    expect(await service.resolveReferralDiscountPercent()).toBe(10);
  });

  it('takes the admin value once set, with no restart', async () => {
    await service.setValue(AFFILIATE_REFERRAL_DISCOUNT_KEY, 15, 'admin-1', new Date());
    expect(await service.resolveReferralDiscountPercent()).toBe(15);
  });

  it('can be switched off with zero, rather than only lowered', async () => {
    // Zero is the off switch for the whole behaviour, so it must survive the
    // falsy-value trap that would otherwise fall back to the default.
    await service.setValue(AFFILIATE_REFERRAL_DISCOUNT_KEY, 0, 'admin-1', new Date());
    expect(await service.resolveReferralDiscountPercent()).toBe(0);
  });

  it('is accepted as a known key, so the admin route will not reject it', async () => {
    expect(service.isKnownKey(AFFILIATE_REFERRAL_DISCOUNT_KEY)).toBe(true);
    expect(service.allKeys).toContain(AFFILIATE_REFERRAL_DISCOUNT_KEY);
    // And an unknown key is still refused.
    expect(service.isKnownKey('affiliate.somethingElse')).toBe(false);
  });

  it('does not disturb the payouts config it shares a store with', async () => {
    await service.setValue(AFFILIATE_REFERRAL_DISCOUNT_KEY, 25, 'admin-1', new Date());
    const payouts = await service.resolvePayoutsConfig();
    expect(payouts.earlyFeePercent).toBe(PAYOUTS.earlyFeePercent);
  });

  it('keeps every change as history, which is the audit trail', async () => {
    await service.setValue(AFFILIATE_REFERRAL_DISCOUNT_KEY, 10, 'admin-1', new Date(), 'launch');
    await service.setValue(AFFILIATE_REFERRAL_DISCOUNT_KEY, 20, 'admin-2', new Date(), 'push');

    const history = await service.history(AFFILIATE_REFERRAL_DISCOUNT_KEY);
    expect(history.length).toBe(2);
    expect(history.map((h) => h.createdBy)).toContain('admin-2');
  });

  it('honours a rate scheduled to start later only once it is effective', async () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    await service.setValue(AFFILIATE_REFERRAL_DISCOUNT_KEY, 50, 'admin-1', tomorrow);
    expect(
      await service.resolveReferralDiscountPercent(),
      'a future-dated rate must not apply today'
    ).toBe(10);
  });
});
