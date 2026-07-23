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
    role: doc.role,
    verificationLevel: doc.verificationLevel,
    trustScore: new TrustScore(doc.trustScore),
    country: doc.country,
    emailVerified: doc.emailVerified,
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
      role: plain.role,
      verificationLevel: plain.verificationLevel,
      trustScore: plain.trustScore.value,
      country: plain.country,
      emailVerified: plain.emailVerified,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const doc = await UserModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const doc = await UserModel.findOne({ email: email.toLowerCase() });
    return doc ? toDomain(doc) : null;
  }

  async update(user: UserEntity): Promise<UserEntity> {
    const plain = user.toPlain();
    const doc = await UserModel.findByIdAndUpdate(
      plain.id,
      {
        name: plain.name,
        avatarUrl: plain.avatarUrl,
        role: plain.role,
        verificationLevel: plain.verificationLevel,
        trustScore: plain.trustScore.value,
        country: plain.country,
        emailVerified: plain.emailVerified,
      },
      { new: true }
    );

    if (!doc) {
      throw new Error('User not found');
    }
    return toDomain(doc);
  }

  async delete(id: string): Promise<void> {
    await UserModel.findByIdAndDelete(id);
  }
}
