import type { CampaignUpdate } from '@ubuntu-fund/types';
import { CampaignStatus } from '@ubuntu-fund/types';
import type { PublicProfileVisibilityPort } from '../../domain/ports/outbound/PublicProfileVisibilityPort.js';
import type { CampaignUpdateRepositoryPort } from '../../domain/ports/outbound/CampaignUpdateRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { CampaignUpdateEntity } from '../../domain/entities/CampaignUpdate.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

function toDTO(entity: CampaignUpdateEntity): CampaignUpdate {
  const plain = entity.toPlain();
  return {
    id: plain.id,
    campaignId: plain.campaignId,
    authorId: plain.authorId,
    title: plain.title,
    content: plain.content,
    type: plain.type,
    mediaUrls: plain.mediaUrls,
    isPinned: plain.isPinned,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

export class GetCampaignUpdatesUseCase {
  constructor(
    private readonly updateRepo: CampaignUpdateRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly visibility: PublicProfileVisibilityPort
  ) {}

  async execute(campaignId: string, viewerId?: string, isAdmin = false): Promise<CampaignUpdate[]> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }
    if (![CampaignStatus.ACTIVE, CampaignStatus.FUNDED, CampaignStatus.EXPIRED].includes(campaign.status) && campaign.creatorId !== viewerId && !isAdmin) throw new AppError('Campaign not found', 404);

    const updates = await this.updateRepo.findByCampaignId(campaignId);
    const excluded = await this.visibility.hiddenContentAuthorIds(updates.map(update => update.authorId), viewerId);
    return updates.filter(update => !excluded.has(update.authorId)).map(toDTO);
  }
}
