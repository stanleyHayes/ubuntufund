import type { Campaign } from '@ubuntu-fund/types';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { CampaignEntity } from '../../domain/entities/Campaign.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export type CampaignReviewAction = 'approve' | 'reject' | 'block';

export interface ReviewCampaignInput {
  campaignId: string;
  action: CampaignReviewAction;
  reason?: string;
}

function toDTO(entity: CampaignEntity): Campaign {
  const plain = entity.toPlain();
  return {
    id: plain.id,
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
  };
}

/**
 * Moderation actions on a campaign's lifecycle. Reuses the existing
 * CampaignEntity guarded transitions (activate()/block()) rather than
 * writing status directly, so invariants enforced by the entity still hold.
 *
 * - approve -> CampaignEntity.activate() (pending_review -> active)
 * - reject / block -> CampaignEntity.block(reason) (-> blocked)
 */
export class ReviewCampaignUseCase {
  constructor(private readonly campaignRepo: CampaignRepositoryPort) {}

  async execute(input: ReviewCampaignInput): Promise<Campaign> {
    const campaign = await this.campaignRepo.findById(input.campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    switch (input.action) {
      case 'approve':
        try {
          campaign.activate();
        } catch (err) {
          throw new AppError(
            err instanceof Error ? err.message : 'Campaign cannot be approved',
            409
          );
        }
        break;
      case 'reject':
      case 'block':
        campaign.block(input.reason);
        break;
      default:
        throw new AppError('Invalid moderation action', 400);
    }

    const updated = await this.campaignRepo.update(campaign);
    return toDTO(updated);
  }
}
