import { describe, expect, it, vi } from 'vitest';
import {
  BillingCycle,
  CouponCommissionBase,
  CouponDiscountType,
  CouponSurface,
} from '@ubuntu-fund/types';
import { CouponEntity, type CouponProps } from '../../../src/domain/entities/Coupon.js';
import { CouponService } from '../../../src/application/services/CouponService.js';
import type { CouponRepositoryPort } from '../../../src/domain/ports/outbound/CouponRepositoryPort.js';
import type { CouponRedemptionRepositoryPort } from '../../../src/domain/ports/outbound/CouponRedemptionRepositoryPort.js';
import type { CouponEligibilityPort } from '../../../src/domain/ports/outbound/CouponEligibilityPort.js';

/**
 * The targeting rules, at the seam that both the checkout and the preview go
 * through. They live in the service rather than at either call site precisely
 * so the two cannot disagree — a preview that says a coupon applies, followed
 * by a checkout that refuses it, is the worst version of this bug.
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

function build(
  c: CouponEntity,
  eligibility: Partial<CouponEligibilityPort> = {},
  usedByUser = 0
) {
  const couponRepo = { findByCode: vi.fn(async () => c) } as unknown as CouponRepositoryPort;
  const redemptionRepo = {
    countByCouponAndUser: vi.fn(async () => usedByUser),
  } as unknown as CouponRedemptionRepositoryPort;
  const elig: CouponEligibilityPort = {
    emailFor: vi.fn(async () => 'ama@example.com'),
    hasPaidBefore: vi.fn(async () => false),
    ...eligibility,
  };
  return {
    service: new CouponService(couponRepo, redemptionRepo, elig),
    elig,
    price: (userId = 'user-1') =>
      new CouponService(couponRepo, redemptionRepo, elig).validateAndPrice({
        code: 'launch50',
        tier: 'pro',
        billingCycle: BillingCycle.MONTHLY,
        userId,
        baseAmount: 200,
      }),
  };
}

describe('newUsersOnly', () => {
  it('admits a customer who has never paid', async () => {
    const { price } = build(coupon({ newUsersOnly: true }), {
      hasPaidBefore: vi.fn(async () => false),
    });
    await expect(price()).resolves.toMatchObject({ discountAmount: 100, finalAmount: 100 });
  });

  it('refuses a customer who has paid before', async () => {
    const { price } = build(coupon({ newUsersOnly: true }), {
      hasPaidBefore: vi.fn(async () => true),
    });
    await expect(price()).rejects.toThrow(/first-time subscribers only/i);
  });

  it('does not ask about payment history when the coupon is open to everyone', async () => {
    // The query costs a round trip; an unrestricted coupon should not pay it.
    const { price, elig } = build(coupon({ newUsersOnly: false }), {
      hasPaidBefore: vi.fn(async () => true),
    });
    await price();
    expect(elig.hasPaidBefore).not.toHaveBeenCalled();
  });
});

describe('allowedEmails', () => {
  it('admits a named recipient', async () => {
    const { price } = build(coupon({ allowedEmails: ['ama@example.com'] }));
    await expect(price()).resolves.toMatchObject({ discountAmount: 100 });
  });

  it('refuses anyone not on the list', async () => {
    const { price } = build(coupon({ allowedEmails: ['ama@example.com'] }), {
      emailFor: vi.fn(async () => 'kofi@example.com'),
    });
    await expect(price()).rejects.toThrow(/not available on your account/i);
  });

  it('refuses when the email cannot be resolved, rather than letting it through', async () => {
    const { price } = build(coupon({ allowedEmails: ['ama@example.com'] }), {
      emailFor: vi.fn(async () => null),
    });
    await expect(price()).rejects.toThrow(/not available on your account/i);
  });

  it('does not look up an email when there is no list', async () => {
    const { price, elig } = build(coupon({ allowedEmails: [] }));
    await price();
    expect(elig.emailFor).not.toHaveBeenCalled();
  });
});

describe('pricing through the service', () => {
  it('applies the percentage ceiling to the quoted price', async () => {
    const { price } = build(coupon({ amount: 50, maxDiscountAmount: 30 }));
    await expect(price()).resolves.toMatchObject({
      baseAmount: 200,
      discountAmount: 30,
      finalAmount: 170,
    });
  });

  it('still enforces the per-user limit before quoting', async () => {
    const { price } = build(coupon({ perUserLimit: 1 }), {}, 1);
    await expect(price()).rejects.toThrow(/maximum number of times/i);
  });

  it('rejects an expired coupon', async () => {
    const { price } = build(coupon({ validUntil: new Date('2020-01-01') }));
    await expect(price()).rejects.toThrow(/expired/i);
  });
});

describe('surface gating', () => {
  function priceOn(c: CouponEntity, surface?: CouponSurface) {
    const couponRepo = { findByCode: vi.fn(async () => c) } as never;
    const redemptionRepo = { countByCouponAndUser: vi.fn(async () => 0) } as never;
    const elig: CouponEligibilityPort = {
      emailFor: vi.fn(async () => 'ama@example.com'),
      hasPaidBefore: vi.fn(async () => false),
    };
    return new CouponService(couponRepo, redemptionRepo, elig).validateAndPrice({
      code: 'launch50',
      tier: 'pro',
      billingCycle: BillingCycle.MONTHLY,
      userId: 'user-1',
      baseAmount: 200,
      surface,
    });
  }

  it('defaults to the subscription surface when the caller names none', async () => {
    await expect(priceOn(coupon({ appliesToSurfaces: [] }))).resolves.toMatchObject({
      discountAmount: 100,
    });
  });

  it('refuses a payout-only coupon at subscription checkout', async () => {
    await expect(
      priceOn(coupon({ appliesToSurfaces: [CouponSurface.PAYOUT_FEE] }))
    ).rejects.toThrow(/cannot be used here/i);
  });

  it('refuses a subscription coupon on the payout-fee surface', async () => {
    // The pre-surfaces default has to hold in both directions, or an old
    // coupon becomes redeemable somewhere it was never meant for.
    await expect(
      priceOn(coupon({ appliesToSurfaces: [] }), CouponSurface.PAYOUT_FEE)
    ).rejects.toThrow(/cannot be used here/i);
  });

  it('admits a coupon scoped to the surface being used', async () => {
    await expect(
      priceOn(
        coupon({ appliesToSurfaces: [CouponSurface.PAYOUT_FEE] }),
        CouponSurface.PAYOUT_FEE
      )
    ).resolves.toMatchObject({ discountAmount: 100 });
  });
});
