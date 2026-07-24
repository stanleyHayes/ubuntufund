import { CollaborationEntity } from '../../../../domain/entities/Collaboration.js';
import type { CollaborationRepositoryPort } from '../../../../domain/ports/outbound/CollaborationRepositoryPort.js';
import {
  CollaborationModel,
  type CollaborationDocument,
} from '../../../database/models/CollaborationModel.js';

function toDomain(doc: CollaborationDocument): CollaborationEntity {
  return new CollaborationEntity({
    id: doc._id!.toString(),
    campaignId: doc.campaignId,
    userId: doc.userId,
    invitedBy: doc.invitedBy,
    role: doc.role,
    status: doc.status,
    revenueSharePercent: doc.revenueSharePercent,
    displayName: doc.displayName,
    logoUrl: doc.logoUrl,
    inviteMessage: doc.inviteMessage,
    respondedAt: doc.respondedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class MongoCollaborationRepository implements CollaborationRepositoryPort {
  async save(collaboration: CollaborationEntity): Promise<CollaborationEntity> {
    const plain = collaboration.toPlain();
    const doc = await CollaborationModel.create({
      campaignId: plain.campaignId,
      userId: plain.userId,
      invitedBy: plain.invitedBy,
      role: plain.role,
      status: plain.status,
      revenueSharePercent: plain.revenueSharePercent,
      displayName: plain.displayName,
      logoUrl: plain.logoUrl,
      inviteMessage: plain.inviteMessage,
      respondedAt: plain.respondedAt,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<CollaborationEntity | null> {
    const doc = await CollaborationModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByCampaignId(campaignId: string): Promise<CollaborationEntity[]> {
    const docs = await CollaborationModel.find({ campaignId }).sort({
      createdAt: -1,
    });
    return docs.map(toDomain);
  }

  async findByUserId(userId: string): Promise<CollaborationEntity[]> {
    const docs = await CollaborationModel.find({ userId }).sort({
      createdAt: -1,
    });
    return docs.map(toDomain);
  }

  async findByCampaignAndUser(
    campaignId: string,
    userId: string
  ): Promise<CollaborationEntity | null> {
    const doc = await CollaborationModel.findOne({ campaignId, userId });
    return doc ? toDomain(doc) : null;
  }

  async update(collaboration: CollaborationEntity): Promise<CollaborationEntity> {
    const plain = collaboration.toPlain();
    const setFields: Record<string, unknown> = {
      invitedBy: plain.invitedBy,
      role: plain.role,
      status: plain.status,
      revenueSharePercent: plain.revenueSharePercent,
      displayName: plain.displayName,
      logoUrl: plain.logoUrl,
      inviteMessage: plain.inviteMessage,
    };

    const update: Record<string, unknown> = { $set: setFields };
    if (plain.respondedAt) {
      setFields.respondedAt = plain.respondedAt;
    } else {
      update.$unset = { respondedAt: '' };
    }

    const doc = await CollaborationModel.findByIdAndUpdate(plain.id, update, {
      new: true,
    });
    if (!doc) {
      throw new Error('Collaboration not found');
    }
    return toDomain(doc);
  }
}
