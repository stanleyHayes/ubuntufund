import mongoose, { Schema } from 'mongoose'
import type {
  PayoutAccountRepositoryPort,
  SavedPayoutAccount,
} from '../../../../domain/ports/outbound/PayoutAccountRepositoryPort.js'
const schema = new Schema<{ _id: string; userId: string; accounts: SavedPayoutAccount[] }>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true, unique: true },
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
