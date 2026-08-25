import type { ShortLinkView } from '@ubuntu-fund/types';
import type { ShortLinkRepositoryPort } from '../../domain/ports/outbound/ShortLinkRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { toShortLinkView } from './mappers/shortLinkDto.js';
import type { ShortLinkRequester } from './CreateShortLinkUseCase.js';

/**
 * List every short link / QR code created for a campaign (owner or admin only),
 * each enriched with its shareable short URL.
 */
export class ListCampaignQrCodesUseCase {
  constructor(
    private readonly shortLinkRepo: ShortLinkRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly publicApiUrl: string
  ) {}

  async execute(
    campaignId: string,
    requester: ShortLinkRequester
  ): Promise<ShortLinkView[]> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const isOwner = campaign.creatorId === requester.userId;
    const isAdmin = requester.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new AppError(
        "Only the campaign owner can view its QR codes",
        403
      );
    }

    const links = await this.shortLinkRepo.findByCampaignId(campaign.id);
    return links.map((link) => toShortLinkView(link, this.publicApiUrl));
  }
}
