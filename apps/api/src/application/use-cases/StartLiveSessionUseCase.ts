import type { LiveSession, StartLiveSessionInput } from '@ubuntu-fund/types';
import { LiveSessionEntity } from '../../domain/entities/LiveSession.js';
import type { LiveSessionRepositoryPort } from '../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { generateOverlayToken } from '../utils/overlayToken.js';
import { toLiveSessionDto } from './mappers/liveSessionDto.js';

export interface LiveSessionRequester {
  userId: string;
  role?: string;
}

/**
 * Start a live fundraising session for a campaign (owner or admin only). Mints
 * a fresh overlay token and returns the full owner DTO (token included).
 */
export class StartLiveSessionUseCase {
  constructor(
    private readonly liveSessionRepo: LiveSessionRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort
  ) {}

  async execute(
    campaignId: string,
    input: StartLiveSessionInput,
    requester: LiveSessionRequester
  ): Promise<LiveSession> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const isOwner = campaign.creatorId === requester.userId;
    const isAdmin = requester.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new AppError(
        'Only the campaign owner can start a live session',
        403
      );
    }

    if (input.targetAmount != null && input.targetAmount <= 0) {
      throw new AppError('targetAmount must be a positive number', 400);
    }

    const session = new LiveSessionEntity({
      id: '', // assigned by the repository
      campaignId: campaign.id,
      title: input.title,
      targetAmount: input.targetAmount,
      status: 'active',
      overlayToken: generateOverlayToken(),
      showDonorNames: input.showDonorNames ?? true,
      showDonorMessages: input.showDonorMessages ?? true,
      showAmounts: input.showAmounts ?? true,
      privacyMode: input.privacyMode ?? false,
      startedAt: new Date(),
      stats: {
        scans: 0,
        checkoutStarts: 0,
        successfulDonations: 0,
        amountRaised: 0,
      },
    });

    const saved = await this.liveSessionRepo.save(session);
    return toLiveSessionDto(saved);
  }
}
