import type { CampaignCommentRecord, CampaignCommentRepositoryPort } from '../../../../domain/ports/outbound/CampaignCommentRepositoryPort.js';
import { CampaignCommentModel, type CampaignCommentDocument } from '../../../database/models/CampaignCommentModel.js';

function toRecord(doc: CampaignCommentDocument): CampaignCommentRecord {
  return { id: doc._id!.toString(), campaignId: doc.campaignId, authorId: doc.authorId, content: doc.content, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
}

export class MongoCampaignCommentRepository implements CampaignCommentRepositoryPort {
  async create(campaignId: string, authorId: string, content: string): Promise<CampaignCommentRecord> {
    return toRecord(await CampaignCommentModel.create({ campaignId, authorId, content }));
  }

  async findById(id: string): Promise<CampaignCommentRecord | null> {
    const doc = await CampaignCommentModel.findOne({ _id: id, deletedAt: { $exists: false } });
    return doc ? toRecord(doc) : null;
  }

  async findByCampaignId(campaignId: string, limit: number): Promise<CampaignCommentRecord[]> {
    const docs = await CampaignCommentModel.find({ campaignId, deletedAt: { $exists: false } }).sort({ createdAt: -1 }).limit(limit);
    return docs.map(toRecord);
  }

  async softDelete(id: string): Promise<void> {
    await CampaignCommentModel.updateOne({ _id: id, deletedAt: { $exists: false } }, { $set: { deletedAt: new Date() } });
  }
}
