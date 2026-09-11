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

  /**
   * Set a chosen referral code. Separate from `update` because the code is an
   * identifier that resolves signups — it must only ever change through this
   * deliberate path, never as a side effect of saving other fields. Returns null
   * when no record matches, or when the unique index rejects a taken code.
   */
  updateReferralCode(affiliateId: string, referralCode: string): Promise<Affiliate | null>;
}
