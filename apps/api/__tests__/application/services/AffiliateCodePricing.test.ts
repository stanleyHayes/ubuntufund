import { describe, expect, it, vi } from 'vitest';
import { AffiliateStatus, type Affiliate } from '@ubuntu-fund/types';
import { AffiliateCodePricing } from '../../../src/application/services/AffiliateCodePricing.js';
import type { AffiliateRepositoryPort } from '../../../src/domain/ports/outbound/AffiliateRepositoryPort.js';
import type { AffiliateReferralRepositoryPort } from '../../../src/domain/ports/outbound/AffiliateReferralRepositoryPort.js';

/**
 * One code doing both jobs — discounting for the referee and still crediting
 * the referrer. Most of what matters here is what it refuses to do.
 */

function affiliate(overrides: Partial<Affiliate> = {}): Affiliate {
  return {
    id: 'aff-1',
    userId: 'affiliate-user',
    referralCode: 'ama-gh',
    status: AffiliateStatus.ACTIVE,
    commissionRate: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Affiliate;
}

function build(found: Affiliate | null, percent = 20, existingReferral: unknown = null) {
  const affiliateRepo = {
    findByReferralCode: vi.fn(async () => found),
  } as unknown as AffiliateRepositoryPort;
  const referralRepo = {
    findByRefereeId: vi.fn(async () => existingReferral),
    create: vi.fn(async (r: unknown) => r),
  } as unknown as AffiliateReferralRepositoryPort;
  return {
    pricing: new AffiliateCodePricing(affiliateRepo, referralRepo, percent),
    affiliateRepo,
    referralRepo,
  };
}

describe('quoting an affiliate code', () => {
  it('discounts by the configured percentage', async () => {
    const { pricing } = build(affiliate(), 20);
    await expect(pricing.quote('ama-gh', 'buyer', 200, 'GHS')).resolves.toMatchObject({
      affiliateId: 'aff-1',
      discountAmount: 40,
      finalAmount: 160,
    });
  });

  it('matches a code typed in the coupon box, whatever its case', async () => {
    // Coupons are uppercase and referral codes lowercase; the customer sees one
    // field and types whatever they were given.
    const { pricing, affiliateRepo } = build(affiliate(), 20);
    await pricing.quote('  AMA-GH  ', 'buyer', 200, 'GHS');
    expect(affiliateRepo.findByReferralCode).toHaveBeenCalledWith('ama-gh');
  });

  it('is disabled entirely at zero percent', async () => {
    // The default. An existing deployment must behave exactly as before until
    // someone makes the pricing decision.
    const { pricing, affiliateRepo } = build(affiliate(), 0);
    expect(pricing.enabled).toBe(false);
    await expect(pricing.quote('ama-gh', 'buyer', 200, 'GHS')).resolves.toBeNull();
    expect(affiliateRepo.findByReferralCode).not.toHaveBeenCalled();
  });

  it('returns null for a code belonging to nobody', async () => {
    const { pricing } = build(null, 20);
    await expect(pricing.quote('nope', 'buyer', 200, 'GHS')).resolves.toBeNull();
  });

  it('refuses a suspended affiliate, who would earn nothing from it', async () => {
    // Otherwise the platform funds a discount that credits no one.
    const { pricing } = build(affiliate({ status: AffiliateStatus.SUSPENDED }), 20);
    await expect(pricing.quote('ama-gh', 'buyer', 200, 'GHS')).resolves.toBeNull();
  });

  it('refuses self-referral', async () => {
    // The same guard registration applies; without it an affiliate discounts
    // their own subscription with their own code.
    const { pricing } = build(affiliate({ userId: 'buyer' }), 20);
    await expect(pricing.quote('ama-gh', 'buyer', 200, 'GHS')).resolves.toBeNull();
  });

  it('never discounts more than the price', async () => {
    const { pricing } = build(affiliate(), 150);
    await expect(pricing.quote('ama-gh', 'buyer', 200, 'GHS')).resolves.toMatchObject({
      discountAmount: 200,
      finalAmount: 0,
    });
  });
});

describe('attaching the referral', () => {
  it('creates the link so the affiliate is credited at settlement', async () => {
    const { pricing, referralRepo } = build(affiliate(), 20);
    await pricing.attachReferral('aff-1', 'buyer', 'ama-gh');
    expect(referralRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ referrerId: 'aff-1', refereeId: 'buyer', status: 'pending' })
    );
  });

  it('leaves an existing referrer alone', async () => {
    // A user is referred at most once. Entering a second affiliate's code later
    // still discounts the purchase, but must not steal the first one's credit.
    const { pricing, referralRepo } = build(affiliate(), 20, { id: 'ref-1' });
    await pricing.attachReferral('aff-2', 'buyer', 'kofi-gh');
    expect(referralRepo.create).not.toHaveBeenCalled();
  });

  it('swallows a write failure rather than failing the checkout', async () => {
    // A customer's payment must not fail because an attribution row could not
    // be written.
    const affiliateRepo = { findByReferralCode: vi.fn() } as unknown as AffiliateRepositoryPort;
    const referralRepo = {
      findByRefereeId: vi.fn(async () => null),
      create: vi.fn(async () => {
        throw new Error('mongo is down');
      }),
    } as unknown as AffiliateReferralRepositoryPort;

    const pricing = new AffiliateCodePricing(affiliateRepo, referralRepo, 20);
    await expect(pricing.attachReferral('aff-1', 'buyer', 'ama-gh')).resolves.toBeUndefined();
  });
});
