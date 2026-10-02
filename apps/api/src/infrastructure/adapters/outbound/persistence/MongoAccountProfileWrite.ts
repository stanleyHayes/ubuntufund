import { createHash } from 'node:crypto';
import { hasCurrentLegalAcceptance } from '@ubuntu-fund/types';
import type { PublicationAdmissionPort, PublicationSubmission } from '../../../../domain/ports/outbound/PublicationAdmissionPort.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import type { AccountProfileChanges, AccountProfileWritePort } from '../../../../domain/ports/outbound/AccountProfileWritePort.js';
import type { UnitOfWorkPort } from '../../../../domain/ports/outbound/UnitOfWorkPort.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { ProfileModel } from '../../../database/models/ProfileModel.js';
import { MongoUserRepository } from './MongoUserRepository.js';
import { MongoProfileRepository } from './MongoProfileRepository.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';
import { PublicationAlreadyPublished, isPublicationHeldError } from '../../inbound/middleware/publicationErrors.js';

/**
 * An account's public identity: what an account.profile review holds (its
 * text, in this key order) and what the identity version is a digest of.
 */
export interface AccountIdentity {
  name: string;
  avatarUrl: string;
  coverUrl: string;
  country: string;
  publicProfile: boolean;
}

const IDENTITY_KEYS = ['name', 'avatarUrl', 'coverUrl', 'country'] as const;
/** Settings only the account holder sees: never reviewed, so a hold never keeps them back. Never `publicProfile`. */
const PRIVATE_KEYS = ['phone', 'bio', 'preferredCurrency', 'language', 'darkMode', 'anonymousDonations', 'showLeaderboards'] as const;
const NOTIFICATION_KEYS = ['email', 'sms', 'push', 'donationReceipts', 'campaignUpdates', 'marketingEmails'] as const;

type StoredIdentity = { name: string; avatarUrl?: string | null; coverUrl?: string | null; country?: string | null };

/** In this key order: the version digest and the review text depend on it. */
function identityOf(user: StoredIdentity, profile: { publicProfile?: boolean | null } | null): AccountIdentity {
  return { name: user.name, avatarUrl: user.avatarUrl ?? '', coverUrl: user.coverUrl ?? '', country: user.country ?? '', publicProfile: profile?.publicProfile ?? true };
}

/**
 * The identity version a change is proposed against: the identity and its
 * revision, bound to the account. Every identity or visibility change bumps
 * the revision, so a version proposed against an earlier identity never
 * matches again.
 */
export function accountIdentityVersion(userId: string, identity: AccountIdentity, revision: number): string {
  const fields: AccountIdentity = { name: identity.name, avatarUrl: identity.avatarUrl, coverUrl: identity.coverUrl, country: identity.country, publicProfile: identity.publicProfile };
  return createHash('sha256').update(JSON.stringify([userId, revision, fields])).digest('hex');
}

/** The account's credential fence: only the request's own credential version (or none, for an account that never rotated). */
const credentialFilter = (authVersion: string) => (authVersion ? { authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] });

/** Only the private settings of a change, or null when it has none. */
function privateChanges(changes: AccountProfileChanges): AccountProfileChanges | null {
  const kept: AccountProfileChanges = {};
  for (const key of PRIVATE_KEYS) if (changes[key] !== undefined) (kept as Record<string, unknown>)[key] = changes[key];
  const preferences = changes.notificationPreferences;
  if (preferences && NOTIFICATION_KEYS.some(key => preferences[key] !== undefined)) kept.notificationPreferences = preferences;
  return Object.keys(kept).length ? kept : null;
}

export interface AccountProfileCommitOptions {
  /**
   * The identity version (accountIdentityVersion) the change was proposed
   * against. Inside the transaction the identity must still be that version,
   * or nothing is written (409, `stale_version`). Omitted for a change bound
   * to no version: private settings, or hiding the profile.
   */
  baseVersion?: string;
  /** It publishes public identity: the account must still be free to publish and have accepted the current agreement. */
  publishes: boolean;
}

export class MongoAccountProfileWrite implements AccountProfileWritePort {
  constructor(private readonly uow: UnitOfWorkPort, private readonly admission?: PublicationAdmissionPort) {}

  async write(userId: string, changes: AccountProfileChanges, authVersion: string) {
    const original = await UserModel.findOne({ _id: userId, deletedAt: null }).lean();
    if (!original) throw new AppError('Account is no longer available', 401);
    const originalProfile = await ProfileModel.findOne({ userId }).lean();
    const before = identityOf(original, originalProfile);
    const proposed: AccountIdentity = { name: changes.name ?? before.name, avatarUrl: changes.avatarUrl ?? before.avatarUrl, coverUrl: changes.coverUrl ?? before.coverUrl, country: changes.country ?? before.country, publicProfile: changes.publicProfile ?? before.publicProfile };
    const identityTouched = IDENTITY_KEYS.some(key => changes[key] !== undefined);
    const changedKeys = IDENTITY_KEYS.filter(key => proposed[key] !== before[key]);
    const publicChange = changedKeys.length > 0 || (!before.publicProfile && proposed.publicProfile);
    // Taking a photo down publishes nothing new, so it applies at once: a user
    // must never wait for staff to remove their own image.
    const withdrawalOnly = changedKeys.length > 0 && !(!before.publicProfile && proposed.publicProfile) &&
      changedKeys.every(key => (key === 'avatarUrl' || key === 'coverUrl') && proposed[key] === '');
    const versionBound = identityTouched || changes.publicProfile === true;
    const baseVersion = accountIdentityVersion(userId, before, original.accountIdentityRevision ?? 0);
    const reviewed = publicChange && !withdrawalOnly;
    let submission: PublicationSubmission | undefined;
    if (reviewed) {
      if (!this.admission?.assertCurrent) throw new AppError('Account identity review is unavailable', 503);
      // Only newly proposed images need media inspection; unchanged ones are
      // already public. The full proposed identity stays bound in the text.
      const newMedia = (['avatarUrl', 'coverUrl'] as const).filter(key => proposed[key] && proposed[key] !== before[key]).map(key => proposed[key]);
      submission = { actorId: userId, action: 'account.profile', resourceId: userId, baseVersion,
        text: JSON.stringify(proposed), mediaUrls: newMedia, automatedReviewConsent: changes.automatedReviewConsent, authVersion };
      try {
        await this.admission.assertAllowed(submission);
      } catch (error) {
        // This exact identity is published already: an older app saving it again, its read of the
        // account racing the approval that published it. The rest of the request still applies.
        if (error instanceof PublicationAlreadyPublished) return this.savePrivateSettings(userId, changes, authVersion);
        throw await this.keepPrivateSettings(userId, changes, authVersion, error);
      }
    }
    return this.uow.run(async () => {
      await this.commit(userId, changes, authVersion, { ...(versionBound ? { baseVersion } : {}), publishes: reviewed });
      // Approvals are single-use: this request publishes the approved version, once.
      if (submission) await this.admission!.assertCurrent!(submission, { publishedResourceId: userId });
      return this.current(userId);
    });
  }

  /** The account and profile as they are now (in the caller's transaction, if any). */
  private async current(userId: string) {
    const user = await new MongoUserRepository().findById(userId);
    const profile = await new MongoProfileRepository().findByUserId(userId);
    if (!user || !profile) throw new AppError('Profile could not be saved', 500);
    return { user, profile };
  }

  /**
   * A held identity keeps nothing else back: the private settings sent with
   * it are saved now, in their own fenced write that leaves the identity (and
   * its revision, so the held version stays current) alone. Returns the hold
   * to pass on, marked `errors.saved: ['private']` when settings were saved;
   * anything other than a hold is returned unchanged.
   */
  private async keepPrivateSettings(userId: string, changes: AccountProfileChanges, authVersion: string, error: unknown): Promise<unknown> {
    if (!isPublicationHeldError(error)) return error;
    const settings = privateChanges(changes);
    if (!settings) return error;
    await this.uow.run(() => this.commit(userId, settings, authVersion, { publishes: false }));
    return new AppError(error.message, error.statusCode, { ...error.errors, saved: ['private'] }, error.code);
  }

  /**
   * The request's identity is already public as sent: saves only its
   * private settings (fenced, as on a hold, the identity and its revision
   * untouched) and answers with the account as it is.
   */
  private savePrivateSettings(userId: string, changes: AccountProfileChanges, authVersion: string) {
    const settings = privateChanges(changes);
    return this.uow.run(async () => {
      if (settings) await this.commit(userId, settings, authVersion, { publishes: false });
      return this.current(userId);
    });
  }

  /**
   * Publishing on approval: writes an approved identity version exactly as
   * the author's own request would, onto the exact version it was proposed
   * against, and records it as published (`publish`) in the same transaction.
   */
  applyApproved(review: { actorId: string; baseVersion: string }, proposal: AccountIdentity, authVersion: string, publish: () => Promise<void>): Promise<void> {
    const changes: AccountProfileChanges = { name: proposal.name, avatarUrl: proposal.avatarUrl, coverUrl: proposal.coverUrl, country: proposal.country, publicProfile: proposal.publicProfile };
    return this.uow.run(async () => {
      await this.commit(review.actorId, changes, authVersion, { baseVersion: review.baseVersion, publishes: true });
      await publish();
    });
  }

  /**
   * The account profile write, inside the caller's transaction: shared by the
   * author's own request and publishing on approval, so both run the same
   * checks. Fences the account's credentials and closure, re-checks the
   * identity version, restriction and agreement, and bumps the identity
   * revision when an identity value or the visibility changes, or when the
   * change takes something down (a photo sent empty, the profile sent
   * private) even though the account already reads that way: that is the
   * author withdrawing a held photo or "make it public", which its approval
   * must then never publish. Saving a current name, country or photo again
   * (an older app) leaves every version proposed against the identity
   * current. Refusals carry a publication fence `code`.
   */
  async commit(userId: string, changes: AccountProfileChanges, authVersion: string, options: AccountProfileCommitOptions): Promise<void> {
    const identityRelated = IDENTITY_KEYS.some(key => changes[key] !== undefined) || changes.publicProfile !== undefined;
    const current = identityRelated || options.baseVersion !== undefined ? await this.currentIdentity(userId, options.baseVersion) : undefined;
    const identity: Record<string, unknown> = {};
    for (const key of IDENTITY_KEYS) {
      if (changes[key] !== undefined) identity[key] = changes[key];
    }
    const unset: Record<string, 1> = {};
    // A new avatar reached here only through media review: remember that
    // exact image so comments can carry it without a second media hold.
    if (current && changes.avatarUrl !== undefined && changes.avatarUrl !== current.avatarUrl) {
      if (changes.avatarUrl) identity.reviewedAvatarUrl = changes.avatarUrl;
      else unset.reviewedAvatarUrl = 1;
    }
    // Only ever takes something down: always a newer identity version (see above).
    const withdraws = changes.avatarUrl === '' || changes.coverUrl === '' || changes.publicProfile === false;
    const identityChanged = !!current && (withdraws || IDENTITY_KEYS.some(key => changes[key] !== undefined && changes[key] !== current[key]) ||
      (changes.publicProfile !== undefined && changes.publicProfile !== current.publicProfile));
    // The real account write serializes with password changes, closure and erasure.
    const account = await UserModel.findOneAndUpdate({ _id: userId, deletedAt: null, ...credentialFilter(authVersion) }, {
      $set: identity, ...(Object.keys(unset).length ? { $unset: unset } : {}),
      $inc: { profileWriteVersion: 1, ...(identityChanged ? { accountIdentityRevision: 1 } : {}) },
    }, { new: true });
    if (!account) throw new AppError('Your session ended. Sign in again before saving.', 401, undefined, 'account_session');
    if (options.publishes) {
      if (await ContentRestrictionModel.exists({ userId })) throw new AppError('Publishing is restricted', 403, undefined, 'publishing_restricted');
      if (account.role !== 'admin' && !hasCurrentLegalAcceptance(account.legalAcceptance)) throw new AppError('Accept the current agreement before publishing', 428, undefined, 'terms_required');
    }
    const profileFields: Record<string, unknown> = {};
    for (const key of [...PRIVATE_KEYS, 'publicProfile'] as const) {
      if (changes[key] !== undefined) profileFields[key] = changes[key];
    }
    for (const key of NOTIFICATION_KEYS) {
      if (changes.notificationPreferences?.[key] !== undefined) profileFields[`notificationPreferences.${key}`] = changes.notificationPreferences[key];
    }
    await ProfileModel.findOneAndUpdate({ userId }, { $set: profileFields, $setOnInsert: { userId } }, { upsert: true, new: true });
  }

  /** The identity as this transaction reads it, which must still be `baseVersion` when one is given. */
  private async currentIdentity(userId: string, baseVersion: string | undefined): Promise<AccountIdentity> {
    const latest = await UserModel.findOne({ _id: userId, deletedAt: null }).lean();
    if (!latest) throw new AppError('Account is no longer available', 401, undefined, 'account_session');
    const latestProfile = await ProfileModel.findOne({ userId }).lean();
    const current = identityOf(latest, latestProfile);
    if (baseVersion !== undefined && accountIdentityVersion(userId, current, latest.accountIdentityRevision ?? 0) !== baseVersion) {
      throw new AppError('Your account identity changed during review. Reload and retry.', 409, undefined, 'stale_version');
    }
    return current;
  }
}
