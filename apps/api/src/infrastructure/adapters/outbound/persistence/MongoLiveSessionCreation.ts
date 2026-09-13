import { hasCurrentLegalAcceptance } from '@ubuntu-fund/types';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { CampaignModel } from '../../../database/models/CampaignModel.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';
import type { LiveSessionCreationPort } from '../../../../domain/ports/outbound/LiveSessionCreationPort.js';

export class MongoLiveSessionCreation implements LiveSessionCreationPort {
  async run<T>(campaignId: string, ownerId: string, userId: string, authVersion: string, work: () => Promise<T>): Promise<T> {
    return new MongoUnitOfWork().run(async () => {
      for (const id of [...new Set([ownerId, userId])].sort()) {
        const user = await UserModel.findOneAndUpdate({ _id: id, deletedAt: null,
          ...(id === userId ? authVersion ? { authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] } : {}),
        }, { $inc: { publicationWriteVersion: 1 } }, { new: true });
        if (!user) throw new AppError('Account authorization changed. Sign in again.', 401);
        if (id === userId && userId !== ownerId && user.role !== 'admin') throw new AppError('Only the campaign owner or a current administrator can start this session.', 403);
        if (user.role !== 'admin' && !hasCurrentLegalAcceptance(user.legalAcceptance)) throw new AppError('Accept the current account agreement before broadcasting.', 428);
        if (await ContentRestrictionModel.exists({ userId: id })) throw new AppError('Publishing is restricted.', 403);
      }
      const campaign = await CampaignModel.updateOne({ _id: campaignId, creatorId: ownerId, status: { $in: ['active', 'funded'] }, deletedAt: null, endDate: { $gte: new Date() } }, { $inc: { liveCreationWriteVersion: 1 } }, { timestamps: false });
      if (!campaign.matchedCount) throw new AppError('The campaign is no longer available to go live.', 409);
      return work();
    });
  }
}
