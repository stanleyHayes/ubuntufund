import type { ShareRepositoryPort } from '../../domain/ports/outbound/ShareRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import { isPublicCampaign } from '../../domain/services/campaignVisibility.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface ShareCampaignInput {
  campaignId: string;
  platform?: string;
}

export class ShareCampaignUseCase {
  constructor(private readonly shareRepo: ShareRepositoryPort, private readonly campaignRepo?: Pick<CampaignRepositoryPort, 'findById'>) {}

  async execute(input: ShareCampaignInput, userId: string): Promise<void> {
    // Only real, public campaigns can be shared; anything else would record
    // shares against ids that do not exist or that visitors cannot open.
    if (!/^[a-f0-9]{24}$/i.test(input.campaignId)) throw new AppError('Campaign not found', 404);
    if (this.campaignRepo) {
      const campaign = await this.campaignRepo.findById(input.campaignId);
      if (!campaign || !isPublicCampaign(campaign.status)) throw new AppError('Campaign not found', 404);
    }
    await this.shareRepo.save({
      id: '',
      campaignId: input.campaignId,
      userId,
      platform: input.platform,
      createdAt: new Date(),
    });
  }
}
