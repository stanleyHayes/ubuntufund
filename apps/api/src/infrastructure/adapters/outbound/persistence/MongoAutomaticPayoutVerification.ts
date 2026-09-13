import { PayoutModel } from '../../../database/models/PayoutModel.js'
import { DisputeModel } from '../../../database/models/DisputeModel.js'
import { TransferRecipientModel } from '../../../database/models/TransferRecipientModel.js'
import { AutomaticPayoutPolicyModel, AutomaticPayoutBudgetModel, automaticPayoutDefaults } from '../../../database/models/AutomaticPayoutModel.js'
import type { PayoutEntity } from '../../../../domain/entities/Payout.js'
import { campaignNeedsEarlyCashout, isEarlyWithdrawal } from '../../../../application/services/payoutFee.js'
import { CampaignModel } from '../../../database/models/CampaignModel.js'
import { MongoUnitOfWork } from './MongoUnitOfWork.js'
import { UserModel } from '../../../database/models/UserModel.js'
import { KYCVerificationModel } from '../../../database/models/KYCVerificationModel.js'
import { AppError } from '../../inbound/middleware/errorHandler.js'

/** Revalidate after provider balance lookup and before reserving campaign money. */
export class MongoAutomaticPayoutVerification {
  async run<T>(userId: string, work: () => Promise<T>, payout?: Pick<PayoutEntity, 'id' | 'campaignId' | 'type' | 'recipientId' | 'currency' | 'amount'> & { recipientCode: string }): Promise<T> {
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
        if (await DisputeModel.exists({ campaignId: payout.campaignId, status: { $in: ['open', 'under_review'] } }))
          throw new AppError('Campaign has an unresolved dispute; manual review required.', 409)
        const policy = await AutomaticPayoutPolicyModel.findOneAndUpdate(
          { _id: 'current', enabled: true }, { $inc: { consumptionWriteVersion: 1 } }, { new: true, timestamps: false },
        )
        if (!policy || payout.amount > (policy.maxAmount ?? automaticPayoutDefaults.maxAmount))
          throw new AppError('Automatic payout policy changed; manual review required.', 409)
        const day = new Date().toISOString().slice(0, 10)
        const claimed = await PayoutModel.findOne({
          _id: payout.id, status: 'PENDING', autoClaimed: true, autoClaimDay: day,
          campaignId: payout.campaignId, requestedBy: userId, recipientId: payout.recipientId,
          currency: payout.currency, amount: payout.amount, type: payout.type,
        })
        if (!claimed) throw new AppError('Automatic budget claim is unavailable or expired; manual review required.', 409)
        const amountMinor = Math.round(payout.amount * 100)
        for (const [key, limit] of [
          [`${day}:owner:${userId}`, policy.dailyOwnerLimit ?? automaticPayoutDefaults.dailyOwnerLimit],
          [`${day}:platform`, policy.dailyPlatformLimit ?? automaticPayoutDefaults.dailyPlatformLimit],
        ] as const) {
          const budget = await AutomaticPayoutBudgetModel.findOneAndUpdate(
            { _id: key }, { $inc: { consumptionWriteVersion: 1 } }, { new: true },
          )
          if (!budget || !Number.isSafeInteger(budget.usedMinor) || budget.usedMinor < amountMinor || budget.usedMinor > Math.round(limit * 100))
            throw new AppError('Automatic daily budget requires manual review.', 409)
        }
        const recipient = await TransferRecipientModel.findOneAndUpdate(
          { _id: payout.recipientId }, { $inc: { payoutWriteVersion: 1 } }, { new: true },
        )
        if (!recipient || recipient.campaignId !== payout.campaignId || recipient.createdBy !== userId ||
            recipient.currency !== payout.currency || recipient.recipientCode !== payout.recipientCode)
          throw new AppError('Payout destination changed; manual review required.', 409)
        const mobile = recipient.type === 'mobile_money'
        const cutoff = Date.now() - (mobile
          ? (policy.mobileMoneyReviewMaxAgeHours ?? automaticPayoutDefaults.mobileMoneyReviewMaxAgeHours) * 3600000
          : (policy.reviewMaxAgeDays ?? automaticPayoutDefaults.reviewMaxAgeDays) * 86400000)
        if ((mobile && payout.amount > (policy.mobileMoneyMaxAmount ?? automaticPayoutDefaults.mobileMoneyMaxAmount)) ||
            !recipient.reviewedBy || !recipient.reviewNote || !recipient.resolvedAccountName ||
            !recipient.reviewedAt || recipient.reviewedAt.getTime() < cutoff)
          throw new AppError('Destination needs a current ownership review.', 409)
        // Lock the exact settled manual history row consumed by this decision.
        // A reversal or correction after our snapshot must retry this check.
        const previous = await PayoutModel.findOneAndUpdate({
          _id: { $ne: payout.id }, recipientId: payout.recipientId,
          requestedBy: userId, campaignId: payout.campaignId, currency: payout.currency,
          status: 'PAID', settlementApplied: true,
          approvedBy: { $exists: true, $nin: ['', null, 'system:auto-payout'] },
        }, { $inc: { historyWriteVersion: 1 } }, { new: true, timestamps: false })
        if (!previous) throw new AppError('A settled manual payout to this destination is required; manual review required.', 409)

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
