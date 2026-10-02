import { hasCurrentLegalAcceptance } from '@ubuntu-fund/types';
import type { CampaignContentWritePort } from '../../../../domain/ports/outbound/CampaignContentWritePort.js';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { CampaignModel } from '../../../database/models/CampaignModel.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import { OrganizationMemberModel } from '../../../database/models/OrganizationMemberModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

/** The author's own account (same credential version), or, for a teammate, the organization they publish for. */
async function fenceAccount(userId: string, actorId: string, authVersion: string): Promise<void> {
  const isActor = userId === actorId;
  const credential = authVersion ? { authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] };
  const user = await UserModel.findOneAndUpdate({ _id: userId, deletedAt: null, ...(isActor ? credential : { role: 'organization' }) },
    { $inc: { publicationWriteVersion: 1 } }, { new: true });
  if (!user) throw new AppError('Publishing authorization changed. Sign in and refresh before submitting.', 401, undefined, isActor ? 'account_session' : 'permission_changed');
  if (isActor && user.role !== 'admin' && !hasCurrentLegalAcceptance(user.legalAcceptance)) throw new AppError('Accept the current agreement before publishing.', 428, undefined, 'terms_required');
}

/**
 * The campaign update writer: in one transaction, the author's account (open,
 * same credential version, current agreement) and, for a teammate, the owning
 * organization's account; restrictions on either; the teammate's active
 * admin or editor membership; the campaign (same owner, not deleted); then
 * `work`. Used by the owner's and the organization's update routes and by
 * publishing on approval. Each refusal carries a publication fence code
 * (PUBLICATION_FENCE_CODES); the HTTP response is unchanged.
 */
export class MongoCampaignContentWrite implements CampaignContentWritePort {
  async run<T>(actorId: string, authVersion: string, campaignId: string, ownerId: string, work: () => Promise<T>): Promise<T> {
    return new MongoUnitOfWork().run(async () => {
      // Sequential, in a stable order: each write belongs to the one transaction.
      for (const userId of [...new Set([actorId, ownerId])].sort()) await fenceAccount(userId, actorId, authVersion);
      // The same answer either way; publishing on approval tells the author whose account it is.
      if (await ContentRestrictionModel.exists({ userId: actorId })) throw new AppError('Publishing is restricted.', 403, undefined, 'publishing_restricted');
      if (actorId !== ownerId && await ContentRestrictionModel.exists({ userId: ownerId })) throw new AppError('Publishing is restricted.', 403, undefined, 'organizer_restricted');
      if (actorId !== ownerId) {
        const member = await OrganizationMemberModel.updateOne({ organizationId: ownerId, userId: actorId, status: 'active', role: { $in: ['admin', 'editor'] } }, { $inc: { profileWriteVersion: 1 } }, { timestamps: false });
        if (!member.matchedCount) throw new AppError('Your organization publishing permission changed.', 403, undefined, 'permission_changed');
      }
      const campaign = await CampaignModel.updateOne({ _id: campaignId, creatorId: ownerId, deletedAt: null }, { $inc: { commentCreationWriteVersion: 1 } }, { timestamps: false });
      if (!campaign.matchedCount) throw new AppError('The campaign is no longer available for this update.', 409, undefined, 'campaign_unavailable');
      return work();
    });
  }
}
