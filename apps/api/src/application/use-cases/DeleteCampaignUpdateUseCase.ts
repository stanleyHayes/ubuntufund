import type { CampaignUpdateRepositoryPort } from '../../domain/ports/outbound/CampaignUpdateRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export class DeleteCampaignUpdateUseCase {
  constructor(private readonly updateRepo: CampaignUpdateRepositoryPort) {}

  async execute(campaignId: string, id: string, userId: string): Promise<void> {
    const update = await this.updateRepo.findById(id);
    if (!update || update.campaignId !== campaignId) {
      throw new AppError('Campaign update not found', 404);
    }

    if (update.authorId !== userId) {
      throw new AppError('You can only delete your own updates', 403);
    }

    await this.updateRepo.delete(id);
  }
}
