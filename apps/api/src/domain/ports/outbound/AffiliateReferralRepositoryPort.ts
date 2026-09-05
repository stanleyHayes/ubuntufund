import type { AffiliateReferral } from '@ubuntu-fund/types';

export interface AffiliateReferralRepositoryPort {
  /** Link a referred signup to its referrer (one per referee; `refereeId` is unique). */
  create(referral: AffiliateReferral): Promise<AffiliateReferral>;
  /** A user is referred at most once. */
  findByRefereeId(refereeId: string): Promise<AffiliateReferral | null>;
  findByReferrerId(referrerId: string): Promise<AffiliateReferral[]>;
  countByReferrerId(referrerId: string): Promise<number>;

  /**
   * Atomically move the referee's referral pending → converted, stamping
   * `convertedAt`. Returns the updated referral, or null when it was no longer
   * pending (already converted, or no referral for this referee). This is the
   * exactly-once gate that guards one-time affiliate commission accrual.
   */
  markConverted(refereeId: string): Promise<AffiliateReferral | null>;
}
