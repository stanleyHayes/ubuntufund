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
}
