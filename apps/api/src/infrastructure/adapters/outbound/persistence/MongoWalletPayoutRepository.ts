import mongoose, { type ClientSession } from 'mongoose'
import {
  WalletType,
  TransactionType,
  TransactionStatus,
  type LedgerAccountKind,
} from '@ubuntu-fund/types'
import type { WalletPayoutPort } from '../../../../domain/ports/outbound/WalletPayoutPort.js'
import { AppError } from '../../inbound/middleware/errorHandler.js'
import { PayoutModel } from '../../../database/models/PayoutModel.js'
import { CampaignBalanceModel } from '../../../database/models/CampaignBalanceModel.js'
import { CreatorBalanceModel } from '../../../database/models/CreatorBalanceModel.js'
import { CreatorPayoutModel } from '../../../database/models/CreatorPayoutModel.js'
import { WalletModel } from '../../../database/models/WalletModel.js'
import { WalletTransactionModel } from '../../../database/models/WalletTransactionModel.js'
import { JournalEntryModel } from '../../../database/models/JournalEntryModel.js'
import { JournalLineModel } from '../../../database/models/JournalLineModel.js'
import { LedgerAccountModel } from '../../../database/models/LedgerAccountModel.js'

export class MongoWalletPayoutRepository implements WalletPayoutPort {
  private async credit(
    session: ClientSession,
    userId: string,
    sourceId: string,
    reference: string,
    amount: number,
    fee: number,
    net: number,
    source: 'campaign' | 'creator',
  ) {
    if (
      ![amount, fee, net].every((n) => Number.isFinite(n) && n >= 0) ||
      net <= 0 ||
      Math.round(amount * 100) !== Math.round(fee * 100) + Math.round(net * 100)
    )
      throw new AppError('Invalid wallet transfer amounts', 422)
    const wallet = await WalletModel.findOneAndUpdate(
      { userId, type: WalletType.LOCAL, currency: 'GHS' },
      { $setOnInsert: { balance: 0 } },
      { upsert: true, new: true, session },
    )
    await WalletModel.updateOne(
      { _id: wallet._id },
      [{ $set: { balance: { $round: [{ $add: ['$balance', net] }, 2] }, updatedAt: new Date() } }],
      { session },
    )
    await WalletTransactionModel.create(
      [
        {
          walletId: wallet.id,
          userId,
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.COMPLETED,
          amount: net,
          currency: 'GHS',
          reference,
          metadata: { source, sourceId, grossAmount: amount, fee, provider: 'ujimora_wallet' },
        },
      ],
      { session },
    )
    const [entry] = await JournalEntryModel.create(
      [
        {
          externalRef: reference,
          memo: `${source} earnings transferred to Ujimora Wallet`,
          currency: 'GHS',
        },
      ],
      { session },
    )
    const lines: {
      kind: LedgerAccountKind
      owner: string
      direction: 'debit' | 'credit'
      amount: number
    }[] = [
      {
        kind: 'beneficiary',
        owner: source === 'creator' ? `creator:${userId}` : sourceId,
        direction: 'debit',
        amount,
      },
      { kind: 'wallet', owner: wallet.id, direction: 'credit', amount: net },
      { kind: 'platform_fee', owner: 'platform', direction: 'credit', amount: fee },
    ]
    for (const line of lines) {
      if (!line.amount) continue
      const account = await LedgerAccountModel.findOneAndUpdate(
        { kind: line.kind, ownerId: line.owner, currency: 'GHS' },
        { $setOnInsert: { createdAt: new Date() } },
        { upsert: true, new: true, session },
      )
      await JournalLineModel.create(
        [
          {
            journalEntryId: entry.id,
            accountId: account.id,
            accountKind: line.kind,
            accountOwnerId: line.owner,
            direction: line.direction,
            amount: line.amount,
            currency: 'GHS',
          },
        ],
        { session },
      )
    }
  }
  async recordCampaignReview(payoutId: string, adminId: string, note: string) {
    await PayoutModel.updateOne(
      { _id: payoutId, provider: 'ujimora_wallet', status: 'PENDING' },
      { $push: { walletReviews: { adminId, note, reviewedAt: new Date() } } },
    )
  }
  async settleCampaign(payoutId: string, approvedBy: string, reviewNote: string) {
    const session = await mongoose.startSession()
    try {
      await session.withTransaction(async () => {
        const payout = await PayoutModel.findOne({
          _id: payoutId,
          provider: 'ujimora_wallet',
        }).session(session)
        if (!payout) throw new AppError('Wallet payout not found', 404)
        if (payout.status === 'PAID' && payout.settlementApplied) return
        if (
          payout.status !== 'PENDING' ||
          !payout.recipientId.startsWith('wallet:') ||
          payout.currency !== 'GHS'
        )
          throw new AppError('Wallet payout cannot be approved', 409)
        const balance = await CampaignBalanceModel.updateOne(
          {
            campaignId: payout.campaignId,
            currency: 'GHS',
            availableBalance: { $gte: payout.amount },
          },
          {
            $inc: {
              availableBalance: -payout.amount,
              paidOutBalance: payout.netAmount,
              payoutFees: payout.fee,
            },
            $set: { updatedAt: new Date() },
          },
          { session },
        )
        if (!balance.modifiedCount)
          throw new AppError('Insufficient available campaign balance', 422)
        await this.credit(
          session,
          payout.recipientId.slice(7),
          payout.campaignId,
          `wallet-payout:${payout.id}`,
          payout.amount,
          payout.fee,
          payout.netAmount,
          'campaign',
        )
        payout.status = 'PAID'
        payout.approvedBy = approvedBy
        payout.settlementApplied = true
        payout.walletReviewNote = reviewNote
        await payout.save({ session })
      })
    } finally {
      await session.endSession()
    }
  }
  async transferCreator(input: Parameters<WalletPayoutPort['transferCreator']>[0]) {
    const session = await mongoose.startSession()
    let result!: Awaited<ReturnType<WalletPayoutPort['transferCreator']>>
    try {
      await session.withTransaction(async () => {
        let payout = await CreatorPayoutModel.findOne({ providerRef: input.reference }).session(
          session,
        )
        if (payout) {
          if (
            payout.creatorUserId !== input.userId ||
            payout.amount !== input.amount ||
            payout.provider !== 'ujimora_wallet' ||
            payout.status !== 'PAID'
          )
            throw new AppError('Transfer reference already used with different details', 409)
        } else {
          const balance = await CreatorBalanceModel.updateOne(
            { userId: input.userId, currency: 'GHS', availableBalance: { $gte: input.amount } },
            {
              $inc: {
                availableBalance: -input.amount,
                paidOutBalance: input.netAmount,
                payoutFees: input.fee,
              },
              $set: { updatedAt: new Date() },
            },
            { session },
          )
          if (!balance.modifiedCount)
            throw new AppError('Insufficient available creator balance', 422)
          ;[payout] = await CreatorPayoutModel.create(
            [
              {
                creatorUserId: input.userId,
                ...input,
                providerRef: input.reference,
                currency: 'GHS',
                status: 'PAID',
                provider: 'ujimora_wallet',
                recipientName: 'Ujimora Wallet',
                settlementApplied: true,
              },
            ],
            { session },
          )
          await this.credit(
            session,
            input.userId,
            payout.id,
            input.reference,
            input.amount,
            input.fee,
            input.netAmount,
            'creator',
          )
        }
        result = {
          id: payout.id,
          status: 'PAID',
          amount: payout.amount,
          fee: payout.fee ?? 0,
          feePercent: payout.feePercent ?? 0,
          netAmount: payout.netAmount ?? payout.amount,
          currency: 'GHS',
          reference: input.reference,
        }
      })
    } finally {
      await session.endSession()
    }
    return result
  }
}
