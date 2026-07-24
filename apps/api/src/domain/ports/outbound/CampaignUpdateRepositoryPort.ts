import type { CampaignUpdateEntity } from '../../entities/CampaignUpdate.js';

export interface CampaignUpdateRepositoryPort {
  save(update: CampaignUpdateEntity): Promise<CampaignUpdateEntity>;
  findById(id: string): Promise<CampaignUpdateEntity | null>;
  findByCampaignId(campaignId: string): Promise<CampaignUpdateEntity[]>;
  update(update: CampaignUpdateEntity): Promise<CampaignUpdateEntity>;
  delete(id: string): Promise<void>;
}
