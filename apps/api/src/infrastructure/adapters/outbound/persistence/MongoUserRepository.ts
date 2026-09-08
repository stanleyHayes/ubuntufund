import { UserEntity } from '../../../../domain/entities/User.js';
import { Email } from '../../../../domain/value-objects/Email.js';
import { TrustScore } from '../../../../domain/value-objects/TrustScore.js';
import type { UserRepositoryPort } from '../../../../domain/ports/outbound/UserRepositoryPort.js';
import {
  UserModel,
  type UserDocument,
} from '../../../database/models/UserModel.js';

function toDomain(doc: UserDocument): UserEntity {
  return new UserEntity({
    id: doc._id!.toString(),
    email: new Email(doc.email),
    name: doc.name,
    passwordHash: doc.passwordHash,
    avatarUrl: doc.avatarUrl,
    coverUrl: doc.coverUrl,
    role: doc.role,
    verificationLevel: doc.verificationLevel,
    trustScore: new TrustScore(doc.trustScore),
    country: doc.country,
    emailVerified: doc.emailVerified,
    organizationName: doc.organizationName,
    organizationType: doc.organizationType,
    registrationNumber: doc.registrationNumber,
    website: doc.website,
    complianceApprovedCampaignLimit: doc.complianceApprovedCampaignLimit,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class MongoUserRepository implements UserRepositoryPort {
  async save(user: UserEntity): Promise<UserEntity> {
    const plain = user.toPlain();
    const doc = await UserModel.create({
      email: plain.email.value,
      name: plain.name,
      passwordHash: plain.passwordHash,
      avatarUrl: plain.avatarUrl,
      coverUrl: plain.coverUrl,
      role: plain.role,
      verificationLevel: plain.verificationLevel,
      trustScore: plain.trustScore.value,
      country: plain.country,
      emailVerified: plain.emailVerified,
      organizationName: plain.organizationName,
      organizationType: plain.organizationType,
      registrationNumber: plain.registrationNumber,
      website: plain.website,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const doc = await UserModel.findOne({ _id: id, deletedAt: { $exists: false } });
    return doc ? toDomain(doc) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const doc = await UserModel.findOne({
      email: email.toLowerCase(),
      deletedAt: { $exists: false },
    });
    return doc ? toDomain(doc) : null;
  }

  async update(user: UserEntity): Promise<UserEntity> {
    const plain = user.toPlain();
    const $set: Record<string, unknown> = {
      name: plain.name,
      avatarUrl: plain.avatarUrl,
      coverUrl: plain.coverUrl,
      role: plain.role,
      verificationLevel: plain.verificationLevel,
      trustScore: plain.trustScore.value,
      passwordHash: plain.passwordHash,
      country: plain.country,
      emailVerified: plain.emailVerified,
      organizationName: plain.organizationName,
      organizationType: plain.organizationType,
      registrationNumber: plain.registrationNumber,
      website: plain.website,
    };
    // Mongoose ignores `undefined` on $set, so clearing a compliance limit must
    // $unset the field rather than set it to undefined (otherwise the old value
    // persists). Set it explicitly when present.
    const update: Record<string, unknown> = { $set };
    if (plain.complianceApprovedCampaignLimit === undefined) {
      update.$unset = { complianceApprovedCampaignLimit: 1 };
    } else {
      $set.complianceApprovedCampaignLimit = plain.complianceApprovedCampaignLimit;
    }

    const doc = await UserModel.findByIdAndUpdate(
      { _id: plain.id, deletedAt: { $exists: false } },
      update,
      { new: true }
    );

    if (!doc) {
      throw new Error('User not found');
    }
    return toDomain(doc);
  }

  async delete(id: string): Promise<void> {
    await UserModel.updateOne(
      { _id: id, deletedAt: { $exists: false } },
      { $set: { deletedAt: new Date() } }
    );
  }
}
