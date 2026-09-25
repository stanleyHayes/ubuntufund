import { AppError } from '../../inbound/middleware/errorHandler.js';
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
  async save(update: CampaignUpdateEntity, options: { publicationFingerprint?: string } = {}): Promise<CampaignUpdateEntity> {
    const plain = update.toPlain();
    const doc = await CampaignUpdateModel.create({
      ...(options.publicationFingerprint ? { publicationFingerprint: options.publicationFingerprint } : {}),
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
    const doc = await CampaignUpdateModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    return doc ? toDomain(doc) : null;
  }

  async findByCampaignId(campaignId: string): Promise<CampaignUpdateEntity[]> {
    const docs = await CampaignUpdateModel.find({
      campaignId,
      deletedAt: { $exists: false },
    }).sort({ isPinned: -1, createdAt: -1 });
    return docs.map(toDomain);
  }

  async update(update: CampaignUpdateEntity, expectedUpdatedAt?: Date, options: { publicationFingerprint?: string } = {}): Promise<CampaignUpdateEntity> {
    const plain = update.toPlain();
    const doc = await CampaignUpdateModel.findOneAndUpdate(
      { _id: plain.id, deletedAt: { $exists: false }, ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}) },
      {
        ...(options.publicationFingerprint ? { publicationFingerprint: options.publicationFingerprint } : {}),
        title: plain.title,
        content: plain.content,
        type: plain.type,
        mediaUrls: plain.mediaUrls,
        isPinned: plain.isPinned,
      },
      { new: true }
    );

    if (!doc) {
      throw new AppError('This update changed or was removed. Reload it before submitting your changes.', 409);
    }
    return toDomain(doc);
  }

  async delete(id: string): Promise<void> {
    await CampaignUpdateModel.updateOne(
      { _id: id, deletedAt: { $exists: false } },
      { $set: { deletedAt: new Date() } }
    );
  }
}
