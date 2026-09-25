import type { CampaignUpdateEntity } from '../../entities/CampaignUpdate.js';

export interface CampaignUpdateRepositoryPort {
  /** `publicationFingerprint` records the approved version being published. */
  save(update: CampaignUpdateEntity, options?: { publicationFingerprint?: string }): Promise<CampaignUpdateEntity>;
  findById(id: string): Promise<CampaignUpdateEntity | null>;
  findByCampaignId(campaignId: string): Promise<CampaignUpdateEntity[]>;
  update(update: CampaignUpdateEntity, expectedUpdatedAt?: Date, options?: { publicationFingerprint?: string }): Promise<CampaignUpdateEntity>;
  delete(id: string): Promise<void>;
}
