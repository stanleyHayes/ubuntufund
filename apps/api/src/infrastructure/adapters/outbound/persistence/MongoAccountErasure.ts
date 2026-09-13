import { CampaignReviewModel } from '../../../database/models/CampaignReviewModel.js';
import { MfaModel } from '../../../database/models/MfaModel.js';
import { PublicationReviewModel } from '../../../database/models/PublicationReviewModel.js';
import { UserBlockModel } from '../../../database/models/UserBlockModel.js';
import type { AccountErasurePort } from '../../../../domain/ports/outbound/AccountErasurePort.js';
import { AccountDeletionRequestModel } from '../../../database/models/AccountDeletionRequestModel.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { ProfileModel } from '../../../database/models/ProfileModel.js';
import { PushTokenModel } from '../../../database/models/PushTokenModel.js';
import { PasswordResetTokenModel } from '../../../database/models/PasswordResetTokenModel.js';
import { NewsletterSubscriptionModel } from '../../../database/models/NewsletterSubscriptionModel.js';
import { NewsletterConsentTokenModel } from '../../../database/models/NewsletterConsentTokenModel.js';
import { NewsletterConsentEventModel } from '../../../database/models/NewsletterConsentEventModel.js';
import { NotificationModel } from '../../../database/models/NotificationModel.js';
import { ActivityAlertDeliveryModel } from '../../../database/models/ActivityAlertDeliveryModel.js';
import { ActivityAlertPreferenceModel } from '../../../database/models/ActivityAlertPreferenceModel.js';
import { AccountEmailJobModel } from '../../../database/models/AccountEmailJobModel.js';
import { EmailVerificationTokenModel } from '../../../database/models/EmailVerificationTokenModel.js';
import { CreatorProfileModel } from '../../../database/models/CreatorProfileModel.js';
import { CampaignCommentModel } from '../../../database/models/CampaignCommentModel.js';
import { OrganizationMemberModel } from '../../../database/models/OrganizationMemberModel.js';
import { CollaborationModel } from '../../../database/models/CollaborationModel.js';
import { SubscriptionModel } from '../../../database/models/SubscriptionModel.js';
import { DonationModel } from '../../../database/models/DonationModel.js';
import { TipModel } from '../../../database/models/TipModel.js';
import { CampaignModel } from '../../../database/models/CampaignModel.js';
import { LiveSessionModel } from '../../../database/models/LiveSessionModel.js';
import { logger } from '../../../logging/logger.js';
import { PrivateKycDocumentModel } from '../../../database/models/PrivateKycDocumentModel.js';

/** Retryable erasure of operational profile data. Never deletes money or KYC evidence. */
export class MongoAccountErasure implements AccountErasurePort {
  async request(userId: string): Promise<void> {
    const user = await UserModel.findById(userId);
    if (!user) return;
    const creator = await CreatorProfileModel.findOne({ userId });
    const privateDocuments = await PrivateKycDocumentModel.find({ userId }).select('_id');
    await AccountDeletionRequestModel.updateOne({ userId }, { $setOnInsert: {
      userId, contactEmail: user.email,
      mediaUrls: [user.avatarUrl, user.coverUrl, creator?.avatarUrl, ...privateDocuments.map(doc => `kyc://${doc._id}`)].filter(Boolean),
      requestedAt: new Date(), nextReviewAt: new Date(Date.now() + 7 * 86400000),
      status: 'pending',
    } }, { upsert: true });
    // Persist closure before cleanup. All API instances consult this tombstone.
    await UserModel.updateOne({ _id: userId, deletedAt: { $exists: false } }, { $set: { deletedAt: new Date() } });
    try { await this.clean(userId); }
    catch (error) { logger.error({ err: error, userId }, 'Account erasure queued for retry'); }
  }

  async sweepPending(): Promise<number> {
    const requests = await AccountDeletionRequestModel.find({ status: 'pending' }).limit(50);
    let count = 0;
    for (const request of requests) {
      try {
        await UserModel.updateOne({ _id: request.userId, deletedAt: { $exists: false } }, { $set: { deletedAt: request.requestedAt } });
        await this.clean(request.userId); count++;
      } catch (error) { logger.error({ err: error, userId: request.userId }, 'Account erasure retry failed'); }
    }
    return count;
  }

  private async clean(userId: string): Promise<void> {
    const request = await AccountDeletionRequestModel.findOne({ userId });
    if (!request) return;
    await MfaModel.deleteMany({ userId });
    await PublicationReviewModel.deleteMany({ $or: [{ actorId: userId }, { action: 'organization.profile', resourceId: userId }] });
    // Preserve decision provenance/financial references, remove duplicate public-content evidence.
    await CampaignReviewModel.updateMany({ ownerId: userId }, { $unset: { snapshot: 1 }, $set: { snapshotErasedAt: new Date() } });
    await ProfileModel.deleteMany({ userId });
    await UserBlockModel.deleteMany({ $or: [{ userId }, { blockedUserId: userId }] });
    await PushTokenModel.deleteMany({ userId });
    await PasswordResetTokenModel.deleteMany({ userId });
    await EmailVerificationTokenModel.deleteMany({ userId });
    await AccountEmailJobModel.deleteMany({ userId });
    const subscriptions = await NewsletterSubscriptionModel.find({ email: request.contactEmail }).select('_id');
    const subscriptionIds = subscriptions.map(item => String(item._id));
    await NewsletterConsentTokenModel.deleteMany({ subscriptionId: { $in: subscriptionIds } });
    await NewsletterConsentEventModel.deleteMany({ subscriptionId: { $in: subscriptionIds } });
    await AccountEmailJobModel.deleteMany({ newsletterId: { $in: subscriptionIds } });
    await NewsletterSubscriptionModel.deleteMany({ email: request.contactEmail });
    await NotificationModel.deleteMany({ userId });
    await ActivityAlertDeliveryModel.deleteMany({ userId });
    await ActivityAlertPreferenceModel.deleteMany({ userId });
    await CreatorProfileModel.deleteMany({ userId });
    // Hide UGC pending safety/legal-hold review; do not silently destroy reported evidence.
    await CampaignCommentModel.updateMany({ authorId: userId, deletedAt: { $exists: false } }, { $set: { deletedAt: new Date() } });
    await OrganizationMemberModel.updateMany({ $or: [{ userId }, { email: request.contactEmail }, { organizationId: userId }] }, { $set: { status: 'revoked' } });
    await CollaborationModel.updateMany({ userId }, { $set: { status: 'removed', displayName: 'Deleted user' }, $unset: { logoUrl: 1, inviteMessage: 1 } });
    await SubscriptionModel.updateMany({ userId }, { $set: { cancelAtPeriodEnd: true } });
    // Financial values/references remain intact; donor identities are hidden publicly.
    await DonationModel.updateMany({ donorId: userId }, { $set: { isAnonymous: true, publicContentRevokedAt: new Date() }, $unset: { publicContentFingerprint: 1, publicReviewNotes: 1 } });
    await TipModel.updateMany({ supporterUserId: userId }, { $set: { isAnonymous: true, checkoutRevokedAt: new Date() }, $unset: { checkout: 1, requestFingerprint: 1, publicContentFingerprint: 1, publicReviewNotes: 1 } });
    const campaigns = await CampaignModel.find({ creatorId: userId }).select('_id');
    await LiveSessionModel.updateMany({ campaignId: { $in: campaigns.map(c => String(c._id)) }, status: 'active' }, { $set: { status: 'ended', endedAt: new Date(), moderationStoppedAt: new Date(), providerStopPending: true, overlayToken: '', privacyMode: true } });
    await UserModel.updateOne({ _id: userId }, {
      $set: { name: 'Deleted user', email: `deleted-${userId}@invalid.ujimora`, passwordHash: '!deleted!', needsWebsite: false },
      $unset: { avatarUrl: 1, coverUrl: 1, organizationName: 1, organizationType: 1, registrationNumber: 1, website: 1, websiteRequestedAt: 1, websiteRequestWithdrawnAt: 1, country: 1 },
    });
    await AccountDeletionRequestModel.updateOne({ userId, status: 'pending' }, { $set: { status: 'review_required', coreRemovedAt: new Date() } });
  }
}
