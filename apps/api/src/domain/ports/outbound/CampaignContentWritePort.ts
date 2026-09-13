export interface CampaignContentWritePort {
  run<T>(actorId: string, authVersion: string, campaignId: string, ownerId: string, work: () => Promise<T>): Promise<T>;
}
