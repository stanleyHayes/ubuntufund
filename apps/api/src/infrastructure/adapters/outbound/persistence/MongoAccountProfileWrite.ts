import { createHash } from 'node:crypto';
import { hasCurrentLegalAcceptance } from '@ubuntu-fund/types';
import type { PublicationAdmissionPort } from '../../../../domain/ports/outbound/PublicationAdmissionPort.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import type { AccountProfileChanges, AccountProfileWritePort } from '../../../../domain/ports/outbound/AccountProfileWritePort.js';
import type { UnitOfWorkPort } from '../../../../domain/ports/outbound/UnitOfWorkPort.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { ProfileModel } from '../../../database/models/ProfileModel.js';
import { MongoUserRepository } from './MongoUserRepository.js';
import { MongoProfileRepository } from './MongoProfileRepository.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

export class MongoAccountProfileWrite implements AccountProfileWritePort {
  constructor(private readonly uow: UnitOfWorkPort, private readonly admission?: PublicationAdmissionPort) {}

  async write(userId: string, changes: AccountProfileChanges, authVersion: string) {
    const original = await UserModel.findOne({ _id: userId, deletedAt: null }).lean();
    if (!original) throw new AppError('Account is no longer available', 401);
    const originalProfile = await ProfileModel.findOne({ userId }).lean();
    const before = { name: original.name, avatarUrl: original.avatarUrl ?? '', coverUrl: original.coverUrl ?? '', country: original.country ?? '', publicProfile: originalProfile?.publicProfile ?? true };
    const proposed = { name: changes.name ?? before.name, avatarUrl: changes.avatarUrl ?? before.avatarUrl, coverUrl: changes.coverUrl ?? before.coverUrl, country: changes.country ?? before.country, publicProfile: changes.publicProfile ?? before.publicProfile };
    const identityKeys = ['name', 'avatarUrl', 'coverUrl', 'country'] as const;
    const identityTouched = identityKeys.some(key => changes[key] !== undefined);
    const publicChange = identityKeys.some(key => proposed[key] !== before[key]) || (!before.publicProfile && proposed.publicProfile);
    const versionBound = identityTouched || changes.publicProfile === true;
    const fingerprint = (fields: typeof before, revision: number) => createHash('sha256').update(JSON.stringify([userId, revision, fields])).digest('hex');
    const baseVersion = fingerprint(before, original.accountIdentityRevision ?? 0);
    if (publicChange) {
      if (!this.admission) throw new AppError('Account identity review is unavailable', 503);
      await this.admission.assertAllowed({ actorId: userId, action: 'account.profile', resourceId: userId, baseVersion,
        text: JSON.stringify(proposed), mediaUrls: [proposed.avatarUrl, proposed.coverUrl].filter(Boolean), automatedReviewConsent: changes.automatedReviewConsent });
    }
    return this.uow.run(async () => {
      if (versionBound) {
        const latest = await UserModel.findOne({ _id: userId, deletedAt: null }).lean();
        const latestProfile = await ProfileModel.findOne({ userId }).lean();
        if (!latest) throw new AppError('Account is no longer available', 401);
        const latestVersion = fingerprint({ name: latest.name, avatarUrl: latest.avatarUrl ?? '', coverUrl: latest.coverUrl ?? '', country: latest.country ?? '', publicProfile: latestProfile?.publicProfile ?? true }, latest.accountIdentityRevision ?? 0);
        if (latestVersion !== baseVersion) throw new AppError('Your account identity changed during review. Reload and retry.', 409);
      }

      const identity: Record<string, unknown> = {};
      for (const key of ['name', 'avatarUrl', 'coverUrl', 'country'] as const) {
        if (changes[key] !== undefined) identity[key] = changes[key];
      }
      // The real account write serializes with password changes, closure and erasure.
      const account = await UserModel.findOneAndUpdate({ _id: userId, deletedAt: null,
        ...(authVersion ? { authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }),
      }, { $set: identity, $inc: { profileWriteVersion: 1, ...(identityTouched || changes.publicProfile !== undefined ? { accountIdentityRevision: 1 } : {}) } }, { new: true });
      if (!account) throw new AppError('Your session ended. Sign in again before saving.', 401);
      if (publicChange) {
        if (await ContentRestrictionModel.exists({ userId })) throw new AppError('Publishing is restricted', 403);
        if (account.role !== 'admin' && !hasCurrentLegalAcceptance(account.legalAcceptance)) throw new AppError('Accept the current agreement before publishing', 428);
      }
      const profileFields: Record<string, unknown> = {};
      for (const key of ['phone', 'bio', 'preferredCurrency', 'language', 'darkMode', 'anonymousDonations', 'showLeaderboards', 'publicProfile'] as const) {
        if (changes[key] !== undefined) profileFields[key] = changes[key];
      }
      for (const key of ['email', 'sms', 'push', 'donationReceipts', 'campaignUpdates', 'marketingEmails'] as const) {
        if (changes.notificationPreferences?.[key] !== undefined) profileFields[`notificationPreferences.${key}`] = changes.notificationPreferences[key];
      }
      await ProfileModel.findOneAndUpdate({ userId }, { $set: profileFields, $setOnInsert: { userId } }, { upsert: true, new: true });
      const user = await new MongoUserRepository().findById(userId);
      const profile = await new MongoProfileRepository().findByUserId(userId);
      if (!user || !profile) throw new AppError('Profile could not be saved', 500);
      return { user, profile };
    });
  }
}
