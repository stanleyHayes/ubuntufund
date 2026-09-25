import mongoose from 'mongoose'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js'
import { tagRecipientModes } from '../../src/infrastructure/database/tagRecipientModes.js'
import { PayoutAccountService } from '../../src/application/services/PayoutAccountService.js'
import { MongoPayoutAccountRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoPayoutAccountRepository.js'
import { TransferRecipientModel } from '../../src/infrastructure/database/models/TransferRecipientModel.js'
import { ApprovePayoutUseCase } from '../../src/application/use-cases/ApprovePayoutUseCase.js'
import { PayoutEntity } from '../../src/domain/entities/Payout.js'

const userId = new mongoose.Types.ObjectId().toString()
const wallets = () => mongoose.connection.collection('payoutaccounts')
beforeAll(connectTestDatabase)
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase() })
beforeEach(async () => {
  await wallets().deleteMany({})
  await TransferRecipientModel.deleteMany({})
})

const account = (changes: Record<string, unknown> = {}) => ({
  id: randomUUID(), fingerprint: randomUUID(), type: 'mobile_money', accountNumber: '0241234567', bankCode: 'MTN',
  accountName: 'Kwame Mensah', recipientCode: 'RCP_test_old', verificationStatus: 'name_matched', resolvedAccountName: 'KWAME MENSAH', ...changes,
})

describe('Paystack recipient mode cutover', () => {
  it('re-creates a test-mode saved recipient exactly once when used under the live key', async () => {
    const saved = account({ recipientMode: 'test' })
    await wallets().insertOne({ _id: userId as never, userId, accounts: [saved], consumptionWriteVersion: 0 })
    const gateway = { createTransferRecipient: vi.fn(async () => 'RCP_live_new'), resolveAccount: vi.fn() }
    const service = new PayoutAccountService(new MongoPayoutAccountRepository(), gateway as never, {} as never, 'live')
    const first = await service.get(userId, saved.id)
    expect(first).toMatchObject({ id: saved.id, fingerprint: saved.fingerprint, recipientCode: 'RCP_live_new', recipientMode: 'live', verificationStatus: 'name_matched' })
    const again = await service.get(userId, saved.id)
    expect(again.recipientCode).toBe('RCP_live_new')
    expect(gateway.createTransferRecipient).toHaveBeenCalledOnce()
  })

  it('leaves untagged and same-mode saved recipients alone', async () => {
    const untagged = account()
    const live = account({ recipientMode: 'live', recipientCode: 'RCP_live' })
    await wallets().insertOne({ _id: userId as never, userId, accounts: [untagged, live], consumptionWriteVersion: 0 })
    const gateway = { createTransferRecipient: vi.fn(), resolveAccount: vi.fn() }
    const service = new PayoutAccountService(new MongoPayoutAccountRepository(), gateway as never, {} as never, 'live')
    expect((await service.get(userId, untagged.id)).recipientCode).toBe('RCP_test_old')
    expect((await service.get(userId, live.id)).recipientCode).toBe('RCP_live')
    expect(gateway.createTransferRecipient).not.toHaveBeenCalled()
  })

  it('refuses to approve a payout to a campaign recipient registered in the other mode, before reserving', async () => {
    const recipient = await TransferRecipientModel.create({ campaignId: 'c', createdBy: 'owner', type: 'ghipss', accountNumber: '1', bankCode: 'b', accountName: 'Owner', recipientCode: 'RCP_test_old', recipientMode: 'test', currency: 'GHS' })
    const payout = new PayoutEntity({ id: 'p', status: 'PENDING', amount: 100, netAmount: 100, fee: 0, type: 'standard', currency: 'GHS', campaignId: 'c', recipientId: recipient.id, provider: 'paystack', requestedBy: 'owner', createdAt: new Date(), updatedAt: new Date() })
    const reserve = vi.fn()
    const { MongoTransferRecipientRepository } = await import('../../src/infrastructure/adapters/outbound/persistence/MongoTransferRecipientRepository.js')
    const recipients = new MongoTransferRecipientRepository()
    const gateway = { isConfigured: () => true, getBalance: vi.fn(async () => [{ currency: 'GHS', balance: 1000 }]), initiateTransfer: vi.fn() }
    const uc = new ApprovePayoutUseCase(
      { findById: async () => payout, lockPendingForReview: async () => payout } as never,
      Object.assign(recipients, { recordReview: vi.fn(async () => {}) }),
      { reserveForPayout: reserve } as never, gateway as never, { dualApprovalAmount: 0, maxTransferAmount: 50000 } as never,
      undefined, undefined, undefined, { run: async (_r: unknown, work: () => Promise<unknown>) => work() } as never, 'live',
    )
    await expect(uc.execute('p', { userId: 'admin', role: 'admin' }, 'Verified the owner and receiving capacity.')).rejects.toMatchObject({ statusCode: 409 })
    expect(reserve).not.toHaveBeenCalled()
    expect(gateway.initiateTransfer).not.toHaveBeenCalled()
  })

  it('reports untagged codes without writing unless applied, then tags them from the live key’s answer', async () => {
    await wallets().insertOne({ _id: userId as never, userId, accounts: [account({ recipientCode: 'RCP_known' }), account({ recipientCode: 'RCP_gone' })], consumptionWriteVersion: 0 })
    await TransferRecipientModel.create({ campaignId: 'c', createdBy: 'owner', type: 'ghipss', accountNumber: '1', bankCode: 'b', accountName: 'Owner', recipientCode: 'RCP_flaky', currency: 'GHS' })
    const lookup = vi.fn(async (code: string) => (code === 'RCP_known' ? 'found' : code === 'RCP_gone' ? 'missing' : 'unknown') as 'found' | 'missing' | 'unknown')

    const dry = await tagRecipientModes({ currentMode: 'live', apply: false, lookup })
    expect(dry).toEqual({ scanned: 3, current: 1, otherMode: 1, unresolved: 1, written: 0 })
    expect((await wallets().findOne({ _id: userId as never }))?.accounts.every((a: { recipientMode?: string }) => !a.recipientMode)).toBe(true)

    const applied = await tagRecipientModes({ currentMode: 'live', apply: true, lookup })
    expect(applied.written).toBe(2)
    const modes = (await wallets().findOne({ _id: userId as never }))?.accounts.map((a: { recipientCode: string; recipientMode?: string }) => [a.recipientCode, a.recipientMode])
    expect(modes).toEqual([['RCP_known', 'live'], ['RCP_gone', 'test']])
    expect((await TransferRecipientModel.findOne({ recipientCode: 'RCP_flaky' }))?.recipientMode).toBeUndefined()
  })
})
