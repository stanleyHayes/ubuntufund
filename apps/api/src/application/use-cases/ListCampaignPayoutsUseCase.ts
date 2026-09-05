import type { Payout } from '@ubuntu-fund/types';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { PayoutRepositoryPort } from '../../domain/ports/outbound/PayoutRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { toPayoutDto } from './mappers/payoutDto.js';
import type { PayoutRequester } from './CreatePayoutRecipientUseCase.js';

/** List a campaign's payouts (owner or admin). */
export class ListCampaignPayoutsUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly payoutRepo: PayoutRepositoryPort
  ) {}

  async execute(
    campaignId: string,
    requester: PayoutRequester
  ): Promise<Payout[]> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const isOwner = campaign.creatorId === requester.userId;
    const isAdmin = requester.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new AppError('Only the campaign owner can view its payouts', 403);
    }

    const payouts = await this.payoutRepo.findByCampaignId(campaignId);
    return payouts.map(toPayoutDto);
  }
}
