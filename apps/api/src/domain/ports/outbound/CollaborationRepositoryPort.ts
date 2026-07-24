import type { CollaborationEntity } from '../../entities/Collaboration.js';

export interface CollaborationRepositoryPort {
  save(collaboration: CollaborationEntity): Promise<CollaborationEntity>;
  findById(id: string): Promise<CollaborationEntity | null>;
  findByCampaignId(campaignId: string): Promise<CollaborationEntity[]>;
  findByUserId(userId: string): Promise<CollaborationEntity[]>;
  findByCampaignAndUser(
    campaignId: string,
    userId: string
  ): Promise<CollaborationEntity | null>;
  update(collaboration: CollaborationEntity): Promise<CollaborationEntity>;
}
