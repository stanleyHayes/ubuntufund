import type { Affiliate } from '@ubuntu-fund/types';

export interface AffiliateRepositoryPort {
  /** Creates a new affiliate record (one per user; `userId` is unique). */
  create(affiliate: Affiliate): Promise<Affiliate>;
  findById(id: string): Promise<Affiliate | null>;
  /** A user has at most one affiliate record. */
  findByUserId(userId: string): Promise<Affiliate | null>;
  /** Resolve the referrer's affiliate from a referral code at signup. */
  findByReferralCode(referralCode: string): Promise<Affiliate | null>;
  /** Collision check when minting a new referral code. */
  referralCodeExists(referralCode: string): Promise<boolean>;
  /** All affiliates, newest first (admin console). */
  findAll(): Promise<Affiliate[]>;
  /**
   * Replaces an existing affiliate's mutable fields (status, commissionRate,
   * payout recipient). Returns the updated affiliate, or null when no record
   * exists for `affiliate.id`.
   */
  update(affiliate: Affiliate): Promise<Affiliate | null>;
}
