import mongoose from 'mongoose'
import { beforeAll, afterAll, beforeEach, it, expect, vi } from 'vitest'
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js'
import { AutomaticPayoutService } from '../../src/infrastructure/adapters/outbound/payments/AutomaticPayoutService.js'
import {
  AutomaticPayoutPolicyModel,
  AutomaticPayoutBudgetModel,
  automaticPayoutDefaults,
} from '../../src/infrastructure/database/models/AutomaticPayoutModel.js'
import { PayoutModel } from '../../src/infrastructure/database/models/PayoutModel.js'
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js'
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js'
import { TransferRecipientModel } from '../../src/infrastructure/database/models/TransferRecipientModel.js'
import { MongoPayoutRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoPayoutRepository.js'
import { toPayoutDto } from '../../src/application/use-cases/mappers/payoutDto.js'
const repo = new MongoPayoutRepository()
const ids = {
  user: new mongoose.Types.ObjectId(),
  campaign: new mongoose.Types.ObjectId(),
  recipient: new mongoose.Types.ObjectId(),
}
const approve = {
  executeAutomatic: vi.fn(async (id: string) => {
    await PayoutModel.updateOne(
      { _id: id, status: 'PENDING' },
      { $set: { status: 'PROCESSING', approvedBy: 'system:auto-payout' } },
    )
    return toPayoutDto((await repo.findById(id))!)
  }),
}
const service = new AutomaticPayoutService(approve as never, repo, {
  dualApprovalAmount: 40000,
  maxTransferAmount: 50000,
} as never)
beforeAll(async () => {
  await connectTestDatabase()
  await Promise.all([
    PayoutModel.init(),
    AutomaticPayoutPolicyModel.init(),
    AutomaticPayoutBudgetModel.init(),
  ])
})
afterAll(async () => {
  await dropTestDatabase()
  await disconnectTestDatabase()
})
beforeEach(async () => {
  vi.clearAllMocks()
  await Promise.all([
    PayoutModel.deleteMany({}),
    AutomaticPayoutPolicyModel.deleteMany({}),
    AutomaticPayoutBudgetModel.deleteMany({}),
    UserModel.deleteMany({}),
    CampaignModel.deleteMany({}),
    TransferRecipientModel.deleteMany({}),
  ])
  await AutomaticPayoutPolicyModel.create({
    _id: 'current',
    ...automaticPayoutDefaults,
    enabled: true,
    revision: 1,
  })
  await UserModel.collection.insertOne({ _id: ids.user, emailVerified: true, verificationLevel: 2 })
  await CampaignModel.collection.insertOne({
    _id: ids.campaign,
    creatorId: String(ids.user),
    status: 'funded',
  })
  await TransferRecipientModel.collection.insertOne({
    _id: ids.recipient,
    campaignId: String(ids.campaign),
    createdBy: String(ids.user),
    type: 'ghipss',
    reviewedBy: 'admin',
    reviewNote: 'Account ownership and capacity reviewed.',
    reviewedAt: new Date(),
    resolvedAccountName: 'Owner',
  })
  await PayoutModel.collection.insertOne({
    campaignId: String(ids.campaign),
    recipientId: String(ids.recipient),
    requestedBy: String(ids.user),
    amount: 100,
    netAmount: 100,
    fee: 0,
    status: 'PAID',
    settlementApplied: true,
    approvedBy: 'admin',
    provider: 'paystack',
    currency: 'GHS',
    createdAt: new Date(),
    updatedAt: new Date(),
  })
})
async function pending(amount = 300) {
  const doc = await PayoutModel.create({
    campaignId: String(ids.campaign),
    recipientId: String(ids.recipient),
    requestedBy: String(ids.user),
    amount,
    netAmount: amount,
    fee: 0,
    status: 'PENDING',
    provider: 'paystack',
    currency: 'GHS',
    type: 'standard',
    requestKey: crypto.randomUUID(),
  })
  return toPayoutDto((await repo.findById(String(doc._id)))!)
}
it('claims an eligible repeat payout once even when requests race', async () => {
  const p = await pending()
  await Promise.all([service.consider(p), service.consider(p)])
  expect(approve.executeAutomatic).toHaveBeenCalledTimes(1)
  expect((await PayoutModel.findById(p.id))?.status).toBe('PROCESSING')
})
it('enforces the daily owner limit under concurrent requests', async () => {
  await AutomaticPayoutPolicyModel.updateOne({ _id: 'current' }, { $set: { dailyOwnerLimit: 500 } })
  const a = await pending(),
    b = await pending()
  await Promise.all([service.consider(a), service.consider(b)])
  expect(approve.executeAutomatic).toHaveBeenCalledTimes(1)
  expect(await PayoutModel.countDocuments({ status: 'PENDING' })).toBe(1)
})
it('keeps first-time destinations in manual review', async () => {
  await PayoutModel.deleteMany({ status: 'PAID' })
  expect((await service.consider(await pending())).status).toBe('PENDING')
  expect(approve.executeAutomatic).not.toHaveBeenCalled()
})
it('keeps expired reviews and over-limit MoMo in manual review', async () => {
  await TransferRecipientModel.updateOne({ _id: ids.recipient }, { $set: { type: 'mobile_money' } })
  expect((await service.consider(await pending(300))).status).toBe('PENDING')
  await TransferRecipientModel.updateOne(
    { _id: ids.recipient },
    { $set: { reviewedAt: new Date(Date.now() - 2 * 86400000) } },
  )
  expect((await service.consider(await pending(100))).status).toBe('PENDING')
  expect(approve.executeAutomatic).not.toHaveBeenCalled()
})
it('supports a reviewed repeat MoMo payout within the lower limit', async () => {
  await TransferRecipientModel.updateOne({ _id: ids.recipient }, { $set: { type: 'mobile_money' } })
  expect((await service.consider(await pending(100))).status).toBe('PROCESSING')
})
it('does not bypass early-cashout review or disabled automation', async () => {
  const p = await pending()
  await PayoutModel.updateOne({ _id: p.id }, { $set: { type: 'early' } })
  await service.consider(p)
  await AutomaticPayoutPolicyModel.updateOne({ _id: 'current' }, { $set: { enabled: false } })
  await service.consider(await pending())
  expect(approve.executeAutomatic).not.toHaveBeenCalled()
})
