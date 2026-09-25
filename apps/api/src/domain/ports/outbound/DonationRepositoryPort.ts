import type { LegalAcceptanceRecord } from '@ubuntu-fund/types';
import type { DonationEntity } from '../../entities/Donation.js';

export interface DonationRepositoryPort {
  save(donation: DonationEntity): Promise<DonationEntity>;
  findById(id: string): Promise<DonationEntity | null>;
  findByCampaignId(campaignId: string): Promise<DonationEntity[]>;
  /** One page of a campaign's donations, newest first, plus the campaign's total count. */
  findPageByCampaignId(campaignId: string, skip: number, limit: number): Promise<{ items: DonationEntity[]; total: number }>;
  findByDonorId(donorId: string): Promise<DonationEntity[]>;
  /** Most recent donations across all campaigns, newest first. */
  findRecent(limit: number): Promise<DonationEntity[]>;
  /** Distinct donor counts keyed by campaign id, for the given campaigns. */
  countDistinctDonorsByCampaignIds(campaignIds: string[]): Promise<Record<string, number>>;
  /**
   * Set a donation's public message, only when owned by `donorId`. Returns the
   * updated donation, or null when it does not exist or belongs to someone else.
   */
  updateMessage(id: string, donorId: string, message: string, agreement: LegalAcceptanceRecord): Promise<DonationEntity | null>;
}
