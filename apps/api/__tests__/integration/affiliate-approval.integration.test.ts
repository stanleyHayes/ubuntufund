import mongoose from 'mongoose'
import { beforeAll, beforeEach, afterAll, it, expect, vi } from 'vitest'
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js'
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js'
import { AffiliateModel } from '../../src/infrastructure/database/models/AffiliateModel.js'
import { AffiliatePayoutModel } from '../../src/infrastructure/database/models/AffiliatePayoutModel.js'
import { MongoAffiliateRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliateRepository.js'
import { MongoAffiliatePayoutRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliatePayoutRepository.js'
import { MongoAffiliatePayoutApproval } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliatePayoutApproval.js'
import { ApproveAffiliatePayoutUseCase } from '../../src/application/use-cases/ApproveAffiliatePayoutUseCase.js'
const staff = new mongoose.Types.ObjectId(), owner = new mongoose.Types.ObjectId(), affiliate = new mongoose.Types.ObjectId()
let payoutId: string
beforeAll(connectTestDatabase)
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase() })
beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), AffiliateModel.deleteMany({}), AffiliatePayoutModel.deleteMany({})])
  await UserModel.collection.insertMany([{ _id: staff, email: 'staff@example.test', role: 'admin', authVersion: 'current' }, { _id: owner, email: 'owner@example.test', role: 'user' }])
  await AffiliateModel.create({ _id: affiliate, userId: String(owner), referralCode: 'test-affiliate', status: 'active', commissionRate: 5, recipientCode: 'synthetic' })
  const payout = await AffiliatePayoutModel.create({ affiliateId: String(affiliate), amount: 100, currency: 'GHS', provider: 'paystack', requestedBy: String(owner), status: 'PENDING' })
  payoutId = String(payout._id)
})
it.each(['role', 'credentials', 'closed_staff', 'suspended', 'destination', 'owner', 'closed_owner', 'unchanged'])('revalidates affiliate approval after provider lookup: %s', async change => {
  const provider = {
    isConfigured: () => true,
    getBalance: async () => {
      if (change === 'role') await UserModel.updateOne({ _id: staff }, { role: 'user' })
      if (change === 'credentials') await UserModel.updateOne({ _id: staff }, { authVersion: 'revoked' })
      if (change === 'closed_staff') await UserModel.updateOne({ _id: staff }, { deletedAt: new Date() })
      if (change === 'suspended') await AffiliateModel.updateOne({ _id: affiliate }, { status: 'suspended' })
      if (change === 'destination') await AffiliateModel.updateOne({ _id: affiliate }, { recipientCode: 'changed' })
      if (change === 'owner') await AffiliateModel.updateOne({ _id: affiliate }, { userId: String(staff) })
      if (change === 'closed_owner') await UserModel.updateOne({ _id: owner }, { deletedAt: new Date() })
      return [{ currency: 'GHS', balance: 1000 }]
    },
    initiateTransfer: vi.fn(async () => {
      const saved = await AffiliatePayoutModel.collection.findOne({ _id: new mongoose.Types.ObjectId(payoutId) }, { session: null })
      expect(saved?.status).toBe('PROCESSING')
      expect(saved?.providerRef).toMatch(/^aff-/)
      return { status: 'pending', transferCode: 'synthetic-transfer' }
    }),
  }
  const useCase = new ApproveAffiliatePayoutUseCase(new MongoAffiliatePayoutRepository(), new MongoAffiliateRepository(), {} as never, provider as never, new MongoAffiliatePayoutApproval())
  const result = useCase.execute(payoutId, { userId: String(staff), role: 'admin', authVersion: 'current' })
  if (change === 'unchanged') {
    expect((await result).status).toBe('PROCESSING')
    expect(provider.initiateTransfer).toHaveBeenCalledOnce()
  } else {
    await expect(result).rejects.toMatchObject({ statusCode: ['role', 'credentials', 'closed_staff'].includes(change) ? 403 : 409 })
    expect((await AffiliatePayoutModel.findById(payoutId))?.status).toBe('PENDING')
    expect(provider.initiateTransfer).not.toHaveBeenCalled()
  }
})
it('refuses an administrator approving their own affiliate payout inside the approval transaction', async () => {
  await UserModel.updateOne({ _id: owner }, { role: 'admin', authVersion: 'current' })
  const work = vi.fn()
  await expect(new MongoAffiliatePayoutApproval().run({ userId: String(owner), role: 'admin', authVersion: 'current' }, { affiliateId: String(affiliate), ownerId: String(owner), recipientCode: 'synthetic' }, work)).rejects.toMatchObject({ statusCode: 403 })
  expect(work).not.toHaveBeenCalled()
  expect((await AffiliatePayoutModel.findById(payoutId))?.status).toBe('PENDING')
})
