import mongoose from 'mongoose'
import { beforeAll, afterAll, beforeEach, it, expect, vi } from 'vitest'
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js'
import { MongoManualPayoutApproval } from '../../src/infrastructure/adapters/outbound/persistence/MongoManualPayoutApproval.js'
import { MongoTransferRecipientRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoTransferRecipientRepository.js'
import { TransferRecipientModel } from '../../src/infrastructure/database/models/TransferRecipientModel.js'
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js'
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js'

const staff = new mongoose.Types.ObjectId(), owner = new mongoose.Types.ObjectId(), campaign = new mongoose.Types.ObjectId(), destination = new mongoose.Types.ObjectId()
const requester = { userId: String(staff), role: 'admin' as const }
const payout = { id: 'test-payout', campaignId: String(campaign), requestedBy: String(owner), recipientId: String(destination), currency: 'GHS', type: 'standard', recipientCode: 'synthetic' }
beforeAll(connectTestDatabase)
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase() })
beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), CampaignModel.deleteMany({}), TransferRecipientModel.deleteMany({})])
  await UserModel.collection.insertOne({ _id: staff, role: 'admin' })
  await CampaignModel.collection.insertOne({ _id: campaign, creatorId: String(owner), endDate: new Date(0), raisedAmount: 100, goalAmount: 100 })
  await TransferRecipientModel.collection.insertOne({ _id: destination, campaignId: String(campaign), createdBy: String(owner), currency: 'GHS', type: 'ghipss', recipientCode: 'synthetic', accountNumber: '123', bankCode: 'bank' })
  await new MongoTransferRecipientRepository().recordReview(String(destination), String(staff), '$literal staff ownership review', payout.id)
})
it('stores actual destination details and preserves literal review text', async () => {
  const recipient = await TransferRecipientModel.findById(destination)
  expect(recipient?.reviews?.[0]).toMatchObject({ reviewNote: '$literal staff ownership review', destination: { recipientCode: 'synthetic', accountNumber: '123', bankCode: 'bank' } })
  const work = vi.fn(async () => 'reserved')
  expect(await new MongoManualPayoutApproval().run(requester, work, payout as never)).toBe('reserved')
  expect(work).toHaveBeenCalledOnce()
})
it.each(['recipientCode', 'accountNumber', 'bankCode', 'reviews'])('blocks a concurrent %s change before reservation', async field => {
  const original = TransferRecipientModel.findOneAndUpdate.bind(TransferRecipientModel)
  let changed = false
  const lock = vi.spyOn(TransferRecipientModel, 'findOneAndUpdate').mockImplementation((...args) => {
    const query = original(...args), execute = query.exec.bind(query)
    query.exec = async (...execArgs) => {
      if (!changed) { changed = true; await TransferRecipientModel.updateOne({ _id: destination }, { [field]: field === 'reviews' ? [] : 'changed' }, { session: null }) }
      return execute(...execArgs)
    }
    return query
  })
  const work = vi.fn()
  try {
    await expect(new MongoManualPayoutApproval().run(requester, work, payout as never)).rejects.toMatchObject({ statusCode: 409 })
    expect(lock.mock.calls.length).toBeGreaterThan(1)
    expect(work).not.toHaveBeenCalled()
  } finally { lock.mockRestore() }
})
it('requires the first approver snapshot to match as well', async () => {
  const work = vi.fn()
  await expect(new MongoManualPayoutApproval().run(requester, work, { ...payout, firstApprovedBy: 'legacy-maker' } as never)).rejects.toMatchObject({ statusCode: 409 })
  expect(work).not.toHaveBeenCalled()
})
