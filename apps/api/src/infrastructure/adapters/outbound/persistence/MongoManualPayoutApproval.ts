import type { PayoutEntity } from '../../../../domain/entities/Payout.js'
import { campaignNeedsEarlyCashout, isEarlyWithdrawal } from '../../../../application/services/payoutFee.js'
import { CampaignModel } from '../../../database/models/CampaignModel.js'
import type { PayoutRequester } from '../../../../application/use-cases/CreatePayoutRecipientUseCase.js'
import { UserModel } from '../../../database/models/UserModel.js'
import { AppError } from '../../inbound/middleware/errorHandler.js'
import { MongoUnitOfWork } from './MongoUnitOfWork.js'

/** Commit final staff authorization, reservation and processing reference together. */
export class MongoManualPayoutApproval {
  async run<T>(requester: PayoutRequester, work: () => Promise<T>, payout?: Pick<PayoutEntity, 'campaignId' | 'type'>): Promise<T> {
    return new MongoUnitOfWork().run(async () => {
      const staff = await UserModel.updateOne({
        _id: requester.userId, role: 'admin', deletedAt: null,
        ...(requester.authVersion ? { authVersion: requester.authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }),
      }, { $inc: { staffActionVersion: 1 } })
      if (!staff.matchedCount) throw new AppError('Current administrator access is required.', 403)
      if (payout) {
        const campaign = await CampaignModel.findOneAndUpdate(
          { _id: payout.campaignId }, { $inc: { payoutWriteVersion: 1 } },
          { new: true, timestamps: false },
        )
        if (!campaign) throw new AppError('Campaign not found', 404)
        if (campaignNeedsEarlyCashout({
          endDate: campaign.endDate,
          raisedAmount: { amount: campaign.raisedAmount },
          goalAmount: { amount: campaign.goalAmount },
        }) && !isEarlyWithdrawal(payout.type))
          throw new AppError('Campaign eligibility changed. Request early cashout and review its additional fee.', 409)
      }
      return work()
    })
  }
}
