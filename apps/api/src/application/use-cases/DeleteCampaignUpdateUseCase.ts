import type { CampaignUpdateRepositoryPort } from '../../domain/ports/outbound/CampaignUpdateRepositoryPort.js';

export class DeleteCampaignUpdateUseCase {
  constructor(private readonly updateRepo: CampaignUpdateRepositoryPort) {}

  async execute(id: string, userId: string): Promise<void> {
    const update = await this.updateRepo.findById(id);
    if (!update) {
      throw new Error('Campaign update not found');
    }

    if (update.authorId !== userId) {
      throw new Error('You can only delete your own updates');
    }

    await this.updateRepo.delete(id);
  }
}
