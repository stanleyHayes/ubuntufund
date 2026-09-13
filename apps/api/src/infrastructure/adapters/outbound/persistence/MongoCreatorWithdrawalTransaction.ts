import type { CreatorWithdrawalTransactionPort } from '../../../../domain/ports/outbound/CreatorWithdrawalTransactionPort.js';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

export class MongoCreatorWithdrawalTransaction implements CreatorWithdrawalTransactionPort {
  async run<T>(userId: string, authVersion: string, work: () => Promise<T>): Promise<T> {
    return new MongoUnitOfWork().run(async () => {
      const owner = await UserModel.updateOne({
        _id: userId, deletedAt: null,
        ...(authVersion ? { authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }),
      }, { $inc: { publicationWriteVersion: 1 } });
      if (!owner.matchedCount) throw new AppError('Account authorization changed. Sign in again.', 401);
      return work();
    });
  }
}
