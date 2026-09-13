import { hasCurrentLegalAcceptance } from '@ubuntu-fund/types';
import { UserModel } from '../../../database/models/UserModel.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';
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
    coverUrl: doc.coverUrl,
    tipsEnabled: doc.tipsEnabled,
    presetAmounts: doc.presetAmounts,
    currency: doc.currency,
    thankYouMessage: doc.thankYouMessage,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    revision: doc.revision,
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
      coverUrl?: string;
      tipsEnabled?: boolean;
      presetAmounts?: number[];
      currency?: string;
      thankYouMessage?: string;
    },
    context: { expectedRevision: number | null; authVersion: string; publicChange: boolean }
  ): Promise<CreatorProfileEntity> {
    const owner = await UserModel.findOneAndUpdate({ _id: userId, deletedAt: null,
      ...(context.authVersion ? { authVersion: context.authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }),
    }, { $inc: { profileWriteVersion: 1 } }, { new: true });
    if (!owner) throw new AppError('Your session ended. Sign in again before saving.', 401);
    if (context.publicChange) {
      if (await ContentRestrictionModel.exists({ userId })) throw new AppError('Publishing is restricted. Contact support@ujimora.com to appeal.', 403);
      if (owner.role !== 'admin' && !hasCurrentLegalAcceptance(owner.legalAcceptance)) throw new AppError('Accept the current account agreement before publishing', 428);
    }
    if (context.expectedRevision === null) {
      const doc = await CreatorProfileModel.create({ userId, ...fields, revision: 0 });
      return toDomain(doc);
    }
    const revision = context.expectedRevision;
    const doc = await CreatorProfileModel.findOneAndUpdate(
      { userId, ...(revision === 0 ? { $or: [{ revision: 0 }, { revision: null }] } : { revision }) },
      { $set: { ...fields, handle: fields.handle.toLowerCase() }, $inc: { revision: 1 } },
      { new: true }
    );
    if (!doc) throw new AppError('Your creator page changed during review. Reload and retry.', 409);
    return toDomain(doc);
  }
}
