import mongoose, { Schema } from 'mongoose'
import type {
  PayoutAccountRepositoryPort,
  SavedPayoutAccount,
} from '../../../../domain/ports/outbound/PayoutAccountRepositoryPort.js'
const schema = new Schema<{ _id: string; userId: string; accounts: SavedPayoutAccount[]; consumptionWriteVersion: number }>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, unique: true },
    consumptionWriteVersion: { type: Number, default: 0 },
    accounts: {
      type: [
        {
          id: String,
          fingerprint: String,
          type: { type: String, enum: ['ghipss', 'mobile_money'], required: true },
          accountNumber: String,
          bankCode: String,
          accountName: String,
          recipientCode: String,
          verificationStatus: String,
          resolvedAccountName: String,
        },
      ],
      default: [],
    },
  },
  { collection: 'payoutaccounts' },
)
const Model = mongoose.model('PayoutAccountWallet', schema)
export class MongoPayoutAccountRepository implements PayoutAccountRepositoryPort {
  async claimCurrent(userId: string, account: SavedPayoutAccount) {
    const result = await Model.updateOne({
      _id: userId,
      accounts: { $elemMatch: {
        id: account.id, fingerprint: account.fingerprint, type: account.type,
        accountNumber: account.accountNumber, bankCode: account.bankCode,
        accountName: account.accountName, recipientCode: account.recipientCode,
        verificationStatus: 'name_matched',
      } },
    }, { $inc: { consumptionWriteVersion: 1 } })
    return result.matchedCount === 1
  }
  async list(userId: string) {
    return (await Model.findOne({ _id: userId }).lean())?.accounts ?? []
  }
  async addWithinLimit(userId: string, account: SavedPayoutAccount, limit: number) {
    try {
      await Model.updateOne(
        { _id: userId },
        { $setOnInsert: { _id: userId, userId, accounts: [] } },
        { upsert: true },
      )
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e
    }
    const result = await Model.updateOne(
      {
        _id: userId,
        'accounts.fingerprint': { $ne: account.fingerprint },
        ...(limit < 0 ? {} : { $expr: { $lt: [{ $size: '$accounts' }, limit] } }),
      },
      { $push: { accounts: account } },
    )
    return result.modifiedCount === 1
  }
  async remove(userId: string, id: string) {
    await Model.updateOne({ _id: userId }, { $pull: { accounts: { id } } })
  }
}
