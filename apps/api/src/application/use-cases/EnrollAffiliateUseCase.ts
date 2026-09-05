import { AffiliateStatus, type Affiliate } from '@ubuntu-fund/types';
import type { AffiliateRepositoryPort } from '../../domain/ports/outbound/AffiliateRepositoryPort.js';
import type { AffiliateBalanceRepositoryPort } from '../../domain/ports/outbound/AffiliateBalanceRepositoryPort.js';
import { generateUniqueShortCode } from '../utils/shortCode.js';

/** The platform's only settlement currency. */
const CURRENCY = 'GHS';

/**
 * Enroll the current user in the affiliate/referral program: mint a unique
 * lowercase short referral code and ensure a (zeroed) balance read model exists.
 * Idempotent — a user already enrolled simply gets their existing record back
 * (a user has at most one affiliate record; `userId` is unique).
 *
 * The new affiliate carries a zero per-affiliate `commissionRate` so commission
 * accrual falls back to the platform default rate until an admin sets one.
 */
export class EnrollAffiliateUseCase {
  constructor(
    private readonly affiliateRepo: AffiliateRepositoryPort,
    private readonly affiliateBalanceRepo: AffiliateBalanceRepositoryPort
  ) {}

  async execute(userId: string): Promise<Affiliate> {
    const existing = await this.affiliateRepo.findByUserId(userId);
    if (existing) {
      // Idempotent: guarantee the balance row exists, then return the record.
      await this.affiliateBalanceRepo.ensure(existing.id, CURRENCY);
      return existing;
    }

    // Codes are stored lowercased (case-stable in `?ref=` URLs) and unique.
    const referralCode = await generateUniqueShortCode((candidate) =>
      this.affiliateRepo.referralCodeExists(candidate)
    );

    const now = new Date();
    const affiliate = await this.affiliateRepo.create({
      id: '', // assigned by the repository
      userId,
      referralCode,
      status: AffiliateStatus.ACTIVE,
      commissionRate: 0, // 0 ⇒ use the platform default rate
      createdAt: now,
      updatedAt: now,
    });

    // Ensure a zeroed balance read model so later bucket moves have a target.
    await this.affiliateBalanceRepo.ensure(affiliate.id, CURRENCY);

    return affiliate;
  }
}
