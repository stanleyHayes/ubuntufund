import type { ShareRepositoryPort } from '../../domain/ports/outbound/ShareRepositoryPort.js';

export interface ShareCampaignInput {
  campaignId: string;
  platform?: string;
}

export class ShareCampaignUseCase {
  constructor(private readonly shareRepo: ShareRepositoryPort) {}

  async execute(input: ShareCampaignInput, userId: string): Promise<void> {
    await this.shareRepo.save({
      id: '',
      campaignId: input.campaignId,
      userId,
      platform: input.platform,
      createdAt: new Date(),
    });
  }
}
