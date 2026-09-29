import { TransferRecipientModel } from '../../../database/models/TransferRecipientModel.js'
import type { PayoutEntity } from '../../../../domain/entities/Payout.js'
import { campaignNeedsEarlyCashout, isEarlyWithdrawal } from '../../../../application/services/payoutFee.js'
import { CampaignModel } from '../../../database/models/CampaignModel.js'
import type { PayoutRequester } from '../../../../application/use-cases/CreatePayoutRecipientUseCase.js'
import { SELF_APPROVAL_MESSAGE } from '../../../../application/use-cases/ApprovePayoutUseCase.js'
import { UserModel } from '../../../database/models/UserModel.js'
import { AppError } from '../../inbound/middleware/errorHandler.js'
import { MongoUnitOfWork } from './MongoUnitOfWork.js'
import { assertCampaignPayable, assertCurrentOwnerVerification } from './MongoPayoutEligibility.js'
import { NO_PAYOUT_AUTHORITY_MESSAGE, payoutAuthorityOf } from '../../../../domain/services/campaignPayoutAuthority.js'

/** Commit final staff authorization, reservation and processing reference together. */
export class MongoManualPayoutApproval {
  async run<T>(requester: PayoutRequester, work: () => Promise<T>, payout?: Pick<PayoutEntity, 'id' | 'campaignId' | 'type' | 'recipientId' | 'requestedBy' | 'currency'> & { firstApprovedBy?: string; recipientCode: string }): Promise<T> {
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
        // Segregation of duties, re-checked at the write boundary: no admin
        // releases money from a campaign they own or a payout they requested.
        const authority = payoutAuthorityOf(campaign)
        if (campaign.creatorId === requester.userId || authority === requester.userId || payout.requestedBy === requester.userId)
          throw new AppError(SELF_APPROVAL_MESSAGE, 403)
        // Consent can be revoked or reassigned while a request waits.
        if (!authority) throw new AppError(NO_PAYOUT_AUTHORITY_MESSAGE, 409)
        // A blocked/deleted campaign, an open dispute or lapsed owner KYC stops
        // the money even for a request queued while everything was in order.
        await assertCampaignPayable(campaign)
        await assertCurrentOwnerVerification(authority)
        if (campaignNeedsEarlyCashout({
          endDate: campaign.endDate,
          raisedAmount: { amount: campaign.raisedAmount },
          goalAmount: { amount: campaign.goalAmount },
        }) && !isEarlyWithdrawal(payout.type))
          throw new AppError('Campaign eligibility changed. Request early cashout and review its additional fee.', 409)
        const recipient = await TransferRecipientModel.findOneAndUpdate(
          { _id: payout.recipientId }, { $inc: { payoutWriteVersion: 1 } }, { new: true },
        )
        if (!recipient || recipient.campaignId !== payout.campaignId || recipient.createdBy !== payout.requestedBy ||
            recipient.createdBy !== authority || recipient.currency !== payout.currency || recipient.recipientCode !== payout.recipientCode)
          throw new AppError('Payout destination changed; review it again before approving.', 409)
        const fields = ['recipientCode', 'accountNumber', 'bankCode', 'currency', 'type', 'campaignId', 'createdBy'] as const
        for (const reviewer of new Set([requester.userId, payout.firstApprovedBy].filter(Boolean))) {
          const review = [...(recipient.reviews ?? [])].reverse().find(item => item.payoutId === payout.id && item.reviewedBy === reviewer)
          if (!review?.destination || fields.some(field => review.destination![field] !== recipient[field]))
            throw new AppError('Destination no longer matches its payout review; a fresh review is required.', 409)
        }

      }
      return work()
    })
  }
}
