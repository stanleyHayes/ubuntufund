import type { CampaignContentReviewReason, CampaignContentReviewTrigger } from '@ubuntu-fund/types';

/**
 * Why a campaign that already existed now waits for staff. Each occasion is
 * its own alert (the email provider deduplicates by key), so a campaign that
 * comes back to the queue is announced again instead of waiting silently.
 * `ref` identifies the occasion: the accepted or new invitation, or the
 * decision version that returned the campaign to review.
 * `beneficiary_changed` is the organizer's side naming a beneficiary;
 * `beneficiary_reassigned` is staff naming one (both when that leaves the
 * campaign waiting for staff).
 */
export interface ReviewQueueOccasion {
  kind: 'beneficiary_accepted' | 'beneficiary_changed' | 'beneficiary_reassigned' | 'returned_to_review';
  ref: string;
}

export interface CampaignReviewQueueAlert {
  campaignId: string;
  title: string;
  goalAmount: number;
  currency: string;
  tier: number;
  /** Set when the content itself needs a person (new media, no screening consent, flagged or unscreened). */
  contentReviewReason?: CampaignContentReviewReason;
  /** Set when a beneficiary change, not creation, sent the content to a person. */
  contentReviewTrigger?: CampaignContentReviewTrigger;
  /** Absent when the campaign was just created. */
  occasion?: ReviewQueueOccasion;
}

/**
 * Tells the review team a campaign is waiting on them. Called after the change
 * that put it in the queue has committed; implementations never throw.
 */
export interface ReviewQueueAlertPort {
  campaignPendingReview(input: CampaignReviewQueueAlert): Promise<void>;
}
