export interface CampaignCommentRecord {
  id: string;
  campaignId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignCommentRepositoryPort {
  create(campaignId: string, authorId: string, content: string): Promise<CampaignCommentRecord>;
  findById(id: string): Promise<CampaignCommentRecord | null>;
  findByCampaignId(campaignId: string, limit: number): Promise<CampaignCommentRecord[]>;
  softDelete(id: string): Promise<void>;
}
