import { UserModel } from '../../../database/models/UserModel.js'
import { AffiliateModel } from '../../../database/models/AffiliateModel.js'
import { MongoUnitOfWork } from './MongoUnitOfWork.js'
import { AppError } from '../../inbound/middleware/errorHandler.js'
import type { AffiliatePayoutApprover } from '../../../../application/use-cases/ApproveAffiliatePayoutUseCase.js'
import { assertCurrentOwnerVerification } from './MongoPayoutEligibility.js'

export class MongoAffiliatePayoutApproval {
  async run<T>(approver: AffiliatePayoutApprover, context: { affiliateId: string; ownerId: string; recipientCode: string }, work: () => Promise<T>): Promise<T> {
    return new MongoUnitOfWork().run(async () => {
      const staff = await UserModel.updateOne({
        _id: approver.userId, role: 'admin', deletedAt: null,
        ...(approver.authVersion ? { authVersion: approver.authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }),
      }, { $inc: { staffActionVersion: 1 } })
      if (!staff.matchedCount) throw new AppError('Current administrator access is required.', 403)
      if (context.ownerId === approver.userId)
        throw new AppError('Another administrator must approve your own affiliate payout.', 403)
      const affiliate = await AffiliateModel.findOneAndUpdate({
        _id: context.affiliateId, userId: context.ownerId, status: 'active', recipientCode: context.recipientCode,
      }, { $inc: { payoutWriteVersion: 1 } }, { new: true, timestamps: false })
      if (!affiliate) throw new AppError('Affiliate eligibility or destination changed; review the payout again.', 409)
      const owner = await UserModel.updateOne({ _id: context.ownerId, deletedAt: null }, { $inc: { publicationWriteVersion: 1 } })
      if (!owner.matchedCount) throw new AppError('Affiliate owner account is unavailable.', 409)
      // Same money-out gate as every other external rail, re-checked at the
      // write boundary: a lapsed or superseded verification stops the transfer.
      await assertCurrentOwnerVerification(context.ownerId)
      return work()
    })
  }
}
