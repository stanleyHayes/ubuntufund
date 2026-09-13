import type { PayoutRequester } from '../../../../application/use-cases/CreatePayoutRecipientUseCase.js'
import { UserModel } from '../../../database/models/UserModel.js'
import { AppError } from '../../inbound/middleware/errorHandler.js'
import { MongoUnitOfWork } from './MongoUnitOfWork.js'

/** Commit final staff authorization, reservation and processing reference together. */
export class MongoManualPayoutApproval {
  async run<T>(requester: PayoutRequester, work: () => Promise<T>): Promise<T> {
    return new MongoUnitOfWork().run(async () => {
      const staff = await UserModel.updateOne({
        _id: requester.userId, role: 'admin', deletedAt: null,
        ...(requester.authVersion ? { authVersion: requester.authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }),
      }, { $inc: { staffActionVersion: 1 } })
      if (!staff.matchedCount) throw new AppError('Current administrator access is required.', 403)
      return work()
    })
  }
}
