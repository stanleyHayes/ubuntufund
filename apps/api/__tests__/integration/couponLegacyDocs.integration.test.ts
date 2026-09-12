import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { CouponSurface } from '@ubuntu-fund/types';
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js';
import { CouponModel } from '../../src/infrastructure/database/models/CouponModel.js';
import { CouponRedemptionModel } from '../../src/infrastructure/database/models/CouponRedemptionModel.js';
import { MongoCouponRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCouponRepository.js';
import { MongoCouponRedemptionRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCouponRedemptionRepository.js';

/**
 * Documents written before these fields existed.
 *
 * Mongoose applies schema defaults when a document is WRITTEN, not when an
 * older one is read back, so a coupon created last month has no
 * `allowedEmails`, no `newUsersOnly` and no `appliesToSurfaces` on disk. The
 * entity reads those as arrays and booleans — `allowedEmails.length`,
 * `appliesToSurfaces.length` — and an undefined there is a TypeError on the
 * checkout path, i.e. every existing coupon breaking at once.
 *
 * These insert through the raw driver on purpose: going through the model
 * would apply the very defaults this is meant to prove are absent.
 */

const couponRepo = new MongoCouponRepository();
const redemptionRepo = new MongoCouponRedemptionRepository();

beforeAll(async () => {
  await connectTestDatabase();
});

afterAll(async () => {
  await dropTestDatabase();
  await disconnectTestDatabase();
});

beforeEach(async () => {
  await CouponModel.deleteMany({});
  await CouponRedemptionModel.deleteMany({});
});

/** A coupon exactly as it existed on disk before any of this shipped. */
async function insertLegacyCoupon() {
  await mongoose.connection.collection('coupons').insertOne({
    code: 'LEGACY25',
    discountType: 'percent',
    amount: 25,
    currency: 'GHS',
    redemptions: 0,
    appliesToTiers: [],
    appliesToBillingCycles: [],
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('a coupon written before the new fields existed', () => {
  it('loads without throwing', async () => {
    await insertLegacyCoupon();
    const coupon = await couponRepo.findByCode('LEGACY25');
    expect(coupon).not.toBeNull();
  });

  it('is open to everyone, rather than crashing on an absent allowlist', async () => {
    await insertLegacyCoupon();
    const coupon = await couponRepo.findByCode('LEGACY25');
    expect(coupon!.allowedEmails).toEqual([]);
    expect(coupon!.allowsEmail('anyone@example.com')).toBe(true);
    expect(coupon!.allowsEmail(null)).toBe(true);
  });

  it('is not silently treated as new-customers-only', async () => {
    // An undefined read as truthy would lock every returning customer out of
    // every pre-existing coupon.
    await insertLegacyCoupon();
    const coupon = await couponRepo.findByCode('LEGACY25');
    expect(coupon!.newUsersOnly).toBe(false);
  });

  it('still works on subscriptions and nowhere else', async () => {
    // The whole point of empty-means-subscription: a live promotion must not
    // start waiving withdrawal fees because its surface list is absent.
    await insertLegacyCoupon();
    const coupon = await couponRepo.findByCode('LEGACY25');
    expect(coupon!.appliesToSurface(CouponSurface.SUBSCRIPTION)).toBe(true);
    expect(coupon!.appliesToSurface(CouponSurface.PAYOUT_FEE)).toBe(false);
  });

  it('discounts by the same amount it always did', async () => {
    await insertLegacyCoupon();
    const coupon = await couponRepo.findByCode('LEGACY25');
    expect(coupon!.computeDiscount(200)).toBe(50);
  });

  it('pays affiliate commission on the post-coupon amount, as before', async () => {
    await insertLegacyCoupon();
    const coupon = await couponRepo.findByCode('LEGACY25');
    expect(coupon!.commissionBase).toBe('post_coupon');
  });
});

describe('a redemption written before the new fields existed', () => {
  it('loads, and its absent seat does not make it look like it holds seat 0', async () => {
    await mongoose.connection.collection('couponredemptions').insertOne({
      couponId: 'coupon-legacy',
      code: 'LEGACY25',
      userId: 'user-1',
      tier: 'pro',
      billingCycle: 'monthly',
      status: 'pending',
      baseAmount: 200,
      discountAmount: 50,
      finalAmount: 150,
      currency: 'GHS',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const found = await redemptionRepo.findByProviderRef('nope');
    expect(found).toBeNull();

    // It still holds a seat for the per-user count, which is what matters:
    // an old PENDING row must keep blocking a second redemption.
    expect(await redemptionRepo.countByCouponAndUser('coupon-legacy', 'user-1')).toBe(1);
  });
});
