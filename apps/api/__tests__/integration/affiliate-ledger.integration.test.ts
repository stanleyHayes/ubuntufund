import mongoose from 'mongoose'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js'
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js'
import { AffiliateModel } from '../../src/infrastructure/database/models/AffiliateModel.js'
import { AffiliateBalanceModel } from '../../src/infrastructure/database/models/AffiliateBalanceModel.js'
import { AffiliateCommissionModel } from '../../src/infrastructure/database/models/AffiliateCommissionModel.js'
import { AffiliatePayoutModel } from '../../src/infrastructure/database/models/AffiliatePayoutModel.js'
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js'
import { MongoAffiliateRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliateRepository.js'
import { MongoAffiliateBalanceRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliateBalanceRepository.js'
import { MongoAffiliateCommissionRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliateCommissionRepository.js'
import { MongoAffiliatePayoutRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliatePayoutRepository.js'
import { MongoAffiliateReferralRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliateReferralRepository.js'
import { MongoUnitOfWork } from '../../src/infrastructure/adapters/outbound/persistence/MongoUnitOfWork.js'
import { MongoPayoutClosureTransaction } from '../../src/infrastructure/adapters/outbound/persistence/MongoPayoutClosureTransaction.js'
import { MatureAffiliateCommissionsUseCase } from '../../src/application/use-cases/MatureAffiliateCommissionsUseCase.js'
import { RequestAffiliatePayoutUseCase } from '../../src/application/use-cases/RequestAffiliatePayoutUseCase.js'
import { RejectAffiliatePayoutUseCase } from '../../src/application/use-cases/RejectAffiliatePayoutUseCase.js'
import { HandleAffiliatePayoutWebhookUseCase } from '../../src/application/use-cases/HandleAffiliatePayoutWebhookUseCase.js'
import { GetAffiliateDashboardUseCase } from '../../src/application/use-cases/GetAffiliateDashboardUseCase.js'
import { AffiliateCommissionService } from '../../src/application/services/AffiliateCommissionService.js'
import { SetAffiliatePayoutRecipientUseCase } from '../../src/application/use-cases/SetAffiliatePayoutRecipientUseCase.js'
import { PayoutAccountService } from '../../src/application/services/PayoutAccountService.js'
import { MongoPayoutAccountRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoPayoutAccountRepository.js'

const commissions = new MongoAffiliateCommissionRepository()
const balances = new MongoAffiliateBalanceRepository()
const payouts = new MongoAffiliatePayoutRepository()
const affiliates = new MongoAffiliateRepository()
const uow = new MongoUnitOfWork()
const gateway = { isConfigured: () => true }
const day = 86_400_000

let owner: string, affiliateId: string, balanceId: string, staff: string
beforeAll(async () => {
  await connectTestDatabase()
  await Promise.all([AffiliateCommissionModel.init(), AffiliatePayoutModel.init(), AffiliateBalanceModel.init()])
})
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase() })
beforeEach(async () => {
  await Promise.all([UserModel, AffiliateModel, AffiliateBalanceModel, AffiliateCommissionModel, AffiliatePayoutModel, AuditLogModel].map((m) => (m as typeof UserModel).deleteMany({})))
  owner = new mongoose.Types.ObjectId().toString()
  staff = new mongoose.Types.ObjectId().toString()
  await UserModel.collection.insertMany([
    { _id: new mongoose.Types.ObjectId(owner), email: `aff-${owner}@example.test`, role: 'user' },
    { _id: new mongoose.Types.ObjectId(staff), email: `staff-${staff}@example.test`, role: 'admin', authVersion: 'current' },
  ])
  const affiliate = await AffiliateModel.create({ userId: owner, referralCode: `code-${owner.slice(-6)}`, status: 'active', commissionRate: 10, recipientCode: 'RCP_aff' })
  affiliateId = affiliate.id
  balanceId = (await balances.ensure(affiliateId, 'GHS')).id
})

async function commission(amount: number, status: 'held' | 'available', matured = true, ref = new mongoose.Types.ObjectId().toString()) {
  const doc = await AffiliateCommissionModel.create({
    affiliateId, refereeId: 'referee', source: 'subscription', sourceRef: `sub-${ref}`, amount, currency: 'GHS', baseAmount: amount * 10,
    commissionRate: 10, status, maturesAt: new Date(Date.now() + (matured ? -day : day)),
  })
  await AffiliateBalanceModel.updateOne({ _id: balanceId }, { $inc: { totalEarned: amount, ...(status === 'held' ? { pendingBalance: amount } : { availableBalance: amount }) } })
  return doc
}
const balance = async () => (await AffiliateBalanceModel.findById(balanceId).lean())!
const request = () => new RequestAffiliatePayoutUseCase(affiliates, payouts, balances, commissions, gateway as never, uow)

describe('affiliate commission maturity', () => {
  it('credits each due commission exactly once under concurrent runs and never touches unmatured ones', async () => {
    const due = await Promise.all([commission(10, 'held'), commission(20, 'held')])
    const later = await commission(40, 'held', false)
    const sweep = new MatureAffiliateCommissionsUseCase(commissions, balances, uow)
    await Promise.all([sweep.execute(), sweep.execute(), sweep.execute()])
    expect((await balance()).availableBalance).toBe(30)
    expect((await balance()).pendingBalance).toBe(40)
    for (const c of due) expect((await AffiliateCommissionModel.findById(c._id))?.status).toBe('available')
    expect((await AffiliateCommissionModel.findById(later._id))?.status).toBe('held')
  })

  it('scopes an owner-triggered maturity to that affiliate', async () => {
    await commission(10, 'held')
    const other = await AffiliateModel.create({ userId: new mongoose.Types.ObjectId().toString(), referralCode: 'other-code', status: 'active', commissionRate: 10 })
    await AffiliateCommissionModel.create({ affiliateId: other.id, refereeId: 'r', source: 'subscription', sourceRef: 'sub-other', amount: 5, currency: 'GHS', baseAmount: 50, commissionRate: 10, status: 'held', maturesAt: new Date(Date.now() - day) })
    expect((await commissions.findMaturedHeld(new Date(), affiliateId)).map((c) => c.affiliateId)).toEqual([affiliateId])
    const dashboard = new GetAffiliateDashboardUseCase(affiliates, balances, commissions, new MongoAffiliateReferralRepository(), 'https://example.test', uow)
    await dashboard.execute(owner)
    expect((await AffiliateCommissionModel.findOne({ sourceRef: 'sub-other' }))?.status).toBe('held')
  })

  it('never lets a maturity run overwrite a concurrent refund reversal', async () => {
    const c = await commission(10, 'held')
    const service = new AffiliateCommissionService(affiliates, new MongoAffiliateReferralRepository(), commissions, balances, { commissionPercent: 10, holdDays: 14 })
    await Promise.all([service.reverseForSourceRef(c.sourceRef), new MatureAffiliateCommissionsUseCase(commissions, balances, uow).execute()])
    // Whichever runs first, the refund wins: the commission ends reversed and
    // its 10 is unwound from whichever bucket held it — never left available.
    expect((await AffiliateCommissionModel.findById(c._id))?.status).toBe('reversed')
    expect(await balance()).toMatchObject({ availableBalance: 0, pendingBalance: 0, totalEarned: 0 })
  })
})

describe('affiliate payout ledger', () => {
  it('refuses a suspended affiliate before reserving anything', async () => {
    await commission(25, 'available')
    await AffiliateModel.updateOne({ _id: affiliateId }, { status: 'suspended' })
    await expect(request().execute(owner, { amount: 25 })).rejects.toMatchObject({ statusCode: 403 })
    expect((await balance()).availableBalance).toBe(25)
    expect(await AffiliatePayoutModel.countDocuments()).toBe(0)
  })

  it('withdraws the full balance, links its commissions and marks them paid when the transfer lands', async () => {
    const a = await commission(10, 'available')
    const b = await commission(15, 'available')
    await expect(request().execute(owner, { amount: 10 })).rejects.toMatchObject({ statusCode: 422 })
    const payout = await request().execute(owner, { amount: 25 })
    expect((await balance()).availableBalance).toBe(0)
    for (const c of [a, b]) expect((await AffiliateCommissionModel.findById(c._id))?.payoutId).toBe(payout.id)

    await AffiliatePayoutModel.updateOne({ _id: payout.id }, { status: 'PROCESSING', providerRef: `aff-${payout.id}-x` })
    const webhook = new HandleAffiliatePayoutWebhookUseCase(payouts, balances, commissions)
    await webhook.handleSuccess(`aff-${payout.id}-x`)
    await webhook.handleSuccess(`aff-${payout.id}-x`)
    for (const c of [a, b]) expect((await AffiliateCommissionModel.findById(c._id))?.status).toBe('paid')
    expect((await balance()).paidOutBalance).toBe(25)
  })

  it('returns linked commissions to available when the transfer fails', async () => {
    const a = await commission(12, 'available')
    const payout = await request().execute(owner, { amount: 12 })
    await AffiliatePayoutModel.updateOne({ _id: payout.id }, { status: 'PROCESSING', providerRef: `aff-${payout.id}-f` })
    await new HandleAffiliatePayoutWebhookUseCase(payouts, balances, commissions).handleFailed(`aff-${payout.id}-f`)
    const row = await AffiliateCommissionModel.findById(a._id).lean()
    expect(row?.status).toBe('available')
    expect(row?.payoutId).toBeUndefined()
    expect((await balance()).availableBalance).toBe(12)
  })

  it('records a refund after payout as outstanding clawback and withholds it from the next withdrawal', async () => {
    const paid = await commission(10, 'available')
    const payout = await request().execute(owner, { amount: 10 })
    await AffiliatePayoutModel.updateOne({ _id: payout.id }, { status: 'PROCESSING', providerRef: `aff-${payout.id}-p` })
    await new HandleAffiliatePayoutWebhookUseCase(payouts, balances, commissions).handleSuccess(`aff-${payout.id}-p`)

    const service = new AffiliateCommissionService(affiliates, new MongoAffiliateReferralRepository(), commissions, balances, { commissionPercent: 10, holdDays: 14 })
    await service.reverseForSourceRef(paid.sourceRef)
    await service.reverseForSourceRef(paid.sourceRef)
    expect(await balance()).toMatchObject({ clawbackOutstanding: 10, totalEarned: 0 })

    await commission(25, 'available')
    const dashboard = await new GetAffiliateDashboardUseCase(affiliates, balances, commissions, new MongoAffiliateReferralRepository(), 'https://example.test', uow).execute(owner)
    expect(dashboard.stats.availableBalance).toBe(15)
    await expect(request().execute(owner, { amount: 25 })).rejects.toMatchObject({ statusCode: 422 })
    await request().execute(owner, { amount: 15 })
    expect((await balance()).availableBalance).toBe(10)
  })

  it('an admin rejection returns the reservation exactly once, releases the commissions and is audited', async () => {
    const a = await commission(30, 'available')
    const payout = await request().execute(owner, { amount: 30 })
    const reject = new RejectAffiliatePayoutUseCase(payouts, balances, commissions, new MongoPayoutClosureTransaction())
    const admin = { userId: staff, role: 'admin', authVersion: 'current' }
    const reason = 'Destination is not in the affiliate’s own name.'
    await expect(reject.execute(payout.id, { userId: owner, role: 'user' }, reason)).rejects.toMatchObject({ statusCode: 403 })
    const results = await Promise.allSettled([reject.execute(payout.id, admin, reason), reject.execute(payout.id, admin, reason)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((await balance()).availableBalance).toBe(30)
    expect(await AffiliatePayoutModel.findById(payout.id).lean()).toMatchObject({ status: 'FAILED', settlementApplied: true })
    expect((await AffiliateCommissionModel.findById(a._id).lean())?.payoutId).toBeUndefined()
    expect(await AuditLogModel.countDocuments({ action: 'affiliate_payout.rejected', resource: payout.id, reason })).toBe(1)
    // A late repair sweep for the FAILED payout cannot return it a second time.
    await new HandleAffiliatePayoutWebhookUseCase(payouts, balances, commissions).repairSettlement(payout.id)
    expect((await balance()).availableBalance).toBe(30)
  })

  it('logs and records a clawback when the reversal bucket no longer covers the commission', async () => {
    const reserved = await commission(20, 'available')
    await request().execute(owner, { amount: 20 })
    const service = new AffiliateCommissionService(affiliates, new MongoAffiliateReferralRepository(), commissions, balances, { commissionPercent: 10, holdDays: 14 })
    const { logger } = await import('../../src/infrastructure/logging/logger.js')
    const error = vi.spyOn(logger, 'error')
    await service.reverseForSourceRef(reserved.sourceRef)
    expect(error).toHaveBeenCalled()
    expect((await balance()).clawbackOutstanding).toBe(20)
    error.mockRestore()
  })
})

describe('affiliate payout destination', () => {
  const setup = (resolvedName: string) => {
    const provider = { isConfigured: () => true, resolveAccount: vi.fn(async () => ({ accountName: resolvedName })), createTransferRecipient: vi.fn(async () => 'RCP_saved_aff') }
    const plans = { resolvePlan: async () => ({ name: 'Free', tier: 'free', maxPayoutAccounts: 2 }) }
    const accounts = new PayoutAccountService(new MongoPayoutAccountRepository(), provider as never, plans as never, 'test')
    return { accounts, provider, useCase: new SetAffiliatePayoutRecipientUseCase(affiliates, provider as never, accounts) }
  }
  beforeEach(async () => {
    await AffiliateModel.updateOne({ _id: affiliateId }, { $unset: { recipientCode: 1 } })
    await mongoose.connection.collection('payoutaccounts').deleteMany({})
  })

  it('uses a name-matched saved account and copies its recipient, enabling a payout request', async () => {
    const { accounts, useCase } = setup('MENSAH KWAME')
    const saved = await accounts.add(owner, { type: 'mobile_money', accountNumber: '0241234567', bankCode: 'MTN', accountName: 'Kwame Mensah' })
    await expect(request().execute(owner, { amount: 5 })).rejects.toMatchObject({ statusCode: 400 })
    const updated = await useCase.execute(owner, { savedAccountId: saved.id })
    expect(updated).toMatchObject({ recipientCode: 'RCP_saved_aff', accountName: 'Kwame Mensah', bankCode: 'MTN' })
    await commission(5, 'available')
    await expect(request().execute(owner, { amount: 5 })).resolves.toMatchObject({ status: 'PENDING' })
  })

  it.each(['saved', 'entered'] as const)('refuses a %s account whose provider-held name did not match', async (via) => {
    const { accounts, useCase } = setup('Somebody Else')
    const details = { type: 'mobile_money' as const, accountNumber: '0249876543', bankCode: 'MTN', accountName: 'Kwame Mensah' }
    const input = via === 'saved' ? { savedAccountId: (await accounts.add(owner, details)).id } : details
    await expect(useCase.execute(owner, input)).rejects.toMatchObject({ statusCode: 422 })
    expect((await AffiliateModel.findById(affiliateId).lean())?.recipientCode).toBeUndefined()
  })
})
