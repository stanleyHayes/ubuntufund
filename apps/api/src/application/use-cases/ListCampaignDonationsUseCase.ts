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

    // Callers validate these (parsePagination); clamp anyway so a direct caller
    // can never ask the database for a negative skip or an unbounded page.
    const page = Math.max(1, Math.floor(params.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)));

    // Page in the database: loading every donation to slice one page out made
    // each request (and the admin console's page-by-page walk) cost the whole set.
    const { items: pageItems, total } = await this.donationRepo.findPageByCampaignId(
      campaignId,
      (page - 1) * pageSize,
      pageSize
    );

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
