import { PaymentMethod } from '@ubuntu-fund/types';
import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** Single-donation detail view, e.g. for the refund-request flow. */
export interface DonationDetailDTO {
  id: string;
  campaignId: string;
  campaignName: string;
  donorId: string;
  amount: number;
  currency: string;
  date: Date;
  paymentMethod: PaymentMethod;
  message?: string;
  isAnonymous: boolean;
  createdAt: Date;
}

export class GetDonationUseCase {
  constructor(
    private readonly donationRepo: DonationRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort
  ) {}

  async execute(
    donationId: string,
    requestingUserId: string
  ): Promise<DonationDetailDTO> {
    const donation = await this.donationRepo.findById(donationId);

    // Same 404-for-both-cases pattern as WalletController: don't leak
    // whether a donation exists to a user who doesn't own it.
    if (!donation || donation.donorId !== requestingUserId) {
      throw new AppError('Donation not found', 404);
    }

    const campaign = await this.campaignRepo.findById(donation.campaignId);

    return {
      id: donation.id,
      campaignId: donation.campaignId,
      campaignName: campaign ? campaign.title : 'Campaign',
      donorId: donation.donorId,
      amount: donation.amount.amount,
      currency: donation.amount.currency,
      date: donation.createdAt,
      paymentMethod: PaymentMethod.WALLET,
      message: donation.message,
      isAnonymous: donation.isAnonymous,
      createdAt: donation.createdAt,
    };
  }
}
