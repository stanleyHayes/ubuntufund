import { ProfileEntity } from '../../../../domain/entities/Profile.js';
import type { ProfileRepositoryPort } from '../../../../domain/ports/outbound/ProfileRepositoryPort.js';
import {
  ProfileModel,
  type ProfileDocument,
} from '../../../database/models/ProfileModel.js';

function toDomain(doc: ProfileDocument): ProfileEntity {
  return new ProfileEntity({
    id: doc._id!.toString(),
    userId: doc.userId,
    phone: doc.phone,
    bio: doc.bio,
    notificationPreferences: {
      email: doc.notificationPreferences.email,
      sms: doc.notificationPreferences.sms,
      push: doc.notificationPreferences.push,
      donationReceipts: doc.notificationPreferences.donationReceipts,
      campaignUpdates: doc.notificationPreferences.campaignUpdates,
      marketingEmails: doc.notificationPreferences.marketingEmails,
    },
    preferredCurrency: doc.preferredCurrency,
    language: doc.language,
    darkMode: doc.darkMode,
    anonymousDonations: doc.anonymousDonations,
    showLeaderboards: doc.showLeaderboards,
    publicProfile: doc.publicProfile,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class MongoProfileRepository implements ProfileRepositoryPort {
  async save(profile: ProfileEntity): Promise<ProfileEntity> {
    const plain = profile.toPlain();
    const doc = await ProfileModel.create({
      userId: plain.userId,
      phone: plain.phone,
      bio: plain.bio,
      notificationPreferences: plain.notificationPreferences,
      preferredCurrency: plain.preferredCurrency,
      language: plain.language,
      darkMode: plain.darkMode,
      anonymousDonations: plain.anonymousDonations,
      showLeaderboards: plain.showLeaderboards,
      publicProfile: plain.publicProfile,
    });
    return toDomain(doc);
  }

  async findByUserId(userId: string): Promise<ProfileEntity | null> {
    const doc = await ProfileModel.findOne({ userId });
    return doc ? toDomain(doc) : null;
  }

  async update(profile: ProfileEntity): Promise<ProfileEntity> {
    const plain = profile.toPlain();
    const doc = await ProfileModel.findOneAndUpdate(
      { userId: plain.userId },
      {
        phone: plain.phone,
        bio: plain.bio,
        notificationPreferences: plain.notificationPreferences,
        preferredCurrency: plain.preferredCurrency,
        language: plain.language,
        darkMode: plain.darkMode,
        anonymousDonations: plain.anonymousDonations,
        showLeaderboards: plain.showLeaderboards,
        publicProfile: plain.publicProfile,
      },
      { new: true, upsert: true }
    );

    if (!doc) {
      throw new Error('Profile not found');
    }
    return toDomain(doc);
  }
}
