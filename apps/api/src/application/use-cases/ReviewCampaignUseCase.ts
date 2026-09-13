import type { Campaign } from '@ubuntu-fund/types';
import type { CampaignEntity } from '../../domain/entities/Campaign.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export type { CampaignReviewAction, ReviewCampaignInput } from '../../domain/ports/outbound/CampaignReviewPort.js';
import type { CampaignReviewPort, ReviewCampaignInput } from '../../domain/ports/outbound/CampaignReviewPort.js';
import { campaignReviewVersion } from '../../domain/services/campaignReviewVersion.js';

function toDTO(entity: CampaignEntity): Campaign {
  const plain = entity.toPlain();
  return {
    id: plain.id,
    reviewVersion: campaignReviewVersion(entity),
    slug: plain.slug || undefined,
    title: plain.title,
    description: plain.description,
    goalAmount: plain.goalAmount.amount,
    raisedAmount: plain.raisedAmount.amount,
    currency: plain.goalAmount.currency,
    category: plain.category,
    priority: plain.priority,
    status: plain.status,
    creatorId: plain.creatorId,
    beneficiaries: plain.beneficiaries,
    imageUrls: plain.imageUrls,
    startDate: plain.startDate,
    endDate: plain.endDate,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    tier: plain.tier,
  };
}

/** Decisions and immutable evidence commit together through the review port. */
export class ReviewCampaignUseCase {
  constructor(private readonly reviews: CampaignReviewPort) {}
  async execute(input: ReviewCampaignInput): Promise<Campaign> {
    if (!input.actorId || !/^[a-f0-9]{64}$/.test(input.expectedVersion) || input.reason.trim().length < 20 || input.reason.length > 2000 || !['approve', 'reject', 'block', 'reopen'].includes(input.action)) throw new AppError('Provide the reviewed version and at least 20 characters of decision notes', 400);
    return toDTO(await this.reviews.decide({ ...input, reason: input.reason.trim() }));
  }
}
