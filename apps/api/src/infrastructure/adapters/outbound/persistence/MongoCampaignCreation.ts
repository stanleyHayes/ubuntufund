import { hasCurrentLegalAcceptance } from '@ubuntu-fund/types';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

/**
 * The publisher fence: one transaction that first writes the author's account
 * (open, with the credential version the request was authenticated with),
 * then checks the current agreement and any publishing restriction, and only
 * then runs `work`. Every refusal carries a publication fence code
 * (PUBLICATION_FENCE_CODES), so publishing on approval can tell it from a
 * failure; the HTTP response is unchanged.
 */
export class MongoCampaignCreation {
  async run<T>(userId: string, authVersion: string, work: () => Promise<T>): Promise<T> {
    return new MongoUnitOfWork().run(async () => {
      const user = await UserModel.findOneAndUpdate({ _id: userId, deletedAt: null,
        ...(authVersion ? { authVersion } : { $or: [{ authVersion: '', }, { authVersion: null }] }),
      }, { $inc: { publicationWriteVersion: 1 } }, { new: true });
      if (!user) throw new AppError('Account authorization changed. Sign in again.', 401, undefined, 'account_session');
      if (user.role !== 'admin' && !hasCurrentLegalAcceptance(user.legalAcceptance)) throw new AppError('Accept the current account agreement before publishing.', 428, undefined, 'terms_required');
      if (await ContentRestrictionModel.exists({ userId })) throw new AppError('Publishing is restricted.', 403, undefined, 'publishing_restricted');
      return work();
    });
  }
}
