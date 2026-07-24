import { PaymentMethod } from '@ubuntu-fund/types';
import type {
  CampaignDonation,
  PaginatedResponse,
  PaginationParams,
} from '@ubuntu-fund/types';
import type { DonationEntity } from '../../domain/entities/Donation.js';
import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export class ListCampaignDonationsUseCase {
  constructor(
    private readonly donationRepo: DonationRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly userRepo: UserRepositoryPort
  ) {}

  async execute(
    campaignId: string,
    params: PaginationParams
  ): Promise<PaginatedResponse<CampaignDonation>> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const all = await this.donationRepo.findByCampaignId(campaignId);
    const total = all.length;
    const start = (page - 1) * pageSize;
    const pageItems = all.slice(start, start + pageSize);

    const items = await Promise.all(
      pageItems.map((donation) => this.toDTO(donation))
    );

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private async toDTO(donation: DonationEntity): Promise<CampaignDonation> {
    const donor = donation.isAnonymous
      ? null
      : await this.userRepo.findById(donation.donorId);

    return {
      id: donation.id,
      donorName: donor ? donor.name : 'Anonymous',
      donorAvatarUrl: donor?.avatarUrl,
      amount: donation.amount.amount,
      currency: donation.amount.currency,
      paymentMethod: PaymentMethod.WALLET,
      message: donation.message,
      isAnonymous: donation.isAnonymous,
      createdAt: donation.createdAt,
    };
  }
}
