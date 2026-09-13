import { hasCurrentLegalAcceptance } from '@ubuntu-fund/types';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

export class MongoCampaignCreation {
  async run<T>(userId: string, authVersion: string, work: () => Promise<T>): Promise<T> {
    return new MongoUnitOfWork().run(async () => {
      const user = await UserModel.findOneAndUpdate({ _id: userId, deletedAt: null,
        ...(authVersion ? { authVersion } : { $or: [{ authVersion: '', }, { authVersion: null }] }),
      }, { $inc: { publicationWriteVersion: 1 } }, { new: true });
      if (!user) throw new AppError('Account authorization changed. Sign in again.', 401);
      if (user.role !== 'admin' && !hasCurrentLegalAcceptance(user.legalAcceptance)) throw new AppError('Accept the current account agreement before publishing.', 428);
      if (await ContentRestrictionModel.exists({ userId })) throw new AppError('Publishing is restricted.', 403);
      return work();
    });
  }
}
