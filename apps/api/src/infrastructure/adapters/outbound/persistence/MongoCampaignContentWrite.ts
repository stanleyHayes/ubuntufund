import { hasCurrentLegalAcceptance } from '@ubuntu-fund/types';
import type { CampaignContentWritePort } from '../../../../domain/ports/outbound/CampaignContentWritePort.js';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { CampaignModel } from '../../../database/models/CampaignModel.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import { OrganizationMemberModel } from '../../../database/models/OrganizationMemberModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

export class MongoCampaignContentWrite implements CampaignContentWritePort {
  async run<T>(actorId: string, authVersion: string, campaignId: string, ownerId: string, work: () => Promise<T>): Promise<T> {
    return new MongoUnitOfWork().run(async () => {
      for (const userId of [...new Set([actorId, ownerId])].sort()) {
        const user = await UserModel.findOneAndUpdate({ _id: userId, deletedAt: null,
          ...(userId === actorId ? (authVersion ? { authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }) : { role: 'organization' }),
        }, { $inc: { publicationWriteVersion: 1 } }, { new: true });
        if (!user) throw new AppError('Publishing authorization changed. Sign in and refresh before submitting.', 401);
        if (userId === actorId && user.role !== 'admin' && !hasCurrentLegalAcceptance(user.legalAcceptance)) throw new AppError('Accept the current agreement before publishing.', 428);
      }
      if (await ContentRestrictionModel.exists({ userId: { $in: [actorId, ownerId] } })) throw new AppError('Publishing is restricted.', 403);
      if (actorId !== ownerId) {
        const member = await OrganizationMemberModel.updateOne({ organizationId: ownerId, userId: actorId, status: 'active', role: { $in: ['admin', 'editor'] } }, { $inc: { profileWriteVersion: 1 } }, { timestamps: false });
        if (!member.matchedCount) throw new AppError('Your organization publishing permission changed.', 403);
      }
      const campaign = await CampaignModel.updateOne({ _id: campaignId, creatorId: ownerId, deletedAt: null }, { $inc: { commentCreationWriteVersion: 1 } }, { timestamps: false });
      if (!campaign.matchedCount) throw new AppError('The campaign is no longer available for this update.', 409);
      return work();
    });
  }
}
