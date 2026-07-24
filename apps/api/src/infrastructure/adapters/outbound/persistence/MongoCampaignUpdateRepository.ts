import { CampaignUpdateEntity } from '../../../../domain/entities/CampaignUpdate.js';
import type { CampaignUpdateRepositoryPort } from '../../../../domain/ports/outbound/CampaignUpdateRepositoryPort.js';
import {
  CampaignUpdateModel,
  type CampaignUpdateDocument,
} from '../../../database/models/CampaignUpdateModel.js';

function toDomain(doc: CampaignUpdateDocument): CampaignUpdateEntity {
  return new CampaignUpdateEntity({
    id: doc._id!.toString(),
    campaignId: doc.campaignId,
    authorId: doc.authorId,
    title: doc.title,
    content: doc.content,
    type: doc.type,
    mediaUrls: doc.mediaUrls,
    isPinned: doc.isPinned,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class MongoCampaignUpdateRepository implements CampaignUpdateRepositoryPort {
  async save(update: CampaignUpdateEntity): Promise<CampaignUpdateEntity> {
    const plain = update.toPlain();
    const doc = await CampaignUpdateModel.create({
      campaignId: plain.campaignId,
      authorId: plain.authorId,
      title: plain.title,
      content: plain.content,
      type: plain.type,
      mediaUrls: plain.mediaUrls,
      isPinned: plain.isPinned,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<CampaignUpdateEntity | null> {
    const doc = await CampaignUpdateModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByCampaignId(campaignId: string): Promise<CampaignUpdateEntity[]> {
    const docs = await CampaignUpdateModel.find({ campaignId }).sort({
      isPinned: -1,
      createdAt: -1,
    });
    return docs.map(toDomain);
  }

  async update(update: CampaignUpdateEntity): Promise<CampaignUpdateEntity> {
    const plain = update.toPlain();
    const doc = await CampaignUpdateModel.findByIdAndUpdate(
      plain.id,
      {
        title: plain.title,
        content: plain.content,
        type: plain.type,
        mediaUrls: plain.mediaUrls,
        isPinned: plain.isPinned,
      },
      { new: true }
    );

    if (!doc) {
      throw new Error('Campaign update not found');
    }
    return toDomain(doc);
  }

  async delete(id: string): Promise<void> {
    await CampaignUpdateModel.findByIdAndDelete(id);
  }
}
