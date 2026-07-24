import type {
  ShareRepositoryPort,
  ShareRecord,
} from '../../../../domain/ports/outbound/ShareRepositoryPort.js';
import {
  ShareModel,
  type ShareDocument,
} from '../../../database/models/ShareModel.js';

function toDomain(doc: ShareDocument): ShareRecord {
  return {
    id: doc._id!.toString(),
    campaignId: doc.campaignId,
    userId: doc.userId,
    platform: doc.platform,
    createdAt: doc.createdAt,
  };
}

export class MongoShareRepository implements ShareRepositoryPort {
  async save(share: ShareRecord): Promise<ShareRecord> {
    const doc = await ShareModel.create({
      campaignId: share.campaignId,
      userId: share.userId,
      platform: share.platform,
    });
    return toDomain(doc);
  }

  async findByCampaignId(campaignId: string): Promise<ShareRecord[]> {
    const docs = await ShareModel.find({ campaignId }).sort({
      createdAt: -1,
    });
    return docs.map(toDomain);
  }

  async countByCampaignId(campaignId: string): Promise<number> {
    return ShareModel.countDocuments({ campaignId });
  }
}
