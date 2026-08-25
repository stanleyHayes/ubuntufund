import type { CreateQrCodeInput, ShortLinkView } from '@ubuntu-fund/types';
import { ShortLinkEntity } from '../../domain/entities/ShortLink.js';
import type { ShortLinkRepositoryPort } from '../../domain/ports/outbound/ShortLinkRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { generateUniqueShortCode } from '../utils/shortCode.js';
import { buildShortLinkTarget } from '../utils/shortLinkTarget.js';
import { toShortLinkView } from './mappers/shortLinkDto.js';

export interface ShortLinkRequester {
  userId: string;
  role?: string;
}

/**
 * Create a short link / dynamic QR code for a campaign (owner or admin only).
 * Resolves the destination URL from `PUBLIC_WEB_URL` per the requested kind and
 * returns the persisted short link enriched with its shareable short URL.
 */
export class CreateShortLinkUseCase {
  constructor(
    private readonly shortLinkRepo: ShortLinkRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly publicWebUrl: string,
    private readonly publicApiUrl: string
  ) {}

  async execute(
    campaignId: string,
    input: CreateQrCodeInput,
    requester: ShortLinkRequester
  ): Promise<ShortLinkView> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const isOwner = campaign.creatorId === requester.userId;
    const isAdmin = requester.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new AppError(
        'Only the campaign owner can create QR codes for it',
        403
      );
    }

    if (input.kind === 'amount' && input.presetAmount != null && input.presetAmount <= 0) {
      throw new AppError('presetAmount must be a positive number', 400);
    }

    const target = buildShortLinkTarget(this.publicWebUrl, {
      kind: input.kind,
      campaignRef: campaign.slug || campaign.id,
      creatorId: campaign.creatorId,
      liveSessionId: input.liveSessionId,
      presetAmount: input.presetAmount,
      label: input.label,
    });

    const code = await generateUniqueShortCode((candidate) =>
      this.shortLinkRepo.existsByCode(candidate)
    );

    const shortLink = new ShortLinkEntity({
      id: '', // assigned by the repository
      code,
      campaignId: campaign.id,
      liveSessionId: input.liveSessionId,
      kind: input.kind,
      presetAmount: input.presetAmount,
      label: input.label,
      createdBy: requester.userId,
      target,
      scanCount: 0,
      scans: [],
      createdAt: new Date(),
    });

    const saved = await this.shortLinkRepo.save(shortLink);
    return toShortLinkView(saved, this.publicApiUrl);
  }
}
