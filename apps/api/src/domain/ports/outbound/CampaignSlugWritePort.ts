import type { CampaignEntity } from '../../entities/Campaign.js';

/** A change of a campaign's web address (its vanity slug). */
export interface CampaignSlugChange {
  actorId: string;
  /**
   * The actor's credential version: the request's (`req.authVersion`), or on
   * an approval the author's current one. Re-checked inside the transaction.
   */
  authVersion: string;
  campaignId: string;
  /** The address the change was proposed against ('' when the campaign had none). */
  expectedSlug: string;
  /** The new address, already normalized (slugify). */
  slug: string;
  /** The approval (publication review) that publishes it; absent for the author's own request. */
  reviewId?: string;
  /**
   * The author's own request: consumes the approval of this exact version,
   * first in the transaction (after the account checks), so a version that
   * was published meanwhile is refused as already published. Rolled back
   * with the transaction.
   */
  consumeApproval?: () => Promise<void>;
  /**
   * Publishing on approval: records the publication last in the transaction,
   * right after the change and its audit (PublicationApplyContext.publish).
   */
  recordPublication?: () => Promise<void>;
}

/**
 * Changes a campaign's web address in one transaction with every check of
 * the author's request: the publisher fence (account open with the same
 * credential version, current agreement, no publishing restriction), the
 * campaign (not deleted), the actor's permission (its owner, or currently a
 * platform administrator), the address (valid, not reserved, not held now or
 * before by another campaign), and a compare-and-set on the address it was
 * proposed against. The old address is kept, so existing links keep working.
 *
 * Refusals are AppErrors with a code: `item_unavailable`, `permission_changed`,
 * `address_taken` or `stale_version`, besides the publisher fence's own codes.
 * Used by the author's request and by publishing on approval.
 */
export interface CampaignSlugWritePort {
  write(change: CampaignSlugChange): Promise<CampaignEntity>;
}
