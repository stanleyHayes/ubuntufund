import type { CampaignEntity } from '../../entities/Campaign.js';
export type CampaignReviewAction = 'approve' | 'reject' | 'block' | 'reopen';
export interface ReviewCampaignInput {
  campaignId: string;
  actorId: string;
  authVersion: string;
  expectedVersion: string;
  action: CampaignReviewAction;
  reason: string;
  contentReviewed?: boolean;
  fundraisingReviewed?: boolean;
}
export interface CampaignReviewPort {
  decide(input: ReviewCampaignInput): Promise<CampaignEntity>;
}
