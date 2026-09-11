import type { CampaignUpdateRepositoryPort } from '../../domain/ports/outbound/CampaignUpdateRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export class DeleteCampaignUpdateUseCase {
  constructor(
    private readonly updateRepo: CampaignUpdateRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort
  ) {}

  async execute(campaignId: string, id: string, userId: string): Promise<void> {
    const update = await this.updateRepo.findById(id);
    if (!update || update.campaignId !== campaignId) {
      throw new AppError('Campaign update not found', 404);
    }

    // Team members post under their own authorId, so an owner-only check on
    // authorship left the organization unable to moderate its own campaign's
    // updates. The campaign owner can always act, as with comments.
    const campaign = await this.campaignRepo.findById(campaignId);
    if (update.authorId !== userId && campaign?.creatorId !== userId) {
      throw new AppError('You can only delete your own updates', 403);
    }

    await this.updateRepo.delete(id);
  }
}
