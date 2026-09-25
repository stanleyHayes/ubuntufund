/**
 * Money-out eligibility shared by every rail that sends funds to an external
 * account (campaign payouts, creator withdrawals). The same rules are also
 * enforced again inside each rail's reservation transaction.
 */
export interface PayoutEligibilityPort {
  /**
   * Throws 409 unless the account holder has current, approved identity (or,
   * for an organization, business) verification: an approval with a future
   * expiry that no newer submission has superseded.
   */
  assertOwnerVerified(userId: string, message?: string): Promise<void>;
  /**
   * Throws 409 unless the campaign may currently pay out: it exists, is not
   * deleted, is live/funded/ended (not draft, under review or blocked) and has
   * no open or under-review dispute.
   */
  assertCampaignPayable(campaignId: string): Promise<void>;
}
