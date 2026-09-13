import type { PublicProfileVisibilityPort } from '../../domain/ports/outbound/PublicProfileVisibilityPort.js';
import { isPublicCampaign } from '../../domain/services/campaignVisibility.js';
import type {
  CampaignDonation,
  PaginatedResponse,
  PaginationParams,
} from '@ubuntu-fund/types';
import { GUEST_DONOR_ID, type DonationEntity } from '../../domain/entities/Donation.js';
import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export class ListCampaignDonationsUseCase {
  constructor(
    private readonly donationRepo: DonationRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly userRepo: UserRepositoryPort,
    private readonly visibility: PublicProfileVisibilityPort
  ) {}

  async execute(
    campaignId: string,
    params: PaginationParams,
    viewerId?: string,
    isAdmin = false
  ): Promise<PaginatedResponse<CampaignDonation>> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign || (!isPublicCampaign(campaign.status) && campaign.creatorId !== viewerId && !isAdmin)) {
      throw new AppError('Campaign not found', 404);
    }

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const all = await this.donationRepo.findByCampaignId(campaignId);
    const total = all.length;
    const start = (page - 1) * pageSize;
    const pageItems = all.slice(start, start + pageSize);

    const hidden = await this.visibility.hiddenContentAuthorIds(pageItems.map(donation => donation.donorId).filter(id => id !== GUEST_DONOR_ID), viewerId);
    const items = await Promise.all(
      pageItems.map((donation) => this.toDTO(donation, hidden.has(donation.donorId)))
    );

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private async toDTO(donation: DonationEntity, hidden: boolean): Promise<CampaignDonation> {
    return {
      id: donation.id,
      donorName: hidden ? 'Anonymous' : donation.publicDonorName ?? 'Anonymous',
      donorAvatarUrl: undefined,
      amount: donation.amount.amount,
      currency: donation.amount.currency,
      paymentMethod: donation.paymentMethod,
      message: hidden ? undefined : donation.publicMessage,
      isAnonymous: donation.isAnonymous || hidden || !donation.publicContentApproved,
      createdAt: donation.createdAt,
    };
  }
}
