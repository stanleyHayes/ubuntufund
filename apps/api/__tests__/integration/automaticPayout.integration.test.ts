import { ApprovePayoutUseCase } from '../../src/application/use-cases/ApprovePayoutUseCase.js'
import { CampaignBalanceModel } from '../../src/infrastructure/database/models/CampaignBalanceModel.js'
import { MongoCampaignBalanceRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignBalanceRepository.js'
import { MongoAutomaticPayoutVerification } from '../../src/infrastructure/adapters/outbound/persistence/MongoAutomaticPayoutVerification.js'
import { KYCVerificationModel } from '../../src/infrastructure/database/models/KYCVerificationModel.js'
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
    CampaignBalanceModel.deleteMany({}),
    KYCVerificationModel.deleteMany({}),
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
  await KYCVerificationModel.create({ userId: String(ids.user), verificationType: 'identity', status: 'approved', expiryDate: new Date(Date.now() + 86400000), documents: [] })
  await CampaignModel.collection.insertOne({
    _id: ids.campaign,
    creatorId: String(ids.user),
    status: 'funded',
    endDate: new Date(0), raisedAmount: 1000, goalAmount: 1000,
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

it('keeps expired, missing and superseded owner evidence in manual review without budget claims', async () => {
  for (const status of ['expired', 'missing', 'pending', 'rejected']) {
    await KYCVerificationModel.deleteMany({})
    if (['pending', 'rejected'].includes(status)) await KYCVerificationModel.create({ userId: String(ids.user), verificationType: 'identity', status: 'approved', expiryDate: new Date('2099-01-01'), createdAt: new Date('2020-01-01'), documents: [] })
    if (status !== 'missing') await KYCVerificationModel.create({ userId: String(ids.user), verificationType: 'identity', status: status === 'expired' ? 'approved' : status, expiryDate: new Date(status === 'expired' ? '2020-01-01' : '2099-01-01'), documents: [] })
    const item = await pending()
    await service.consider(item)
    expect((await PayoutModel.findById(item.id))?.status).toBe('PENDING')
  }
  expect(approve.executeAutomatic).not.toHaveBeenCalled()
  expect(await AutomaticPayoutBudgetModel.countDocuments({})).toBe(0)
})
it('requires current business evidence for an organization even with approved personal identity', async () => {
  await UserModel.updateOne({ _id: ids.user }, { $set: { role: 'organization', verificationLevel: 3 } })
  const item = await pending()
  await service.consider(item)
  expect(approve.executeAutomatic).not.toHaveBeenCalled()
  await KYCVerificationModel.create({ userId: String(ids.user), verificationType: 'business', status: 'approved', expiryDate: new Date('2099-01-01'), documents: [] })
  await service.consider(item)
  expect(approve.executeAutomatic).toHaveBeenCalledTimes(1)
})

it('revalidates current account and evidence independently of an earlier automatic claim', async () => {
  const guard = new MongoAutomaticPayoutVerification()
  await expect(guard.assertCurrent(String(ids.user))).resolves.toBeUndefined()
  await KYCVerificationModel.updateMany({}, { $set: { expiryDate: new Date('2020-01-01') } })
  await expect(guard.assertCurrent(String(ids.user))).rejects.toThrow('manual review')
  await KYCVerificationModel.updateMany({}, { $set: { expiryDate: new Date('2099-01-01') } })
  await UserModel.updateOne({ _id: ids.user }, { $set: { deletedAt: new Date() } })
  await expect(guard.assertCurrent(String(ids.user))).rejects.toThrow('manual review')
})

it('rolls back reservation and processing together on failure and permits a clean retry', async () => {
  const guard = new MongoAutomaticPayoutVerification()
  const balances = new MongoCampaignBalanceRepository()
  const item = await pending()
  await CampaignBalanceModel.create({ campaignId: String(ids.campaign), currency: 'GHS', availableBalance: 1000 })
  const write = async () => {
    expect(await balances.reserveForPayout(String(ids.campaign), 300)).toBeTruthy()
    expect(await repo.transitionToProcessing(item.id, { approvedBy: 'system:auto-payout', providerRef: 'synthetic-ref' })).toBeTruthy()
  }
  await expect(guard.run(String(ids.user), async () => { await write(); throw new Error('commit boundary failure') })).rejects.toThrow('commit boundary failure')
  expect((await balances.findByCampaignId(String(ids.campaign)))?.availableBalance).toBe(1000)
  expect((await repo.findById(item.id))?.status).toBe('PENDING')
  await guard.run(String(ids.user), write)
  expect((await balances.findByCampaignId(String(ids.campaign)))?.availableBalance).toBe(700)
  expect((await repo.findById(item.id))?.status).toBe('PROCESSING')
})

it.each(['closure', 'email', 'role', 'new_pending', 'kyc_rejected'])('retries a stale authorization snapshot after %s and preserves funds', async change => {
  const guard = new MongoAutomaticPayoutVerification()
  const balances = new MongoCampaignBalanceRepository()
  const item = await pending()
  await CampaignBalanceModel.create({ campaignId: String(ids.campaign), currency: 'GHS', availableBalance: 1000 })
  let entered = false
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const original = guard.assertCurrent.bind(guard)
  const spy = vi.spyOn(guard, 'assertCurrent').mockImplementationOnce(async userId => {
    await original(userId)
    entered = true
    await gate
  })
  const work = vi.fn(async () => {
    await balances.reserveForPayout(String(ids.campaign), 300)
    await repo.transitionToProcessing(item.id, { approvedBy: 'system:auto-payout', providerRef: 'revocation-fixture' })
  })
  const result = guard.run(String(ids.user), work).then(() => null, error => error)
  try {
    await expect.poll(() => entered).toBe(true)
    if (change === 'closure') await UserModel.updateOne({ _id: ids.user }, { $set: { deletedAt: new Date() } })
    if (change === 'email') await UserModel.updateOne({ _id: ids.user }, { $set: { emailVerified: false } })
    if (change === 'role') await UserModel.updateOne({ _id: ids.user }, { $set: { role: 'organization' } })
    if (change === 'new_pending' || change === 'kyc_rejected') {
      // Model the same owner serialization write used by KYC submission/review.
      await mongoose.connection.transaction(async () => {
        await UserModel.updateOne({ _id: ids.user }, { $inc: { publicationWriteVersion: 1 } })
        if (change === 'new_pending') await KYCVerificationModel.create({ userId: String(ids.user), verificationType: 'identity', status: 'pending', documents: [] })
        else await KYCVerificationModel.updateMany({ userId: String(ids.user) }, { $set: { status: 'rejected' } })
      })
    }
    release()
    expect(await result).toBeInstanceOf(Error)
    expect(work).not.toHaveBeenCalled()
    expect((await balances.findByCampaignId(String(ids.campaign)))?.availableBalance).toBe(1000)
    expect((await repo.findById(item.id))?.status).toBe('PENDING')
  } finally { release(); await result; spy.mockRestore() }
})

it('calls the provider only after the real approval transaction commits its reservation and reference', async () => {
  const item = await pending()
  await CampaignBalanceModel.create({ campaignId: String(ids.campaign), currency: 'GHS', availableBalance: 1000 })
  const provider = {
    isConfigured: () => true,
    getBalance: async () => [{ currency: 'GHS', balance: 1000 }],
    initiateTransfer: vi.fn(async (input: { reference: string }) => {
      // Raw collection reads outside a session see only committed data.
      const balance = await CampaignBalanceModel.collection.findOne({ campaignId: String(ids.campaign) }, { session: null })
      const payout = await PayoutModel.collection.findOne({ _id: new mongoose.Types.ObjectId(item.id) }, { session: null })
      expect(balance?.availableBalance).toBe(700)
      expect(payout?.status).toBe('PROCESSING')
      expect(payout?.providerRef).toBe(input.reference)
      return { status: 'pending', transferCode: 'synthetic-transfer' }
    }),
  }
  const real = new ApprovePayoutUseCase(repo, { findById: async () => ({ recipientCode: 'synthetic-recipient', type: 'ghipss' }) } as never, new MongoCampaignBalanceRepository(), provider as never, { dualApprovalAmount: 40000, maxTransferAmount: 50000 } as never, undefined, undefined, new MongoAutomaticPayoutVerification())
  await real.executeAutomatic(item.id)
  expect(provider.initiateTransfer).toHaveBeenCalledTimes(1)
  expect((await repo.findById(item.id))?.status).toBe('PROCESSING')
})


it.each(['owner', 'status', 'deleted', 'early'])('rejects concurrent automatic campaign %s changes before reserving or sending', async change => {
  const item = await pending()
  await CampaignBalanceModel.create({ campaignId: String(ids.campaign), currency: 'GHS', availableBalance: 1000 })
  const provider = {
    isConfigured: () => true,
    getBalance: async () => [{ currency: 'GHS', balance: 1000 }],
    initiateTransfer: vi.fn(),
  }
  const original = CampaignModel.findOneAndUpdate.bind(CampaignModel)
  let changed = false
  const lock = vi.spyOn(CampaignModel, 'findOneAndUpdate').mockImplementation((...args) => {
    const query = original(...args)
    const execute = query.exec.bind(query)
    query.exec = async (...execArgs) => {
      if (!changed) {
        changed = true
        const update = change === 'owner' ? { creatorId: String(new mongoose.Types.ObjectId()) }
          : change === 'status' ? { status: 'blocked' }
          : change === 'deleted' ? { deletedAt: new Date() }
          : { endDate: new Date(Date.now() + 86_400_000), goalAmount: 2000 }
        await CampaignModel.updateOne({ _id: ids.campaign }, update, { session: null })
      }
      return execute(...execArgs)
    }
    return query
  })
  try {
    const real = new ApprovePayoutUseCase(repo, { findById: async () => ({ recipientCode: 'synthetic-recipient', type: 'ghipss' }) } as never, new MongoCampaignBalanceRepository(), provider as never, { dualApprovalAmount: 40000, maxTransferAmount: 50000 } as never, undefined, undefined, new MongoAutomaticPayoutVerification())
    await expect(real.executeAutomatic(item.id)).rejects.toMatchObject({ statusCode: 409 })
    expect(lock.mock.calls.length).toBeGreaterThan(1)
    expect((await CampaignBalanceModel.findOne({ campaignId: String(ids.campaign) }))?.availableBalance).toBe(1000)
    expect((await repo.findById(item.id))?.status).toBe('PENDING')
    expect(provider.initiateTransfer).not.toHaveBeenCalled()
  } finally { lock.mockRestore() }
})
