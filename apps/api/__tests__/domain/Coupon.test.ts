import { describe, expect, it } from 'vitest';
import { CouponCommissionBase, CouponDiscountType, CouponSurface } from '@ubuntu-fund/types';
import { BillingCycle } from '@ubuntu-fund/types';
import { CouponEntity, type CouponProps } from '../../src/domain/entities/Coupon.js';

/**
 * The coupon entity had no tests at all, which for the code that decides how
 * much of a charge to forgive is the gap worth closing first. These cover the
 * invariants a bad admin input would otherwise turn into a wrong charge.
 */

function coupon(overrides: Partial<CouponProps> = {}): CouponEntity {
  return new CouponEntity({
    id: 'coupon-1',
    code: 'LAUNCH50',
    discountType: CouponDiscountType.PERCENT,
    amount: 50,
    currency: 'GHS',
    redemptions: 0,
    appliesToTiers: [],
    appliesToBillingCycles: [],
    appliesToSurfaces: [],
    commissionBase: CouponCommissionBase.POST_COUPON,
    newUsersOnly: false,
    allowedEmails: [],
    active: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  });
}

describe('CouponEntity invariants', () => {
  it('refuses a non-positive amount', () => {
    // A zero or negative coupon is not a discount, it is a corrupted record —
    // and a negative one would *raise* the charge.
    expect(() => coupon({ amount: 0 })).toThrow(/greater than zero/i);
    expect(() => coupon({ amount: -10 })).toThrow(/greater than zero/i);
  });

  it('refuses a percentage above 100', () => {
    expect(() => coupon({ discountType: CouponDiscountType.PERCENT, amount: 101 })).toThrow(
      /cannot exceed 100/i
    );
  });

  it('allows a fixed amount larger than 100, which is not a percentage', () => {
    expect(() => coupon({ discountType: CouponDiscountType.FIXED, amount: 500 })).not.toThrow();
  });
});

describe('computeDiscount', () => {
  it('takes the stated percentage of the base', () => {
    expect(coupon({ amount: 25 }).computeDiscount(200)).toBe(50);
  });

  it('takes the stated amount off, for a fixed coupon', () => {
    expect(
      coupon({ discountType: CouponDiscountType.FIXED, amount: 30 }).computeDiscount(200)
    ).toBe(30);
  });

  it('never discounts more than the base, so the charge cannot go negative', () => {
    // A GHS 500 fixed coupon against a GHS 120 plan must collapse to 120, not
    // hand the customer 380 back.
    const c = coupon({ discountType: CouponDiscountType.FIXED, amount: 500 });
    expect(c.computeDiscount(120)).toBe(120);
  });

  it('rounds to the currency, not to a hardcoded two places', () => {
    // 33% of 100 is 33.333…; GHS has two minor digits.
    expect(coupon({ amount: 33 }).computeDiscount(100)).toBe(33);
    expect(coupon({ amount: 33 }).computeDiscount(10)).toBe(3.3);
  });

  it('zeroes the charge at 100%', () => {
    expect(coupon({ amount: 100 }).computeDiscount(240)).toBe(240);
  });
});

describe('isActiveNow', () => {
  const inside = new Date('2026-06-15T12:00:00Z');

  it('is false when the coupon is flagged inactive, whatever the window says', () => {
    expect(coupon({ active: false }).isActiveNow(inside)).toBe(false);
  });

  it('is false before validFrom and after validUntil, true between', () => {
    const c = coupon({
      validFrom: new Date('2026-06-01T00:00:00Z'),
      validUntil: new Date('2026-06-30T23:59:59.999Z'),
    });
    expect(c.isActiveNow(new Date('2026-05-31T23:59:59Z'))).toBe(false);
    expect(c.isActiveNow(inside)).toBe(true);
    expect(c.isActiveNow(new Date('2026-07-01T00:00:00Z'))).toBe(false);
  });

  it('treats a missing bound as open-ended', () => {
    expect(coupon({ validUntil: undefined }).isActiveNow(new Date('2099-01-01'))).toBe(true);
    expect(coupon({ validFrom: undefined }).isActiveNow(new Date('1999-01-01'))).toBe(true);
  });
});

describe('scoping', () => {
  it('an empty list means every tier and every cycle', () => {
    expect(coupon().appliesTo('pro', BillingCycle.MONTHLY)).toBe(true);
    expect(coupon().appliesTo('enterprise', BillingCycle.YEARLY)).toBe(true);
  });

  it('a populated list excludes everything outside it', () => {
    const c = coupon({
      appliesToTiers: ['pro'],
      appliesToBillingCycles: [BillingCycle.YEARLY],
    });
    expect(c.appliesTo('pro', BillingCycle.YEARLY)).toBe(true);
    expect(c.appliesTo('starter', BillingCycle.YEARLY)).toBe(false);
    expect(c.appliesTo('pro', BillingCycle.MONTHLY)).toBe(false);
  });
});

describe('limits', () => {
  it('treats a falsy cap as unlimited', () => {
    expect(coupon({ maxRedemptions: undefined, redemptions: 9999 }).isUnderGlobalLimit()).toBe(true);
    expect(coupon({ maxRedemptions: 0, redemptions: 9999 }).isUnderGlobalLimit()).toBe(true);
  });

  it('closes exactly at the cap, not one past it', () => {
    // The "first 50 signups" case: the 50th redemption must be allowed and the
    // 51st refused.
    expect(coupon({ maxRedemptions: 50, redemptions: 49 }).isUnderGlobalLimit()).toBe(true);
    expect(coupon({ maxRedemptions: 50, redemptions: 50 }).isUnderGlobalLimit()).toBe(false);
  });

  it('meets a minimum subtotal at the boundary', () => {
    const c = coupon({ minSubtotal: 100 });
    expect(c.meetsMinSubtotal(99.99)).toBe(false);
    expect(c.meetsMinSubtotal(100)).toBe(true);
  });

  it('treats a falsy minimum as no floor', () => {
    expect(coupon({ minSubtotal: undefined }).meetsMinSubtotal(0)).toBe(true);
  });
});

describe('maxDiscountAmount', () => {
  it('caps a percentage at the ceiling', () => {
    // "30% off" is cheap on a starter plan and expensive on an enterprise
    // annual one; the ceiling is what stops the second case.
    const c = coupon({ amount: 30, maxDiscountAmount: 50 });
    expect(c.computeDiscount(100)).toBe(30);
    expect(c.computeDiscount(1000)).toBe(50);
  });

  it('is ignored for a fixed coupon, whose amount is already its own cap', () => {
    const c = coupon({
      discountType: CouponDiscountType.FIXED,
      amount: 80,
      maxDiscountAmount: 50,
    });
    expect(c.computeDiscount(1000)).toBe(80);
  });

  it('still cannot discount more than the base', () => {
    const c = coupon({ amount: 100, maxDiscountAmount: 500 });
    expect(c.computeDiscount(60)).toBe(60);
  });

  it('treats a falsy ceiling as no ceiling', () => {
    expect(coupon({ amount: 30, maxDiscountAmount: 0 }).computeDiscount(1000)).toBe(300);
    expect(coupon({ amount: 30, maxDiscountAmount: undefined }).computeDiscount(1000)).toBe(300);
  });

  it('refuses a negative ceiling', () => {
    expect(() => coupon({ maxDiscountAmount: -1 })).toThrow(/cannot be negative/i);
  });
});

describe('allowedEmails', () => {
  it('is open to everyone when the list is empty', () => {
    expect(coupon({ allowedEmails: [] }).allowsEmail('anyone@example.com')).toBe(true);
    expect(coupon({ allowedEmails: [] }).allowsEmail(null)).toBe(true);
  });

  it('admits only the named recipients, ignoring case and padding', () => {
    const c = coupon({ allowedEmails: ['ama@example.com'] });
    expect(c.allowsEmail('ama@example.com')).toBe(true);
    expect(c.allowsEmail('  AMA@Example.COM ')).toBe(true);
    expect(c.allowsEmail('kofi@example.com')).toBe(false);
  });

  it('fails closed when the email cannot be resolved', () => {
    // Treating an unknown email as allowed would turn a coupon meant for one
    // person into a public one the moment a lookup fails.
    expect(coupon({ allowedEmails: ['ama@example.com'] }).allowsEmail(null)).toBe(false);
  });
});

describe('appliesToSurface', () => {
  it('treats an empty list as subscription-only, not as every surface', () => {
    // Every coupon created before surfaces existed has an empty list. Reading
    // that as "all surfaces" would silently turn live subscription promotions
    // into donation-fee waivers the moment this shipped.
    const c = coupon({ appliesToSurfaces: [] });
    expect(c.appliesToSurface(CouponSurface.SUBSCRIPTION)).toBe(true);
    expect(c.appliesToSurface(CouponSurface.DONATION)).toBe(false);
    expect(c.appliesToSurface(CouponSurface.PAYOUT_FEE)).toBe(false);
  });

  it('admits exactly the surfaces it was given', () => {
    const c = coupon({
      appliesToSurfaces: [CouponSurface.DONATION, CouponSurface.PAYOUT_FEE],
    });
    expect(c.appliesToSurface(CouponSurface.DONATION)).toBe(true);
    expect(c.appliesToSurface(CouponSurface.PAYOUT_FEE)).toBe(true);
    // Naming other surfaces takes subscription away, which is the point of an
    // explicit list.
    expect(c.appliesToSurface(CouponSurface.SUBSCRIPTION)).toBe(false);
  });
});
