import type { TransferRecipientEntity } from '../../entities/TransferRecipient.js';

export interface TransferRecipientRepositoryPort {
  recordReview?(id: string, reviewedBy: string, reviewNote: string, payoutId: string): Promise<void>;
  create(recipient: TransferRecipientEntity): Promise<TransferRecipientEntity>;
  findById(id: string): Promise<TransferRecipientEntity | null>;
  findByCampaignId(campaignId: string): Promise<TransferRecipientEntity[]>;
  /** The most-recently registered recipient for a campaign, if any. */
  findLatestByCampaignId(
    campaignId: string
  ): Promise<TransferRecipientEntity | null>;
}
