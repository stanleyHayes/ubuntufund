import type { DonationEntity } from '../../domain/entities/Donation.js';
import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';

/** Public, donor-facing view of a donation used by activity/live feeds. */
export interface PublicDonationDTO {
  id: string;
  donorId: string;
  donorName?: string;
  campaignId: string;
  campaignTitle: string;
  amount: number;
  currency: string;
  isAnonymous: boolean;
  createdAt: Date;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class ListRecentDonationsUseCase {
  constructor(
    private readonly donationRepo: DonationRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly userRepo: UserRepositoryPort
  ) {}

  async execute(limit?: number): Promise<PublicDonationDTO[]> {
    const requested = limit && limit > 0 ? Math.floor(limit) : DEFAULT_LIMIT;
    const safeLimit = Math.min(requested, MAX_LIMIT);

    const donations = await this.donationRepo.findRecent(safeLimit);
    return Promise.all(donations.map((donation) => this.toDTO(donation)));
  }

  private async toDTO(donation: DonationEntity): Promise<PublicDonationDTO> {
    const [campaign, donor] = await Promise.all([
      this.campaignRepo.findById(donation.campaignId),
      donation.isAnonymous
        ? Promise.resolve(null)
        : this.userRepo.findById(donation.donorId),
    ]);

    return {
      id: donation.id,
      donorId: donation.donorId,
      donorName: donor ? donor.name : undefined,
      campaignId: donation.campaignId,
      campaignTitle: campaign ? campaign.title : 'Campaign',
      amount: donation.amount.amount,
      currency: donation.amount.currency,
      isAnonymous: donation.isAnonymous,
      createdAt: donation.createdAt,
    };
  }
}
