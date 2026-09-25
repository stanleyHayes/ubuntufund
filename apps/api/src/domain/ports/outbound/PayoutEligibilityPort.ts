/**
 * Money-out eligibility shared by every rail that sends funds to an external
 * account (campaign payouts, creator withdrawals). The same rules are also
 * enforced again inside each rail's reservation transaction.
 */
export interface PayoutEligibilityPort {
  /**
   * Throws 409 unless the account holder has a verified email and current,
   * approved identity (or, for an organization, business) verification: an
   * approval with a future expiry that no newer submission has superseded.
   * An unverified email fails with `emailMessage`, never the identity message.
   */
  assertOwnerVerified(userId: string, message?: string, emailMessage?: string): Promise<void>;
  /**
   * Throws 409 unless the campaign may currently pay out: it exists, is not
   * deleted, is live/funded/ended (not draft, under review or blocked) and has
   * no open or under-review dispute.
   */
  assertCampaignPayable(campaignId: string): Promise<void>;
  /**
   * The legal name (organization: registered business name) on the account
   * holder's current identity approval, or undefined when there is none or it
   * holds no name. Used to spot payouts to accounts held by someone else.
   */
  verifiedLegalName?(userId: string): Promise<string | undefined>;
}
