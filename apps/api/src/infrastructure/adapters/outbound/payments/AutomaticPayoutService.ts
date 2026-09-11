import mongoose from 'mongoose'
import {
  AutomaticPayoutPolicyModel,
  AutomaticPayoutBudgetModel,
  automaticPayoutDefaults,
} from '../../../database/models/AutomaticPayoutModel.js'
import { PayoutModel } from '../../../database/models/PayoutModel.js'
import { TransferRecipientModel } from '../../../database/models/TransferRecipientModel.js'
import { UserModel } from '../../../database/models/UserModel.js'
import { CampaignModel } from '../../../database/models/CampaignModel.js'
import { DisputeModel } from '../../../database/models/DisputeModel.js'
import type { ApprovePayoutUseCase } from '../../../../application/use-cases/ApprovePayoutUseCase.js'
import type { PayoutRepositoryPort } from '../../../../domain/ports/outbound/PayoutRepositoryPort.js'
import { toPayoutDto } from '../../../../application/use-cases/mappers/payoutDto.js'
import type { Payout } from '@ubuntu-fund/types'
import type { PayoutsConfig } from '../../../config/index.js'

/** Only new owner requests enter this policy. Existing manual queue entries are never drained automatically. */
export class AutomaticPayoutService {
  constructor(
    private approve: ApprovePayoutUseCase,
    private payouts: PayoutRepositoryPort,
    private config: PayoutsConfig,
  ) {}
  async consider(payout: Payout): Promise<Payout> {
    if (payout.status !== 'PENDING') return payout
    let claimed = false
    let reason = 'Manual review required.'
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        claimed = false
        const policy = await AutomaticPayoutPolicyModel.findById('current').session(session)
        if (!policy?.enabled) {
          reason = 'Automatic payouts are disabled.'
          return
        }
        const current = await PayoutModel.findById(payout.id).session(session)
        if (!current || current.status !== 'PENDING' || current.autoClaimed) return
        if (!current.requestKey) {
          reason = 'Request requires an idempotency key.'
          return
        }
        if (
          current.provider !== 'paystack' ||
          current.currency !== 'GHS' ||
          current.type !== 'standard'
        ) {
          reason = 'This destination or service requires manual review.'
          return
        }
        const max = Math.min(
          policy.maxAmount ?? automaticPayoutDefaults.maxAmount,
          this.config.maxTransferAmount,
        )
        if (
          current.amount > max ||
          (this.config.dualApprovalAmount > 0 && current.amount >= this.config.dualApprovalAmount)
        ) {
          reason = 'Amount exceeds automatic approval limits.'
          return
        }
        const campaign = await CampaignModel.findById(current.campaignId).session(session)
        if (
          !campaign ||
          campaign.deletedAt ||
          !['funded', 'completed', 'active'].includes(campaign.status) ||
          campaign.creatorId !== current.requestedBy
        ) {
          reason = 'Campaign requires review.'
          return
        }
        const owner = await UserModel.findById(current.requestedBy).session(session)
        if (!owner || owner.deletedAt || !owner.emailVerified || owner.verificationLevel < 2) {
          reason = 'Owner verification is required.'
          return
        }
        const dispute = await DisputeModel.exists({
          campaignId: current.campaignId,
          status: { $in: ['open', 'under_review'] },
        }).session(session)
        if (dispute) {
          reason = 'Campaign has an unresolved dispute.'
          return
        }
        const recipient = await TransferRecipientModel.findById(current.recipientId).session(
          session,
        )
        if (
          !recipient ||
          recipient.campaignId !== current.campaignId ||
          recipient.createdBy !== current.requestedBy
        ) {
          reason = 'Destination ownership requires manual review.'
          return
        }
        if (
          recipient.type === 'mobile_money' &&
          current.amount > (policy.mobileMoneyMaxAmount ?? 250)
        ) {
          reason = 'Amount exceeds automatic MoMo limit.'
          return
        }
        const cutoff =
          Date.now() -
          (recipient.type === 'mobile_money'
            ? (policy.mobileMoneyReviewMaxAgeHours ?? 24) * 3600000
            : (policy.reviewMaxAgeDays ?? 30) * 86400000)
        if (
          !recipient.reviewedBy ||
          !recipient.reviewNote ||
          !recipient.reviewedAt ||
          recipient.reviewedAt.getTime() < cutoff ||
          !recipient.resolvedAccountName
        ) {
          reason = 'Destination needs a current ownership review.'
          return
        }
        const previous = await PayoutModel.exists({
          recipientId: current.recipientId,
          requestedBy: current.requestedBy,
          status: 'PAID',
          settlementApplied: true,
          approvedBy: { $exists: true, $ne: 'system:auto-payout' },
        }).session(session)
        if (!previous) {
          reason = 'First payout to this destination requires manual review.'
          return
        }
        // Serialize policy changes and all automatic budget claims in this transaction.
        await AutomaticPayoutPolicyModel.updateOne(
          { _id: 'current', revision: policy.revision, enabled: true },
          { $inc: { claims: 1 } },
          { session },
        )
        const day = new Date().toISOString().slice(0, 10)
        const amount = Math.round(current.amount * 100)
        for (const [key, limit] of [
          [`${day}:owner:${current.requestedBy}`, policy.dailyOwnerLimit ?? 1000],
          [`${day}:platform`, policy.dailyPlatformLimit ?? 5000],
        ] as const) {
          const budget = await AutomaticPayoutBudgetModel.findById(key).session(session)
          if ((budget?.usedMinor ?? 0) + amount > Math.round(limit * 100))
            throw new Error('Automatic daily limit reached; awaiting manual review.')
          await AutomaticPayoutBudgetModel.updateOne(
            { _id: key },
            { $inc: { usedMinor: amount } },
            { upsert: true, session },
          )
        }
        const claim = await PayoutModel.updateOne(
          { _id: current._id, status: 'PENDING', autoClaimed: { $ne: true } },
          {
            $set: {
              autoClaimed: true,
              automationReason: `Automatic policy v${policy.revision}: reviewed destination and limits passed.`,
            },
          },
          { session },
        )
        claimed = claim.modifiedCount === 1
      })
    } catch {
      // `claimed` was assigned inside the callback, but withTransaction rethrows
      // when the COMMIT fails — the callback having finished says nothing about
      // whether its writes survived. Leaving the flag set initiated a real
      // transfer whose autoClaimed marker and daily-budget increments had both
      // been rolled back, making that amount free budget. Falling back to manual
      // review is the safe direction.
      claimed = false
      reason =
        'Automatic checks could not complete or a daily limit was reached. Manual review required.'
    } finally {
      await session.endSession()
    }
    if (claimed) {
      // Budget remains consumed on failure or unknown outcome: retries cannot evade daily limits.
      try {
        return await this.approve.executeAutomatic(payout.id)
      } catch {
        // executeAutomatic has already moved the payout off PENDING, so the
        // PENDING-filtered write below matched nothing and the payout kept its
        // stale "reviewed destination and limits passed" reason — a stuck or
        // failed transfer labelled as having passed every check. Write it by id.
        await PayoutModel.updateOne(
          { _id: payout.id },
          {
            $set: {
              automationReason:
                'Automatic initiation needs attention. Check provider status before retrying.',
            },
          },
        )
        const attempted = await this.payouts.findById(payout.id)
        return attempted ? toPayoutDto(attempted) : payout
      }
    }
    await PayoutModel.updateOne(
      { _id: payout.id, status: 'PENDING' },
      { $set: { automationReason: reason } },
    )
    const latest = await this.payouts.findById(payout.id)
    return latest ? toPayoutDto(latest) : payout
  }
}
