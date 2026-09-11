import type { CampaignUpdate } from '@ubuntu-fund/types';
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

export class PinCampaignUpdateUseCase {
  constructor(
    private readonly updateRepo: CampaignUpdateRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort
  ) {}

  async execute(
    campaignId: string,
    updateId: string,
    userId: string
  ): Promise<CampaignUpdate> {
    const update = await this.updateRepo.findById(updateId);
    if (!update || update.campaignId !== campaignId) {
      throw new AppError('Campaign update not found', 404);
    }

    // Team members post under their own authorId, so an owner-only check on
    // authorship left the organization unable to moderate its own campaign's
    // updates. The campaign owner can always act, as with comments.
    const campaign = await this.campaignRepo.findById(campaignId);
    if (update.authorId !== userId && campaign?.creatorId !== userId) {
      throw new AppError('You can only pin your own updates', 403);
    }

    if (update.isPinned) {
      update.unpin();
    } else {
      update.pin();
    }
    const saved = await this.updateRepo.update(update);
    return toDTO(saved);
  }
}
