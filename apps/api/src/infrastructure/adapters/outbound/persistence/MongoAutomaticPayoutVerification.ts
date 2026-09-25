import { PayoutModel } from '../../../database/models/PayoutModel.js'
import { DisputeModel } from '../../../database/models/DisputeModel.js'
import { TransferRecipientModel } from '../../../database/models/TransferRecipientModel.js'
import { AutomaticPayoutPolicyModel, AutomaticPayoutBudgetModel, automaticPayoutDefaults } from '../../../database/models/AutomaticPayoutModel.js'
import type { PayoutEntity } from '../../../../domain/entities/Payout.js'
import { campaignNeedsEarlyCashout, isEarlyWithdrawal } from '../../../../application/services/payoutFee.js'
import { CampaignModel } from '../../../database/models/CampaignModel.js'
import { MongoUnitOfWork } from './MongoUnitOfWork.js'
import { UserModel } from '../../../database/models/UserModel.js'
import { assertCurrentOwnerVerification, PAYABLE_CAMPAIGN_STATUSES } from './MongoPayoutEligibility.js'
import { AppError } from '../../inbound/middleware/errorHandler.js'

/** How long an automatic budget claim may be verified after it was taken. */
export const AUTOMATIC_CLAIM_TTL_MS = 15 * 60_000

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
        // Shared with the manual rail and AutomaticPayoutService.consider, so the
        // expiry sweep flipping FUNDED -> EXPIRED mid-flight cannot fail a claim.
        if (!campaign || campaign.deletedAt || campaign.creatorId !== userId ||
            !PAYABLE_CAMPAIGN_STATUSES.includes(campaign.status))
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
        // Validate the claim against the day it was TAKEN, not today's date:
        // a claim made at 23:59:59 UTC and verified after midnight (the
        // provider balance lookup sits in between) is still the same claim
        // against the same day's budget. Freshness is bounded explicitly.
        const claimed = await PayoutModel.findOne({
          _id: payout.id, status: 'PENDING', autoClaimed: true,
          autoClaimedAt: { $gte: new Date(Date.now() - AUTOMATIC_CLAIM_TTL_MS) },
          campaignId: payout.campaignId, requestedBy: userId, recipientId: payout.recipientId,
          currency: payout.currency, amount: payout.amount, type: payout.type,
        })
        const day = claimed?.autoClaimDay
        if (!claimed || !day || !/^\d{4}-\d{2}-\d{2}$/.test(day))
          throw new AppError('Automatic budget claim is unavailable or expired; manual review required.', 409)
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
        const fields = ['recipientCode', 'accountNumber', 'bankCode', 'currency', 'type', 'campaignId', 'createdBy'] as const
        const latestReviews = new Map<string, NonNullable<typeof recipient.reviews>[number]>()
        for (const review of recipient.reviews ?? []) latestReviews.set(JSON.stringify([review.payoutId, review.reviewedBy]), review)
        const reviewedDestinations = [...latestReviews.values()].filter(review =>
          /^[a-f0-9]{24}$/i.test(review.payoutId) && review.destination &&
          fields.every(field => typeof recipient[field] === 'string' && recipient[field].length > 0 && review.destination![field] === recipient[field]),
        )
        if (!reviewedDestinations.length)
          throw new AppError('No settled manual history for the reviewed account details; manual review required.', 409)
        // Lock the exact settled manual history row consumed by this decision.
        // A reversal or correction after our snapshot must retry this check.
        const previous = await PayoutModel.findOneAndUpdate({
          _id: { $ne: payout.id }, recipientId: payout.recipientId,
          $or: reviewedDestinations.map(review => ({ _id: review.payoutId, approvedBy: review.reviewedBy })),
          requestedBy: userId, campaignId: payout.campaignId, currency: payout.currency,
          status: 'PAID', settlementApplied: true,
          approvedBy: { $exists: true, $nin: ['', null, 'system:auto-payout'] },
        }, { $inc: { historyWriteVersion: 1 } }, { new: true, timestamps: false })
        if (previous?.firstApprovedBy && !reviewedDestinations.some(review => review.payoutId === String(previous._id) && review.reviewedBy === previous.firstApprovedBy))
          throw new AppError('Prior maker review does not match this destination; manual review required.', 409)
        if (!previous) throw new AppError('A settled manual payout to this destination is required; manual review required.', 409)

      }
      return work()
    })
  }

  async assertCurrent(userId: string): Promise<void> {
    const owner = await UserModel.findOne({ _id: userId, deletedAt: null }).select('emailVerified')
    if (owner && !owner.emailVerified) throw new AppError('Verify your email address to enable automatic payouts.', 409)
    // The same money-out gate the manual and creator rails use.
    await assertCurrentOwnerVerification(userId, { message: 'Current owner verification requires manual review.' })
  }
}
