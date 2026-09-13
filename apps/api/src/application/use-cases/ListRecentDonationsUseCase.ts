import type { PublicProfileVisibilityPort } from '../../domain/ports/outbound/PublicProfileVisibilityPort.js';
import { isPublicCampaign } from '../../domain/services/campaignVisibility.js';
import { GUEST_DONOR_ID, type DonationEntity } from '../../domain/entities/Donation.js';
import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { PaymentMethod } from '@ubuntu-fund/types';

/** Public, donor-facing view of a donation used by activity/live feeds. */
export interface PublicDonationDTO {
  id: string;
  donorId?: string;
  donorName?: string;
  campaignId: string;
  campaignTitle: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  isAnonymous: boolean;
  createdAt: Date;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class ListRecentDonationsUseCase {
  constructor(
    private readonly donationRepo: DonationRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly userRepo: UserRepositoryPort,
    private readonly visibility: PublicProfileVisibilityPort
  ) {}

  async execute(limit?: number, viewerId?: string): Promise<PublicDonationDTO[]> {
    const requested = limit && limit > 0 ? Math.floor(limit) : DEFAULT_LIMIT;
    const safeLimit = Math.min(requested, MAX_LIMIT);

    const donations = await this.donationRepo.findRecent(safeLimit);
    const hidden = await this.visibility.hiddenContentAuthorIds(donations.map(donation => donation.donorId).filter(id => id !== GUEST_DONOR_ID), viewerId);
    const items = await Promise.all(donations.map((donation) => this.toDTO(donation, hidden.has(donation.donorId))));
    return items.filter((item): item is PublicDonationDTO => item !== null);
  }

  private async toDTO(donation: DonationEntity, hidden: boolean): Promise<PublicDonationDTO | null> {
    const campaign = await this.campaignRepo.findById(donation.campaignId);

    if (!campaign || !isPublicCampaign(campaign.status)) return null;
    return {
      id: donation.id,
      donorId: donation.isAnonymous || hidden || !donation.publicContentApproved ? undefined : donation.donorId,
      donorName: hidden ? undefined : donation.publicDonorName,
      campaignId: donation.campaignId,
      campaignTitle: campaign ? campaign.title : 'Campaign',
      amount: donation.amount.amount,
      currency: donation.amount.currency,
      paymentMethod: donation.paymentMethod,
      isAnonymous: donation.isAnonymous || hidden || !donation.publicContentApproved,
      createdAt: donation.createdAt,
    };
  }
}
