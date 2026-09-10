import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import mongoose from 'mongoose'
import { connectTestDatabase, disconnectTestDatabase } from '../../helpers/testDatabase.js'
import { MongoWalletPayoutRepository } from '../../../src/infrastructure/adapters/outbound/persistence/MongoWalletPayoutRepository.js'
import { PayoutModel } from '../../../src/infrastructure/database/models/PayoutModel.js'
import { CampaignBalanceModel } from '../../../src/infrastructure/database/models/CampaignBalanceModel.js'
import { CreatorBalanceModel } from '../../../src/infrastructure/database/models/CreatorBalanceModel.js'
import { CreatorPayoutModel } from '../../../src/infrastructure/database/models/CreatorPayoutModel.js'
import { WalletModel } from '../../../src/infrastructure/database/models/WalletModel.js'
import { WalletTransactionModel } from '../../../src/infrastructure/database/models/WalletTransactionModel.js'
import { JournalEntryModel } from '../../../src/infrastructure/database/models/JournalEntryModel.js'
import { JournalLineModel } from '../../../src/infrastructure/database/models/JournalLineModel.js'
import { LedgerAccountModel } from '../../../src/infrastructure/database/models/LedgerAccountModel.js'
const models = [
  PayoutModel,
  CampaignBalanceModel,
  CreatorBalanceModel,
  CreatorPayoutModel,
  WalletModel,
  WalletTransactionModel,
  JournalEntryModel,
  JournalLineModel,
  LedgerAccountModel,
]
beforeAll(async () => {
  await connectTestDatabase()
  for (const m of models) await m.init()
})
afterAll(async () => {
  await mongoose.connection.dropDatabase()
  await disconnectTestDatabase()
})
beforeEach(async () => {
  for (const m of models) await m.deleteMany({})
})
afterEach(() => vi.restoreAllMocks())
const repo = new MongoWalletPayoutRepository()
async function seed(amount = 100, fee = 10) {
  await CampaignBalanceModel.create({
    campaignId: 'campaign',
    currency: 'GHS',
    availableBalance: 120,
  })
  return PayoutModel.create({
    campaignId: 'campaign',
    recipientId: 'wallet:owner',
    amount,
    fee,
    netAmount: amount - fee,
    currency: 'GHS',
    provider: 'ujimora_wallet',
    status: 'PENDING',
    type: 'early',
    requestedBy: 'owner',
  })
}
describe('transactional wallet payouts', () => {
  it('concurrent approval credits once and posts balanced journal and histories', async () => {
    const p = await seed()
    await Promise.all([
      repo.settleCampaign(p.id, 'admin', 'Reviewed owner and fee'),
      repo.settleCampaign(p.id, 'admin', 'Reviewed owner and fee'),
    ])
    expect((await WalletModel.findOne({ userId: 'owner' }))?.balance).toBe(90)
    expect((await CampaignBalanceModel.findOne({ campaignId: 'campaign' }))?.availableBalance).toBe(
      20,
    )
    expect(await WalletTransactionModel.countDocuments()).toBe(1)
    const lines = await JournalLineModel.find()
    expect(lines.filter((l) => l.direction === 'debit').reduce((a, l) => a + l.amount, 0)).toBe(
      lines.filter((l) => l.direction === 'credit').reduce((a, l) => a + l.amount, 0),
    )
    expect((await PayoutModel.findById(p.id))?.settlementApplied).toBe(true)
  })
  it('competing payouts cannot overdraw a campaign', async () => {
    const first = await seed(100, 0)
    const second = await PayoutModel.create({
      ...first.toObject(),
      _id: new mongoose.Types.ObjectId(),
    })
    const results = await Promise.allSettled([
      repo.settleCampaign(first.id, 'admin', 'Reviewed'),
      repo.settleCampaign(second.id, 'admin', 'Reviewed'),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((await WalletModel.findOne())?.balance).toBe(100)
    expect((await CampaignBalanceModel.findOne())?.availableBalance).toBe(20)
  })
  it('a ledger failure rolls back the debit, credit and payout status together', async () => {
    const p = await seed()
    vi.spyOn(JournalEntryModel, 'create').mockRejectedValueOnce(
      new Error('ledger unavailable') as never,
    )
    await expect(repo.settleCampaign(p.id, 'admin', 'Reviewed')).rejects.toThrow(
      'ledger unavailable',
    )
    expect((await CampaignBalanceModel.findOne())?.availableBalance).toBe(120)
    expect(await WalletModel.countDocuments()).toBe(0)
    expect((await PayoutModel.findById(p.id))?.status).toBe('PENDING')
    expect(await WalletTransactionModel.countDocuments()).toBe(0)
  })
  it('creator retries are idempotent and another user cannot spend this balance', async () => {
    await CreatorBalanceModel.create({ userId: 'owner', currency: 'GHS', availableBalance: 100 })
    const input = {
      userId: 'owner',
      amount: 100,
      fee: 5,
      feePercent: 5,
      netAmount: 95,
      reference: 'wallet-creator:owner:test-key',
    }
    await Promise.all([repo.transferCreator(input), repo.transferCreator(input)])
    expect((await WalletModel.findOne({ userId: 'owner' }))?.balance).toBe(95)
    expect(await CreatorPayoutModel.countDocuments()).toBe(1)
    expect((await CreatorBalanceModel.findOne())?.availableBalance).toBe(0)
    await expect(
      repo.transferCreator({ ...input, userId: 'other', reference: 'different' }),
    ).rejects.toMatchObject({ statusCode: 422 })
  })
})
