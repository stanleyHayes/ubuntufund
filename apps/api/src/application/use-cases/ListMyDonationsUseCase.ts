import { PaymentMethod } from '@ubuntu-fund/types';
import type { DonationEntity } from '../../domain/entities/Donation.js';
import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';

/**
 * A donor's own donation history. `status` and `paymentMethod` are derived —
 * the only donation path currently implemented (DonateToCampaignUseCase)
 * debits a wallet synchronously, so every donation is an immediately
 * completed wallet payment.
 */
export interface MyDonationDTO {
  id: string;
  campaignId: string;
  campaignName: string;
  amount: number;
  currency: string;
  date: Date;
  status: 'completed' | 'pending' | 'refunded';
  paymentMethod: PaymentMethod;
  message?: string;
  isAnonymous: boolean;
}

export class ListMyDonationsUseCase {
  constructor(
    private readonly donationRepo: DonationRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort
  ) {}

  async execute(donorId: string): Promise<MyDonationDTO[]> {
    const donations = await this.donationRepo.findByDonorId(donorId);
    return Promise.all(donations.map((donation) => this.toDTO(donation)));
  }

  private async toDTO(donation: DonationEntity): Promise<MyDonationDTO> {
    const campaign = await this.campaignRepo.findById(donation.campaignId);

    return {
      id: donation.id,
      campaignId: donation.campaignId,
      campaignName: campaign ? campaign.title : 'Campaign',
      amount: donation.amount.amount,
      currency: donation.amount.currency,
      date: donation.createdAt,
      status: 'completed',
      paymentMethod: PaymentMethod.WALLET,
      message: donation.message,
      isAnonymous: donation.isAnonymous,
    };
  }
}
