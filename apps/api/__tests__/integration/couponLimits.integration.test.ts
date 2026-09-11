import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CouponDiscountType, CouponRedemptionStatus, BillingCycle } from '@ubuntu-fund/types';
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
 * Coupon limits against a real mongod.
 *
 * These caps are the whole point of a promotion — "first 50 signups", "one per
 * customer" — and both were previously untested. The per-user one was also
 * unenforceable: it counted redemptions and then inserted, which two
 * simultaneous checkouts both pass. Unit tests cannot show that; only
 * concurrent writes against the actual indexes can.
 */

const couponRepo = new MongoCouponRepository();
const redemptionRepo = new MongoCouponRedemptionRepository();

beforeAll(async () => {
  await connectTestDatabase();
  // The per-user cap is enforced by a unique index, so the index must exist
  // before any of this means anything. Mongoose builds them lazily otherwise.
  await CouponRedemptionModel.syncIndexes();
});

afterAll(async () => {
  await dropTestDatabase();
  await disconnectTestDatabase();
});

beforeEach(async () => {
  await CouponModel.deleteMany({});
  await CouponRedemptionModel.deleteMany({});
});

async function seedCoupon(overrides: Record<string, unknown> = {}) {
  const doc = await CouponModel.create({
    code: 'LAUNCH50',
    discountType: CouponDiscountType.PERCENT,
    amount: 50,
    currency: 'GHS',
    redemptions: 0,
    appliesToTiers: [],
    appliesToBillingCycles: [],
    active: true,
    ...overrides,
  });
  return doc._id!.toString();
}

function slot(couponId: string, userId: string, providerRef?: string) {
  return {
    id: '',
    couponId,
    code: 'LAUNCH50',
    userId,
    tier: 'pro',
    billingCycle: BillingCycle.MONTHLY,
    status: CouponRedemptionStatus.PENDING,
    baseAmount: 100,
    discountAmount: 50,
    finalAmount: 50,
    currency: 'GHS',
    providerRef,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('global redemption cap', () => {
  it('lets exactly maxRedemptions through when every claim races the others', async () => {
    // "First 50 signups" is the case this exists for. Fire 60 increments at
    // once: a read-then-write counter oversells here; the $inc with the cap
    // folded into the filter does not.
    const couponId = await seedCoupon({ maxRedemptions: 50 });

    const results = await Promise.all(
      Array.from({ length: 60 }, () => couponRepo.incrementRedemptionIfUnderLimit(couponId))
    );

    expect(results.filter(Boolean)).toHaveLength(50);
    const after = await CouponModel.findById(couponId);
    expect(after!.redemptions).toBe(50);
  });

  it('never blocks a coupon with no cap', async () => {
    const couponId = await seedCoupon({ maxRedemptions: 0 });
    const results = await Promise.all(
      Array.from({ length: 20 }, () => couponRepo.incrementRedemptionIfUnderLimit(couponId))
    );
    expect(results.filter(Boolean)).toHaveLength(20);
  });
});

describe('per-user redemption cap', () => {
  it('admits one seat per user when two checkouts are submitted together', async () => {
    // The original defect. Both requests count zero prior redemptions, both
    // decide there is room, and both insert. The unique seat index is what
    // makes the second one lose.
    const couponId = await seedCoupon({ perUserLimit: 1 });

    const [a, b] = await Promise.all([
      redemptionRepo.createWithSeat(slot(couponId, 'user-1'), 1),
      redemptionRepo.createWithSeat(slot(couponId, 'user-1'), 1),
    ]);

    const granted = [a, b].filter(Boolean);
    expect(granted).toHaveLength(1);
    expect(await CouponRedemptionModel.countDocuments({ couponId, userId: 'user-1' })).toBe(1);
  });

  it('admits exactly perUserLimit seats under heavier contention', async () => {
    const couponId = await seedCoupon({ perUserLimit: 3 });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => redemptionRepo.createWithSeat(slot(couponId, 'user-1'), 3))
    );

    expect(results.filter(Boolean)).toHaveLength(3);
    // Seats are distinct ordinals, not three copies of seat 0.
    const seats = results.filter(Boolean).map((r) => r!.seat).sort();
    expect(seats).toEqual([0, 1, 2]);
  });

  it('caps each user separately', async () => {
    const couponId = await seedCoupon({ perUserLimit: 1 });
    expect(await redemptionRepo.createWithSeat(slot(couponId, 'user-1'), 1)).not.toBeNull();
    expect(await redemptionRepo.createWithSeat(slot(couponId, 'user-2'), 1)).not.toBeNull();
    expect(await redemptionRepo.createWithSeat(slot(couponId, 'user-1'), 1)).toBeNull();
  });

  it('assigns no seat, and imposes no cap, when the coupon has no per-user limit', async () => {
    // An uncapped coupon must not be silently limited to one row per user by
    // the same unique index — hence the partial filter on `seat` existing.
    const couponId = await seedCoupon({ perUserLimit: undefined });
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        redemptionRepo.createWithSeat(slot(couponId, 'user-1'), undefined)
      )
    );
    expect(results.filter(Boolean)).toHaveLength(5);
    expect(results[0]!.seat).toBeUndefined();
  });
});

describe('releasing a slot', () => {
  it('returns the seat to the pool so a failed payment can be retried', async () => {
    // Before this, markReleased was never called from anywhere: a declined card
    // left the slot PENDING, PENDING counts against the cap, and the customer
    // could never use the coupon again.
    const couponId = await seedCoupon({ perUserLimit: 1 });

    const first = await redemptionRepo.createWithSeat(slot(couponId, 'user-1'), 1);
    expect(first).not.toBeNull();
    expect(await redemptionRepo.createWithSeat(slot(couponId, 'user-1'), 1)).toBeNull();

    await redemptionRepo.markReleased(first!.id);

    const retry = await redemptionRepo.createWithSeat(slot(couponId, 'user-1'), 1);
    expect(retry, 'the released seat must be reclaimable').not.toBeNull();
  });

  it('clears the ordinal, so the unique index no longer holds it', async () => {
    const couponId = await seedCoupon({ perUserLimit: 2 });
    const first = await redemptionRepo.createWithSeat(slot(couponId, 'user-1'), 2);

    const released = await redemptionRepo.markReleased(first!.id);

    expect(released!.status).toBe(CouponRedemptionStatus.RELEASED);
    expect(released!.seat).toBeUndefined();
  });

  it('does not release a slot that has already settled', async () => {
    // markReleased is PENDING-only. A consumed redemption is money that moved;
    // freeing its seat would hand the customer a second discount.
    const couponId = await seedCoupon({ perUserLimit: 1 });
    const first = await redemptionRepo.createWithSeat(slot(couponId, 'user-1'), 1);
    await redemptionRepo.markConsumed(first!.id);

    expect(await redemptionRepo.markReleased(first!.id)).toBeNull();
    expect(await redemptionRepo.createWithSeat(slot(couponId, 'user-1'), 1)).toBeNull();
  });

  it('excludes released slots from the seat count but keeps consumed ones', async () => {
    const couponId = await seedCoupon({ perUserLimit: 5 });
    const a = await redemptionRepo.createWithSeat(slot(couponId, 'user-1'), 5);
    const b = await redemptionRepo.createWithSeat(slot(couponId, 'user-1'), 5);
    await redemptionRepo.markConsumed(a!.id);
    await redemptionRepo.markReleased(b!.id);

    expect(await redemptionRepo.countByCouponAndUser(couponId, 'user-1')).toBe(1);
  });
});

describe('settling a slot', () => {
  it('consumes a slot at most once, however many times the webhook replays', async () => {
    const couponId = await seedCoupon();
    const first = await redemptionRepo.createWithSeat(slot(couponId, 'user-1'), undefined);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => redemptionRepo.markConsumed(first!.id))
    );

    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
