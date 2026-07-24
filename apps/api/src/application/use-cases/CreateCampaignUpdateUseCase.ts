import type { CampaignUpdate, CreateCampaignUpdateInput } from '@ubuntu-fund/types';
import { CampaignUpdateEntity } from '../../domain/entities/CampaignUpdate.js';
import type { CampaignUpdateRepositoryPort } from '../../domain/ports/outbound/CampaignUpdateRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
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

export class CreateCampaignUpdateUseCase {
  constructor(
    private readonly updateRepo: CampaignUpdateRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort
  ) {}

  async execute(
    campaignId: string,
    input: CreateCampaignUpdateInput,
    authorId: string
  ): Promise<CampaignUpdate> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.creatorId !== authorId) {
      throw new AppError('Only the campaign creator can post updates', 403);
    }

    if (!input.title || !input.content) {
      throw new AppError('Title and content are required', 400);
    }

    const now = new Date();
    const update = new CampaignUpdateEntity({
      id: '', // Will be assigned by the repository
      campaignId,
      authorId,
      title: input.title,
      content: input.content,
      type: input.type,
      mediaUrls: input.mediaUrls ?? [],
      isPinned: input.isPinned ?? false,
      createdAt: now,
      updatedAt: now,
    });

    const saved = await this.updateRepo.save(update);
    return toDTO(saved);
  }
}
