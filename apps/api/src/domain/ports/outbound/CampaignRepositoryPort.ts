import type { CampaignEntity } from '../../entities/Campaign.js';
import type { PaginationParams } from '@ubuntu-fund/types';

export interface CampaignRepositoryPort {
  save(campaign: CampaignEntity): Promise<CampaignEntity>;
  findById(id: string): Promise<CampaignEntity | null>;
  findAll(params: PaginationParams): Promise<{ items: CampaignEntity[]; total: number }>;
  findByCreatorId(creatorId: string): Promise<CampaignEntity[]>;
  update(campaign: CampaignEntity): Promise<CampaignEntity>;
  delete(id: string): Promise<void>;
  countByCreatorId(creatorId: string): Promise<number>;
  /**
   * Atomically add to raisedAmount, only while the campaign is active,
   * unexpired, and in the same currency. Returns the updated campaign or null
   * when the campaign cannot accept the donation.
   */
  incrementRaised(campaignId: string, amount: number, currency: string): Promise<CampaignEntity | null>;
}
