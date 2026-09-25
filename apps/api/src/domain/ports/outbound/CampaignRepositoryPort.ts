import type { CampaignEntity } from '../../entities/Campaign.js';
import type { CampaignCategory, CampaignStatus, PaginationParams } from '@ubuntu-fund/types';

/**
 * A listing filter on a campaign's *effective* state. ACTIVE and FUNDED only
 * match campaigns that are still open (end date in the future); EXPIRED also
 * matches ACTIVE/FUNDED campaigns whose end date has passed but which the
 * expiry sweep has not re-labelled yet. `open` is ACTIVE or FUNDED and open.
 */
export type CampaignListStatus = CampaignStatus | 'open';

/** Sort keys the listing accepts; anything else is rejected at the edge. */
export const CAMPAIGN_LIST_SORT_FIELDS = ['createdAt', 'raisedAmount', 'endDate', 'fundedPercent'] as const;
export type CampaignListSortField = (typeof CAMPAIGN_LIST_SORT_FIELDS)[number];

export interface CampaignListQuery extends Omit<PaginationParams, 'sortBy'> {
  sortBy?: CampaignListSortField;
  includeNonPublic?: boolean;
  status?: CampaignListStatus;
  category?: CampaignCategory;
  /** Case-insensitive title search; plain text, never a pattern. */
  q?: string;
}

export interface CampaignRepositoryPort {
  save(campaign: CampaignEntity): Promise<CampaignEntity>;
  findById(id: string): Promise<CampaignEntity | null>;
  findBySlug(slug: string): Promise<CampaignEntity | null>;
  findAll(params: CampaignListQuery): Promise<{ items: CampaignEntity[]; total: number }>;
  findByCreatorId(creatorId: string): Promise<CampaignEntity[]>;
  /** Change only the slug; stale replacements cannot overwrite financial state. */
  setSlug(id: string, expectedSlug: string, slug: string): Promise<CampaignEntity | null>;
  update(campaign: CampaignEntity): Promise<CampaignEntity>;
  delete(id: string): Promise<void>;
  countByCreatorId(creatorId: string): Promise<number>;
  /**
   * Count a creator's campaigns that occupy an "active" slot for plan-limit
   * purposes: pending_review, active or funded campaigns whose end date is
   * still in the future, excluding soft-deleted ones. A campaign whose end date
   * has passed frees its slot at once, whether or not the expiry sweep has
   * re-labelled it EXPIRED yet.
   */
  countActiveByCreator(creatorId: string): Promise<number>;
  /**
   * Re-label ACTIVE/FUNDED campaigns whose end date is at or before `now` as
   * EXPIRED. Idempotent; returns how many campaigns changed.
   */
  expireEnded(now: Date): Promise<number>;
  /**
   * Atomically add to raisedAmount, only while the campaign is active,
   * unexpired, and in the same currency. Returns the updated campaign or null
   * when the campaign cannot accept the donation.
   */
  incrementRaised(campaignId: string, amount: number, currency: string): Promise<CampaignEntity | null>;

  /**
   * Atomically reduce raisedAmount by `amount` for a refund reversal (spec §14).
   * Unlike {@link incrementRaised} this does NOT require the campaign to be
   * active/unexpired — a refund must claw back the raised total even on a funded
   * or ended campaign. Clamps at zero; returns the updated campaign, or null when
   * no matching campaign (id + currency) exists.
   */
  reverseRaised(campaignId: string, amount: number, currency: string): Promise<CampaignEntity | null>;
}
