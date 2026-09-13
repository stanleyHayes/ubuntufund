import type { PayoutEntity } from '../../../../domain/entities/Payout.js'
import { campaignNeedsEarlyCashout, isEarlyWithdrawal } from '../../../../application/services/payoutFee.js'
import { CampaignModel } from '../../../database/models/CampaignModel.js'
import { MongoUnitOfWork } from './MongoUnitOfWork.js'
import { UserModel } from '../../../database/models/UserModel.js'
import { KYCVerificationModel } from '../../../database/models/KYCVerificationModel.js'
import { AppError } from '../../inbound/middleware/errorHandler.js'

/** Revalidate after provider balance lookup and before reserving campaign money. */
export class MongoAutomaticPayoutVerification {
  async run<T>(userId: string, work: () => Promise<T>, payout?: Pick<PayoutEntity, 'campaignId' | 'type'>): Promise<T> {
    return new MongoUnitOfWork().run(async () => {
      await this.assertCurrent(userId)
      const locked = await UserModel.updateOne({ _id: userId, deletedAt: null }, { $inc: { publicationWriteVersion: 1 } })
      if (!locked.matchedCount) throw new AppError('Owner account is unavailable.', 409)
      if (payout) {
        const campaign = await CampaignModel.findOneAndUpdate(
          { _id: payout.campaignId }, { $inc: { payoutWriteVersion: 1 } },
          { new: true, timestamps: false },
        )
        if (!campaign || campaign.deletedAt || campaign.creatorId !== userId ||
            !['funded', 'completed', 'active'].includes(campaign.status))
          throw new AppError('Current campaign eligibility requires manual review.', 409)
        if (campaignNeedsEarlyCashout({
          endDate: campaign.endDate,
          raisedAmount: { amount: campaign.raisedAmount },
          goalAmount: { amount: campaign.goalAmount },
        }) && !isEarlyWithdrawal(payout.type))
          throw new AppError('Campaign cashout eligibility changed; manual review required.', 409)
      }
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
