import { CampaignModel } from '../../../src/infrastructure/database/models/CampaignModel.js'
import { UserModel } from '../../../src/infrastructure/database/models/UserModel.js'
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
import { KYCVerificationModel } from '../../../src/infrastructure/database/models/KYCVerificationModel.js'
import { DisputeModel } from '../../../src/infrastructure/database/models/DisputeModel.js'
import { grantCurrentKyc } from '../../helpers/currentKyc.js'
const campaignId = new mongoose.Types.ObjectId().toString()
const ownerId = new mongoose.Types.ObjectId().toString()
const models = [
  CampaignModel,
  UserModel,
  PayoutModel,
  CampaignBalanceModel,
  CreatorBalanceModel,
  CreatorPayoutModel,
  WalletModel,
  WalletTransactionModel,
  JournalEntryModel,
  JournalLineModel,
  LedgerAccountModel,
  KYCVerificationModel,
  DisputeModel,
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
const repo = new MongoWalletPayoutRepository({ creatorPolicy: async () => ({ feePercent: 5, eligible: true, planName: 'Fixture' }) })
const adminId = new mongoose.Types.ObjectId().toString()
async function seed(amount = 100, fee = 10) {
  await UserModel.collection.insertOne({ _id: new mongoose.Types.ObjectId(adminId), role: 'admin', authVersion: 'staff-fixture' })
  await UserModel.collection.insertOne({ _id: new mongoose.Types.ObjectId(ownerId), email: `owner-${ownerId}@example.test`, role: 'user', authVersion: 'owner-fixture' })
  await grantCurrentKyc(ownerId)
  await CampaignModel.collection.insertOne({ _id: new mongoose.Types.ObjectId(campaignId), creatorId: ownerId, status: 'active', endDate: new Date(0), raisedAmount: 100, goalAmount: 1000 })
  await CampaignBalanceModel.create({
    campaignId,
    currency: 'GHS',
    availableBalance: 120,
  })
  return PayoutModel.create({
    campaignId,
    recipientId: `wallet:${ownerId}`,
    amount,
    fee,
    netAmount: amount - fee,
    currency: 'GHS',
    provider: 'ujimora_wallet',
    status: 'PENDING',
    type: 'early',
    requestedBy: ownerId,
  })
}
describe('transactional wallet payouts', () => {
  it('concurrent approval credits once and posts balanced journal and histories', async () => {
    const p = await seed()
    await Promise.all([
      repo.settleCampaign(p.id, adminId, 'Reviewed owner and fee', 'staff-fixture'),
      repo.settleCampaign(p.id, adminId, 'Reviewed owner and fee', 'staff-fixture'),
    ])
    expect((await WalletModel.findOne({ userId: ownerId }))?.balance).toBe(90)
    expect((await CampaignBalanceModel.findOne({ campaignId }))?.availableBalance).toBe(
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
      repo.settleCampaign(first.id, adminId, 'Reviewed', 'staff-fixture'),
      repo.settleCampaign(second.id, adminId, 'Reviewed', 'staff-fixture'),
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
    await expect(repo.settleCampaign(p.id, adminId, 'Reviewed', 'staff-fixture')).rejects.toThrow(
      'ledger unavailable',
    )
    expect((await CampaignBalanceModel.findOne())?.availableBalance).toBe(120)
    expect(await WalletModel.countDocuments()).toBe(0)
    expect((await PayoutModel.findById(p.id))?.status).toBe('PENDING')
    expect(await WalletTransactionModel.countDocuments()).toBe(0)
  })
  it.each(['role', 'closed', 'credentials'])('rejects changed staff %s before wallet settlement', async (change) => {
    const p = await seed()
    await UserModel.findByIdAndUpdate(adminId, change === 'role' ? { role: 'user' } : change === 'closed' ? { deletedAt: new Date() } : { authVersion: 'rotated' })
    await expect(repo.settleCampaign(p.id, adminId, 'Reviewed', 'staff-fixture')).rejects.toMatchObject({ statusCode: 403 })
    expect((await CampaignBalanceModel.findOne())?.availableBalance).toBe(120)
    expect(await WalletModel.countDocuments()).toBe(0)
    expect((await PayoutModel.findById(p.id))?.status).toBe('PENDING')
    expect(await WalletTransactionModel.countDocuments()).toBe(0)
    expect(await JournalEntryModel.countDocuments()).toBe(0)
  })
  it.each(['owner', 'endDate', 'goal', 'raised'])('retries concurrent campaign %s changes and rejects stale settlement', async (change) => {
    const p = await seed(100, 0)
    await PayoutModel.updateOne({ _id: p.id }, { type: 'standard' })
    const future = new Date(Date.now() + 86_400_000)
    if (change === 'goal' || change === 'raised')
      await CampaignModel.updateOne({ _id: campaignId }, { endDate: future, raisedAmount: 1000, goalAmount: 1000 })
    const original = CampaignModel.findOneAndUpdate.bind(CampaignModel)
    let changed = false
    const lock = vi.spyOn(CampaignModel, 'findOneAndUpdate').mockImplementation((...args) => {
      const query = original(...args)
      const execute = query.exec.bind(query)
      query.exec = async (...execArgs) => {
        if (!changed) {
          changed = true
          const update = change === 'owner' ? { creatorId: 'new-owner' }
            : change === 'endDate' ? { endDate: future }
            : change === 'goal' ? { goalAmount: 2000 } : { raisedAmount: 500 }
          await CampaignModel.updateOne({ _id: campaignId }, update, { session: null })
        }
        return execute(...execArgs)
      }
      return query
    })
    await expect(repo.settleCampaign(p.id, adminId, 'Reviewed', 'staff-fixture')).rejects.toMatchObject({ statusCode: 409 })
    expect(lock.mock.calls.length).toBeGreaterThan(1)
    expect((await CampaignBalanceModel.findOne())?.availableBalance).toBe(120)
    expect((await PayoutModel.findById(p.id))?.status).toBe('PENDING')
    expect(await WalletModel.countDocuments()).toBe(0)
    expect(await WalletTransactionModel.countDocuments()).toBe(0)
    expect(await JournalEntryModel.countDocuments()).toBe(0)
  })
  it('refuses a wallet payout approved by the campaign owner or requester, with nothing moved', async () => {
    const p = await seed()
    await UserModel.updateOne({ _id: ownerId }, { role: 'admin' })
    await expect(repo.settleCampaign(p.id, ownerId, 'Reviewed my own payout', 'owner-fixture')).rejects.toMatchObject({ statusCode: 403 })
    await PayoutModel.updateOne({ _id: p.id }, { requestedBy: adminId })
    await expect(repo.settleCampaign(p.id, adminId, 'Reviewed my own request', 'staff-fixture')).rejects.toMatchObject({ statusCode: 403 })
    expect((await CampaignBalanceModel.findOne())?.availableBalance).toBe(120)
    expect((await PayoutModel.findById(p.id))?.status).toBe('PENDING')
    expect(await WalletModel.countDocuments()).toBe(0)
  })
  it.each(['expired', 'pending_renewal', 'missing'] as const)('refuses a wallet payout when the owner KYC is %s', async (state) => {
    const p = await seed()
    if (state === 'expired') await KYCVerificationModel.updateMany({ userId: ownerId }, { expiryDate: new Date(Date.now() - 1000) })
    if (state === 'pending_renewal') await KYCVerificationModel.create({ userId: ownerId, verificationType: 'identity', status: 'pending', documents: [], riskLevel: 'low', createdAt: new Date(Date.now() + 1000) })
    if (state === 'missing') await KYCVerificationModel.deleteMany({ userId: ownerId })
    await expect(repo.settleCampaign(p.id, adminId, 'Reviewed', 'staff-fixture')).rejects.toMatchObject({ statusCode: 409 })
    expect((await CampaignBalanceModel.findOne())?.availableBalance).toBe(120)
    expect((await PayoutModel.findById(p.id))?.status).toBe('PENDING')
    expect(await WalletModel.countDocuments()).toBe(0)
  })
  it.each(['blocked', 'deleted', 'disputed'] as const)('refuses a wallet payout from a %s campaign', async (state) => {
    const p = await seed()
    if (state === 'blocked') await CampaignModel.updateOne({ _id: campaignId }, { status: 'blocked' })
    if (state === 'deleted') await CampaignModel.updateOne({ _id: campaignId }, { deletedAt: new Date() })
    if (state === 'disputed') await DisputeModel.collection.insertOne({ campaignId, status: 'open', createdAt: new Date() })
    await expect(repo.settleCampaign(p.id, adminId, 'Reviewed', 'staff-fixture')).rejects.toMatchObject({ statusCode: 409 })
    expect((await CampaignBalanceModel.findOne())?.availableBalance).toBe(120)
    expect((await PayoutModel.findById(p.id))?.status).toBe('PENDING')
    expect(await WalletModel.countDocuments()).toBe(0)
  })
  it('creator retries are idempotent and another user cannot spend this balance', async () => {
    const userId = new mongoose.Types.ObjectId().toString()
    await UserModel.collection.insertOne({ _id: new mongoose.Types.ObjectId(userId), authVersion: 'wallet-fixture' })
    await CreatorBalanceModel.create({ userId, currency: 'GHS', availableBalance: 100 })
    const input = {
      userId,
      authVersion: 'wallet-fixture',
      amount: 100,
      fee: 5,
      feePercent: 5,
      netAmount: 95,
      reference: 'wallet-creator:owner:test-key',
    }
    await Promise.all([repo.transferCreator(input), repo.transferCreator(input)])
    expect((await WalletModel.findOne({ userId }))?.balance).toBe(95)
    expect(await CreatorPayoutModel.countDocuments()).toBe(1)
    expect((await CreatorBalanceModel.findOne())?.availableBalance).toBe(0)
    await expect(
      repo.transferCreator({ ...input, userId: new mongoose.Types.ObjectId().toString(), reference: 'different' }),
    ).rejects.toMatchObject({ statusCode: 401 })
  })
})
