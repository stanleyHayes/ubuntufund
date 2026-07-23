import type { DonationEntity } from '../../entities/Donation.js';

export interface DonationRepositoryPort {
  save(donation: DonationEntity): Promise<DonationEntity>;
  findById(id: string): Promise<DonationEntity | null>;
  findByCampaignId(campaignId: string): Promise<DonationEntity[]>;
  findByDonorId(donorId: string): Promise<DonationEntity[]>;
}
