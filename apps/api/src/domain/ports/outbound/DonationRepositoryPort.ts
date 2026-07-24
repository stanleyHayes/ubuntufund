import type { DonationEntity } from '../../entities/Donation.js';

export interface DonationRepositoryPort {
  save(donation: DonationEntity): Promise<DonationEntity>;
  findById(id: string): Promise<DonationEntity | null>;
  findByCampaignId(campaignId: string): Promise<DonationEntity[]>;
  findByDonorId(donorId: string): Promise<DonationEntity[]>;
  /** Most recent donations across all campaigns, newest first. */
  findRecent(limit: number): Promise<DonationEntity[]>;
  /** Distinct donor counts keyed by campaign id, for the given campaigns. */
  countDistinctDonorsByCampaignIds(campaignIds: string[]): Promise<Record<string, number>>;
}
