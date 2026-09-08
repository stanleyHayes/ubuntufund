import { CreatorProfileEntity } from '../../../../domain/entities/CreatorProfile.js';
import type { CreatorProfileRepositoryPort } from '../../../../domain/ports/outbound/CreatorProfileRepositoryPort.js';
import {
  CreatorProfileModel,
  type CreatorProfileDocument,
} from '../../../database/models/CreatorProfileModel.js';

function toDomain(doc: CreatorProfileDocument): CreatorProfileEntity {
  return new CreatorProfileEntity({
    id: doc._id!.toString(),
    userId: doc.userId,
    handle: doc.handle,
    displayName: doc.displayName,
    tagline: doc.tagline,
    bio: doc.bio,
    avatarUrl: doc.avatarUrl,
    tipsEnabled: doc.tipsEnabled,
    presetAmounts: doc.presetAmounts,
    currency: doc.currency,
    thankYouMessage: doc.thankYouMessage,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class MongoCreatorProfileRepository
  implements CreatorProfileRepositoryPort
{
  async findByUserId(userId: string): Promise<CreatorProfileEntity | null> {
    const doc = await CreatorProfileModel.findOne({ userId });
    return doc ? toDomain(doc) : null;
  }

  async findByHandle(handle: string): Promise<CreatorProfileEntity | null> {
    const doc = await CreatorProfileModel.findOne({
      handle: handle.trim().toLowerCase().replace(/^@/, ''),
    });
    return doc ? toDomain(doc) : null;
  }

  async save(
    userId: string,
    fields: {
      handle: string;
      displayName: string;
      tagline?: string;
      bio?: string;
      avatarUrl?: string;
      tipsEnabled?: boolean;
      presetAmounts?: number[];
      currency?: string;
      thankYouMessage?: string;
    }
  ): Promise<CreatorProfileEntity> {
    const doc = await CreatorProfileModel.findOneAndUpdate(
      { userId },
      { $set: { userId, ...fields, handle: fields.handle.toLowerCase() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return toDomain(doc!);
  }
}
