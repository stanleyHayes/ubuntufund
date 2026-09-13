import { MongoUnitOfWork } from './MongoUnitOfWork.js'
import { UserModel } from '../../../database/models/UserModel.js'
import { KYCVerificationModel } from '../../../database/models/KYCVerificationModel.js'
import { AppError } from '../../inbound/middleware/errorHandler.js'

/** Revalidate after provider balance lookup and before reserving campaign money. */
export class MongoAutomaticPayoutVerification {
  async run<T>(userId: string, work: () => Promise<T>): Promise<T> {
    return new MongoUnitOfWork().run(async () => {
      await this.assertCurrent(userId)
      const locked = await UserModel.updateOne({ _id: userId, deletedAt: null }, { $inc: { publicationWriteVersion: 1 } })
      if (!locked.matchedCount) throw new AppError('Owner account is unavailable.', 409)
      return work()
    })
  }

  async assertCurrent(userId: string): Promise<void> {
    const owner = await UserModel.findOne({ _id: userId, deletedAt: null })
    if (!owner || !owner.emailVerified || owner.verificationLevel < (owner.role === 'organization' ? 3 : 2)) throw new AppError('Current owner verification requires manual review.', 409)
    const record = await KYCVerificationModel.findOne({ userId, verificationType: owner.role === 'organization' ? 'business' : 'identity' }).sort({ createdAt: -1, _id: -1 })
    if (!record || record.status !== 'approved' || !record.expiryDate || record.expiryDate.getTime() <= Date.now()) throw new AppError('Current owner verification requires manual review.', 409)
  }
}
