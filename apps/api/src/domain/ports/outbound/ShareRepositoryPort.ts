export interface ShareRecord {
  id: string;
  campaignId: string;
  userId: string;
  platform?: string;
  createdAt: Date;
}

export interface ShareRepositoryPort {
  save(share: ShareRecord): Promise<ShareRecord>;
  findByCampaignId(campaignId: string): Promise<ShareRecord[]>;
  countByCampaignId(campaignId: string): Promise<number>;
}
