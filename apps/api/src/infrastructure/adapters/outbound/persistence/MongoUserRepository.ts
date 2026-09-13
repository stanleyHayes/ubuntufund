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
    authVersion: doc.authVersion,
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
    needsWebsite: doc.needsWebsite,
    legalAcceptance: doc.legalAcceptance,
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
      authVersion: plain.authVersion,
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
      needsWebsite: plain.needsWebsite,
      websiteRequestedAt: plain.needsWebsite ? new Date() : undefined,
      legalAcceptance: plain.legalAcceptance,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const doc = await UserModel.findOne({ _id: id, deletedAt: null });
    return doc ? toDomain(doc) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const doc = await UserModel.findOne({
      email: email.toLowerCase(),
      deletedAt: null,
    });
    return doc ? toDomain(doc) : null;
  }

  async raiseVerificationLevel(id: string, level: number): Promise<boolean> {
    const result = await UserModel.updateOne({ _id: id, deletedAt: null }, { $max: { verificationLevel: level } });
    return result.matchedCount === 1;
  }

  async update(user: UserEntity): Promise<UserEntity> {
    const plain = user.toPlain();
    const $set: Record<string, unknown> = {
      verificationLevel: plain.verificationLevel,
      trustScore: plain.trustScore.value,
      organizationType: plain.organizationType,
      registrationNumber: plain.registrationNumber,
      legalAcceptance: plain.legalAcceptance,
    };
    // Account name/photo/cover/country are changed only by atomic profile patches.
    // Organization name/website are changed only by reviewed organization identity writes.
    // General profile updates cannot restore stale credentials or their session version.
    if (user.passwordChanged) {
      $set.passwordHash = plain.passwordHash;
      $set.authVersion = plain.authVersion;
    }
    // Email verification and administrator role changes must survive older profile snapshots.
    if (user.emailVerificationChanged) $set.emailVerified = plain.emailVerified;
    // Website consent is changed only by signup/withdrawal, never by a stale general account save.
    // Mongoose ignores `undefined` on $set, so clearing a compliance limit must
    // $unset the field rather than set it to undefined (otherwise the old value
    // persists). Set it explicitly when present.
    const update: Record<string, unknown> = { $set };
    if (plain.complianceApprovedCampaignLimit === undefined) {
      update.$unset = { complianceApprovedCampaignLimit: 1 };
    } else {
      $set.complianceApprovedCampaignLimit = plain.complianceApprovedCampaignLimit;
    }

    const doc = await UserModel.findOneAndUpdate(
      { _id: plain.id, deletedAt: null, ...(user.passwordChanged ? { passwordHash: user.originalPasswordHash } : {}) },
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
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } }
    );
  }
}
