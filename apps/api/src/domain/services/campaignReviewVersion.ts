import { createHash } from 'node:crypto';
import type { CampaignEntity } from '../entities/Campaign.js';

/** Public content and approval terms; donation totals deliberately do not invalidate a review. */
export function campaignReviewSnapshot(campaign: CampaignEntity) {
  const p = campaign.toPlain();
  return { id: p.id, creatorId: p.creatorId, revision: p.reviewRevision ?? 0,
    status: p.status, slug: p.slug ?? '', title: p.title, description: p.description,
    category: p.category, priority: p.priority, beneficiaries: p.beneficiaries, imageUrls: p.imageUrls,
    goalAmount: p.goalAmount.amount, currency: p.goalAmount.currency,
    startDate: p.startDate.toISOString(), endDate: p.endDate.toISOString(),
    tier: p.tier ?? null, lockedPlatformFeePercent: p.lockedPlatformFeePercent ?? null };
}
export function campaignReviewVersion(campaign: CampaignEntity): string {
  return createHash('sha256').update(JSON.stringify(campaignReviewSnapshot(campaign))).digest('hex');
}
