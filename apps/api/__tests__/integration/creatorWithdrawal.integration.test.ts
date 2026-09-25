import { SUBSCRIPTION_PLANS, SubscriptionTier } from '@ubuntu-fund/types'
import { MongoSubscriptionRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoSubscriptionRepository.js'
import { MongoSubscriptionPlanRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoSubscriptionPlanRepository.js'
import mongoose from 'mongoose'
import { MongoCreatorWithdrawalTransaction } from '../../src/infrastructure/adapters/outbound/persistence/MongoCreatorWithdrawalTransaction.js'
import { MongoWalletPayoutRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoWalletPayoutRepository.js'
import { MongoCreatorPayoutRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCreatorPayoutRepository.js'
import { WalletModel } from '../../src/infrastructure/database/models/WalletModel.js'
import { SubscriptionPlanModel } from '../../src/infrastructure/database/models/SubscriptionPlanModel.js'
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js'
import { createHmac, randomUUID } from 'node:crypto'

const PAYSTACK_SECRET = 'sk_test_creator_withdrawal_secret'
process.env.PAYSTACK_SECRET_KEY = PAYSTACK_SECRET
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_creator_withdrawal_public'
process.env.PUBLIC_WEB_URL = 'https://give.example.test'

import { describe, it, beforeAll, afterAll, expect, vi } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createTestApp } from '../helpers/testApp.js'
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js'
import { CreatorBalanceModel } from '../../src/infrastructure/database/models/CreatorBalanceModel.js'
import { CreatorPayoutModel } from '../../src/infrastructure/database/models/CreatorPayoutModel.js'
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js'
import { grantCurrentKyc } from '../helpers/currentKyc.js'
import { KYCVerificationModel } from '../../src/infrastructure/database/models/KYCVerificationModel.js'

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`
}
function sign(raw: string): string {
  return createHmac('sha512', PAYSTACK_SECRET).update(raw).digest('hex')
}

describe('Creator withdrawal — transfer rail', () => {
  let app: Express
  // Toggled by a test to simulate a provider recipient-creation failure.
  let failRecipient = false
  let failTransfer = false
  let transferAmount: unknown
  let transferSnapshot: { status?: string; availableBalance?: number; reference?: string }
  // Paystack's definitive refusal of POST /transfer (HTTP 4xx, status:false).
  let rejectTransfer = false
  let platformBalanceMinor = 100_000_000
  let verifyNotFound = false
  let duringTransfer: ((reference: string) => Promise<void>) | undefined

  beforeAll(async () => {
    await connectTestDatabase()
    app = await createTestApp()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown, opts: unknown) => {
        const u = String(url)
        const body = (opts as { body?: string })?.body
          ? (JSON.parse((opts as { body: string }).body) as Record<string, unknown>)
          : {}
        const json = (p: unknown) =>
          ({ ok: true, status: 200, json: async () => p }) as unknown as Response
        if (u.includes('/bank/resolve'))
          return json({ status: true, data: { account_name: 'With Draw' } })
        if (u.includes('/transferrecipient')) {
          if (failRecipient) throw new Error('recipient creation failed')
          return json({ status: true, data: { recipient_code: `RCP_${randomUUID().slice(0, 8)}` } })
        }
        if (u.includes('/balance'))
          return json({ status: true, data: [{ currency: 'GHS', balance: platformBalanceMinor }] })
        if (u.includes('/transfer/verify/')) {
          const ref = decodeURIComponent(u.split('/transfer/verify/')[1] ?? '')
          if (verifyNotFound)
            return { ok: false, status: 404, json: async () => ({ status: false, message: 'Transfer not found' }) } as unknown as Response
          return json({
            status: true,
            data: { status: 'success', reference: ref, transfer_code: 'TRF_x' },
          })
        }
        if (u.includes('/transfer')) {
          const committed = await CreatorPayoutModel.collection.findOne({ providerRef: body.reference }, { session: null })
          const balance = committed ? await CreatorBalanceModel.collection.findOne({ userId: committed.creatorUserId }, { session: null }) : null
          transferSnapshot = { status: committed?.status, availableBalance: balance?.availableBalance, reference: committed?.providerRef }
          transferAmount = body.amount
          if (duringTransfer) await duringTransfer(String(body.reference))
          if (failTransfer) throw new Error('transfer response timed out')
          if (rejectTransfer)
            return { ok: false, status: 400, json: async () => ({ status: false, message: 'Your balance is not enough to fulfil this request' }) } as unknown as Response
          return json({
            status: true,
            data: {
              transfer_code: `TRF_${randomUUID().slice(0, 8)}`,
              status: 'pending',
              reference: body.reference,
            },
          })
        }
        throw new Error(`unexpected fetch ${u}`)
      }),
    )
  })
  afterAll(async () => {
    await dropTestDatabase()
    await disconnectTestDatabase()
    vi.unstubAllGlobals()
  })

  async function creatorWithBalance(available: number) {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('cw'), password: 'SecurePass123', name: 'With Draw' })
      .expect(201)
    const token = reg.body.data.tokens.accessToken as string
    const userId = reg.body.data.user.id as string
    await SubscriptionModel.create({
      userId,
      tier: 'starter',
      status: 'active',
      billingCycle: 'monthly',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 86400000),
    })
    const handle = `wd-${randomUUID().slice(0, 6)}`
    await request(app)
      .post('/api/v1/creators/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ handle, displayName: 'With Draw' })
      .expect(200)
    // Bank and mobile-money withdrawals need current identity verification.
    await grantCurrentKyc(userId)
    // Fund the tip balance directly.
    await CreatorBalanceModel.updateOne(
      { userId },
      { $set: { userId, currency: 'GHS', availableBalance: available } },
      { upsert: true },
    )
    return { token, userId }
  }

  it('denies another creator’s withdrawal key without disclosing payout data or moving funds', async () => {
    const owner = await creatorWithBalance(200)
    const other = await creatorWithBalance(200)
    const key = randomUUID()
    const body = { amount: 100, expectedFeePercent: 3, idempotencyKey: key, recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } }
    await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`).send(body).expect(201)
    const payout = await CreatorPayoutModel.findOne({ requestKey: key }).lean()
    expect(payout).not.toBeNull()
    const providerCalls = vi.mocked(fetch).mock.calls.length
    for (const destination of ['paystack', 'ujimora_wallet']) {
      const response = await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${other.token}`).send({ ...body, destination }).expect(409)
      expect(response.body.data).toBeUndefined()
      expect(JSON.stringify(response.body)).not.toContain(owner.userId)
      expect(JSON.stringify(response.body)).not.toContain(payout!.providerRef)
    }
    expect(vi.mocked(fetch).mock.calls.length).toBe(providerCalls)
    expect((await CreatorBalanceModel.findOne({ userId: other.userId }))?.availableBalance).toBe(200)
    expect(await CreatorPayoutModel.countDocuments({ creatorUserId: other.userId })).toBe(0)
    expect(await CreatorPayoutModel.findOne({ requestKey: key }).lean()).toEqual(payout)
    // Simulate a request whose first lookup ran before the other owner's insert.
    // The real unique index then selects the winner after this request reserves.
    expect(await CreatorPayoutModel.collection.indexes()).toEqual(expect.arrayContaining([expect.objectContaining({ key: { requestKey: 1 }, unique: true })]))
    const lookup = vi.spyOn(MongoCreatorPayoutRepository.prototype, 'findByRequestKey').mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    try {
      await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${other.token}`).send(body).expect(409)
    } finally { lookup.mockRestore() }
    expect((await CreatorBalanceModel.findOne({ userId: other.userId }))?.availableBalance).toBe(200)
    expect(await CreatorPayoutModel.countDocuments({ creatorUserId: other.userId })).toBe(0)
    expect(await CreatorPayoutModel.findOne({ requestKey: key }).lean()).toEqual(payout)
    const callsAfterRace = vi.mocked(fetch).mock.calls.length
    await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`).send(body).expect(201)
    expect(vi.mocked(fetch).mock.calls.length).toBe(callsAfterRace)
    expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(100)
  })

  it.each(['missing', 'expired', 'pending renewal', 'rejected renewal'] as const)(
    'refuses a bank withdrawal when identity verification is %s, before any provider call',
    async (state) => {
      const owner = await creatorWithBalance(100)
      if (state === 'missing') await KYCVerificationModel.deleteMany({ userId: owner.userId })
      if (state === 'expired') await KYCVerificationModel.updateMany({ userId: owner.userId }, { expiryDate: new Date(Date.now() - 1000) })
      if (state === 'pending renewal' || state === 'rejected renewal')
        await KYCVerificationModel.create({ userId: owner.userId, verificationType: 'identity', status: state === 'pending renewal' ? 'pending' : 'rejected', documents: [], riskLevel: 'low', createdAt: new Date(Date.now() + 1000) })
      const callsBefore = vi.mocked(fetch).mock.calls.length
      const res = await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`)
        .send({ amount: 100, expectedFeePercent: 3, idempotencyKey: randomUUID(), recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } })
        .expect(409)
      expect(res.body.message).toMatch(/identity/i)
      expect(vi.mocked(fetch).mock.calls.length).toBe(callsBefore)
      expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(100)
      expect(await CreatorPayoutModel.countDocuments({ creatorUserId: owner.userId })).toBe(0)
    },
  )

  it('tells a creator with current identity verification but an unverified email to verify their email', async () => {
    const owner = await creatorWithBalance(100)
    await UserModel.updateOne({ _id: owner.userId }, { emailVerified: false })
    const callsBefore = vi.mocked(fetch).mock.calls.length
    const res = await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`)
      .send({ amount: 100, expectedFeePercent: 3, idempotencyKey: randomUUID(), recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } })
      .expect(409)
    expect(res.body.message).toMatch(/^Verify your email address before withdrawing creator funds/)
    expect(res.body.message).not.toMatch(/identity/i)
    expect(vi.mocked(fetch).mock.calls.length).toBe(callsBefore)
    expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(100)
  })

  it('refuses an unmatched account, then withdraws once the name is re-entered surname-first', async () => {
    const owner = await creatorWithBalance(100)
    const recipient = { type: 'mobile_money', accountNumber: '0557654321', bankCode: 'MTN' }
    const refused = await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`)
      .send({ amount: 50, expectedFeePercent: 3, idempotencyKey: randomUUID(), recipient: { ...recipient, accountName: 'Someone Else' } })
      .expect(422)
    expect(refused.body.message).toMatch(/did not match/i)
    expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(100)
    // The provider holds "With Draw"; "DRAW WITH" is the same person, surname first.
    await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`)
      .send({ amount: 50, expectedFeePercent: 3, idempotencyKey: randomUUID(), recipient: { ...recipient, accountName: 'DRAW WITH' } })
      .expect(201)
    expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(50)
  })

  it('returns the reservation at once when Paystack definitively rejects the transfer', async () => {
    const owner = await creatorWithBalance(100)
    rejectTransfer = true
    try {
      const res = await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`)
        .send({ amount: 100, expectedFeePercent: 3, idempotencyKey: randomUUID(), recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } })
        .expect(502)
      expect(res.body.message).toMatch(/balance has been restored/i)
    } finally { rejectTransfer = false }
    const payout = await CreatorPayoutModel.findOne({ creatorUserId: owner.userId }).lean()
    expect(payout).toMatchObject({ status: 'FAILED', settlementApplied: true })
    expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(100)
  })

  it('refuses before reserving anything when the platform balance cannot fund the transfer', async () => {
    const owner = await creatorWithBalance(100)
    platformBalanceMinor = 50_00
    const transfersBefore = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length
    try {
      await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`)
        .send({ amount: 100, expectedFeePercent: 3, idempotencyKey: randomUUID(), recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } })
        .expect(503)
    } finally { platformBalanceMinor = 100_000_000 }
    expect(await CreatorPayoutModel.countDocuments({ creatorUserId: owner.userId })).toBe(0)
    expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(100)
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length).toBe(transfersBefore)
  })

  it('commits the recipient before POST /transfer so a transfer-approval callback during the call is approved', async () => {
    const owner = await creatorWithBalance(100)
    const approvals: number[] = []
    duringTransfer = async (reference) => {
      const row = await CreatorPayoutModel.collection.findOne({ providerRef: reference }, { session: null })
      expect(row?.recipientCode).toMatch(/^RCP_/)
      const raw = JSON.stringify({ reference, amount: Math.round((row?.netAmount as number) * 100), currency: 'GHS', recipient: { recipient_code: row?.recipientCode } })
      const res = await request(app).post('/api/v1/payouts/paystack-approval').set('x-paystack-signature', sign(raw)).set('Content-Type', 'application/json').send(raw)
      approvals.push(res.status)
    }
    try {
      await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`)
        .send({ amount: 100, expectedFeePercent: 3, idempotencyKey: randomUUID(), recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } })
        .expect(201)
    } finally { duringTransfer = undefined }
    expect(approvals).toEqual([200])
  })

  it('lets an admin resolve a withdrawal escalated to review once Paystack has no such transfer, returning funds exactly once', async () => {
    const owner = await creatorWithBalance(100)
    failTransfer = true
    let reference = ''
    try {
      const started = await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`)
        .send({ amount: 100, expectedFeePercent: 3, idempotencyKey: randomUUID(), recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } })
        .expect(201)
      reference = started.body.data.reference
    } finally { failTransfer = false }
    expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(0)
    const payout = await CreatorPayoutModel.findOne({ providerRef: reference })
    // The reconciler escalates after the dwell window; simulate that state.
    await CreatorPayoutModel.updateOne({ _id: payout!._id }, { status: 'NEEDS_REVIEW' })

    const adminEmail = uniqueEmail('cw-admin')
    const reg = await request(app).post('/api/v1/auth/register')
      .send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: adminEmail, password: 'SecurePass123', name: 'Admin' })
      .expect(201)
    await UserModel.updateOne({ _id: reg.body.data.user.id }, { role: 'admin' })
    const login = await request(app).post('/api/v1/auth/login').send({ email: adminEmail, password: 'SecurePass123' }).expect(200)
    const admin = `Bearer ${login.body.data.tokens.accessToken}`
    const note = { note: 'Paystack dashboard shows no transfer under this reference.' }

    await request(app).post(`/api/v1/payouts/stuck/creator/${payout!.id}/resolve`).set('Authorization', `Bearer ${owner.token}`).send(note).expect(403)
    await request(app).post(`/api/v1/payouts/stuck/wallet/${payout!.id}/resolve`).set('Authorization', admin).send(note).expect(404)
    verifyNotFound = true
    try {
      const resolved = await request(app).post(`/api/v1/payouts/stuck/creator/${payout!.id}/resolve`).set('Authorization', admin).send(note).expect(200)
      expect(resolved.body.data).toMatchObject({ providerOutcome: 'failed', status: 'FAILED' })
      await request(app).post(`/api/v1/payouts/stuck/creator/${payout!.id}/resolve`).set('Authorization', admin).send(note).expect(409)
    } finally { verifyNotFound = false }
    expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(100)
    expect(await CreatorPayoutModel.findById(payout!._id).lean()).toMatchObject({ status: 'FAILED', settlementApplied: true })
  })

  it('rechecks identity verification at the reservation write boundary', async () => {
    const owner = await creatorWithBalance(100)
    const original = MongoCreatorWithdrawalTransaction.prototype.run
    const transaction = vi.spyOn(MongoCreatorWithdrawalTransaction.prototype, 'run').mockImplementationOnce(async function (this: MongoCreatorWithdrawalTransaction, userId, version, work) {
      await KYCVerificationModel.updateMany({ userId }, { expiryDate: new Date(Date.now() - 1000) })
      return original.call(this, userId, version, work)
    })
    const transfersBefore = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length
    try {
      await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`)
        .send({ amount: 100, expectedFeePercent: 3, idempotencyKey: randomUUID(), recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } })
        .expect(409)
    } finally { transaction.mockRestore() }
    expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(100)
    expect(await CreatorPayoutModel.countDocuments({ creatorUserId: owner.userId })).toBe(0)
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length).toBe(transfersBefore)
  })

  it('keeps Ujimora Wallet transfers (money that stays on the platform) available without identity verification', async () => {
    const owner = await creatorWithBalance(100)
    await KYCVerificationModel.deleteMany({ userId: owner.userId })
    await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`)
      .send({ amount: 100, expectedFeePercent: 3, destination: 'ujimora_wallet', idempotencyKey: randomUUID() })
      .expect(201)
    expect((await WalletModel.findOne({ userId: owner.userId }))?.balance).toBe(97)
  })

  it.each([
    [4.99, 'paystack'],
    [1, 'ujimora_wallet'],
  ] as const)('refuses a withdrawal of %s below the minimum (%s) without reserving anything', async (amount, destination) => {
    const owner = await creatorWithBalance(100)
    const res = await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`)
      .send({ amount, expectedFeePercent: 3, destination, idempotencyKey: randomUUID(), recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } })
      .expect(422)
    expect(res.body.message).toMatch(/minimum withdrawal/i)
    expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(100)
    expect(await CreatorPayoutModel.countDocuments({ creatorUserId: owner.userId })).toBe(0)
  })

  it.each(['closure', 'credentials'] as const)('rejects wallet transfer when %s changes after authentication', async change => {
    const owner = await creatorWithBalance(100)
    const original = MongoWalletPayoutRepository.prototype.transferCreator
    const transfer = vi.spyOn(MongoWalletPayoutRepository.prototype, 'transferCreator').mockImplementationOnce(async function (this: MongoWalletPayoutRepository, input) {
      await UserModel.updateOne({ _id: owner.userId }, { $set: change === 'closure' ? { deletedAt: new Date() } : { authVersion: 'revoked-during-request' } })
      return original.call(this, input)
    })
    try {
      await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`).send({ amount: 100, expectedFeePercent: 3, destination: 'ujimora_wallet', idempotencyKey: randomUUID() }).expect(401)
    } finally { transfer.mockRestore() }
    expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(100)
    expect(await CreatorPayoutModel.countDocuments({ creatorUserId: owner.userId })).toBe(0)
    expect((await WalletModel.findOne({ userId: owner.userId }))?.balance).toBe(0)
  })

  it.each(['closure', 'credentials'] as const)('rejects bank transfer when %s changes before the reservation transaction', async change => {
    const owner = await creatorWithBalance(100)
    const original = MongoCreatorWithdrawalTransaction.prototype.run
    const transaction = vi.spyOn(MongoCreatorWithdrawalTransaction.prototype, 'run').mockImplementationOnce(async function (this: MongoCreatorWithdrawalTransaction, userId, version, work) {
      await UserModel.updateOne({ _id: userId }, { $set: change === 'closure' ? { deletedAt: new Date() } : { authVersion: 'revoked-before-reservation' } })
      return original.call(this, userId, version, work)
    })
    const transfersBefore = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length
    try {
      await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`).send({ amount: 100, expectedFeePercent: 3, idempotencyKey: randomUUID(), recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } }).expect(401)
    } finally { transaction.mockRestore() }
    expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(100)
    expect(await CreatorPayoutModel.countDocuments({ creatorUserId: owner.userId })).toBe(0)
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length).toBe(transfersBefore)
  })

  it('rejects a changed balance currency before sending or retaining a reservation', async () => {
    const owner = await creatorWithBalance(100)
    const original = MongoCreatorWithdrawalTransaction.prototype.run
    const transaction = vi.spyOn(MongoCreatorWithdrawalTransaction.prototype, 'run').mockImplementationOnce(async function (this: MongoCreatorWithdrawalTransaction, userId, version, work) {
      await CreatorBalanceModel.updateOne({ userId }, { $set: { currency: 'USD' } })
      return original.call(this, userId, version, work)
    })
    const before = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length
    try {
      await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`).send({ amount: 100, expectedFeePercent: 3, idempotencyKey: randomUUID(), recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } }).expect(409)
    } finally { transaction.mockRestore() }
    expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(100)
    expect(await CreatorPayoutModel.countDocuments({ creatorUserId: owner.userId })).toBe(0)
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length).toBe(before)
  })

  it('rolls back reservation and payout when the processing transition fails, then permits retry', async () => {
    const owner = await creatorWithBalance(100)
    const body = { amount: 100, expectedFeePercent: 3, idempotencyKey: randomUUID(), recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } }
    const transition = vi.spyOn(MongoCreatorPayoutRepository.prototype, 'transitionToProcessing').mockResolvedValueOnce(null)
    const transfersBefore = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length
    try {
      await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`).send(body).expect(502)
    } finally { transition.mockRestore() }
    expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(100)
    expect(await CreatorPayoutModel.countDocuments({ creatorUserId: owner.userId })).toBe(0)
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length).toBe(transfersBefore)
    await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`).send(body).expect(201)
    expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(0)
    expect(await CreatorPayoutModel.countDocuments({ creatorUserId: owner.userId, status: 'PROCESSING' })).toBe(1)
  })

  it('commits the processing reference before the provider call and pays once for concurrent identical requests', async () => {
    const owner = await creatorWithBalance(100)
    const body = { amount: 100, expectedFeePercent: 3, idempotencyKey: randomUUID(), recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } }
    const before = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length
    const responses = await Promise.all([0, 1].map(() => request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`).send(body)))
    expect(responses.map(response => response.status)).toEqual([201, 201])
    const payout = await CreatorPayoutModel.findOne({ creatorUserId: owner.userId })
    expect(transferSnapshot).toEqual({ status: 'PROCESSING', availableBalance: 0, reference: payout!.providerRef })
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length - before).toBe(1)
    expect(await CreatorPayoutModel.countDocuments({ creatorUserId: owner.userId })).toBe(1)
  })

  it.each(['removed', 'review', 'details'] as const)('rejects a %s payout destination at final reservation', async change => {
    const owner = await creatorWithBalance(100)
    const original = MongoCreatorWithdrawalTransaction.prototype.run
    const transaction = vi.spyOn(MongoCreatorWithdrawalTransaction.prototype, 'run').mockImplementationOnce(async function (this: MongoCreatorWithdrawalTransaction, userId, version, work) {
      const accounts = mongoose.connection.collection('payoutaccounts')
      if (change === 'removed') await accounts.deleteOne({ userId })
      else await accounts.updateOne({ userId }, { $set: change === 'review' ? { 'accounts.0.verificationStatus': 'needs_review' } : { 'accounts.0.accountNumber': '0559999999' } })
      return original.call(this, userId, version, work)
    })
    const before = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length
    try {
      await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`).send({ amount: 100, expectedFeePercent: 3, idempotencyKey: randomUUID(), recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } }).expect(409)
    } finally { transaction.mockRestore() }
    expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(100)
    expect(await CreatorPayoutModel.countDocuments({ creatorUserId: owner.userId })).toBe(0)
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length).toBe(before)
  })

  it.each(['plan fee', 'subscription expiry'] as const)('rejects a changed %s before committing the reviewed withdrawal fee', async change => {
    const owner = await creatorWithBalance(100)
    const plan = await SubscriptionPlanModel.findOne({ tier: 'starter' })
    const original = MongoCreatorWithdrawalTransaction.prototype.run
    const transaction = vi.spyOn(MongoCreatorWithdrawalTransaction.prototype, 'run').mockImplementationOnce(async function (this: MongoCreatorWithdrawalTransaction, userId, version, work) {
      if (change === 'plan fee') await SubscriptionPlanModel.updateOne({ tier: 'starter' }, { $set: { platformFeePercent: 4 } })
      else await SubscriptionModel.updateOne({ userId }, { $set: { currentPeriodEnd: new Date(Date.now() - 1000) } })
      return original.call(this, userId, version, work)
    })
    const before = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length
    try {
      await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`).send({ amount: 100, expectedFeePercent: 3, idempotencyKey: randomUUID(), recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } }).expect(409)
    } finally {
      transaction.mockRestore()
      await SubscriptionPlanModel.updateOne({ tier: 'starter' }, { $set: { platformFeePercent: plan!.platformFeePercent } })
    }
    expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(100)
    expect(await CreatorPayoutModel.countDocuments({ creatorUserId: owner.userId })).toBe(0)
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length).toBe(before)
  })

  it.each(['plan fee', 'subscription expiry'] as const)('rejects a changed wallet %s before crediting funds', async change => {
    const owner = await creatorWithBalance(100)
    const plan = await SubscriptionPlanModel.findOne({ tier: 'starter' })
    const original = MongoWalletPayoutRepository.prototype.transferCreator
    const transfer = vi.spyOn(MongoWalletPayoutRepository.prototype, 'transferCreator').mockImplementationOnce(async function (this: MongoWalletPayoutRepository, input) {
      if (change === 'plan fee') await SubscriptionPlanModel.updateOne({ tier: 'starter' }, { $set: { platformFeePercent: 4 } })
      else await SubscriptionModel.updateOne({ userId: owner.userId }, { $set: { currentPeriodEnd: new Date(Date.now() - 1000) } })
      return original.call(this, input)
    })
    try {
      await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`).send({ amount: 100, expectedFeePercent: 3, destination: 'ujimora_wallet', idempotencyKey: randomUUID() }).expect(409)
    } finally {
      transfer.mockRestore()
      await SubscriptionPlanModel.updateOne({ tier: 'starter' }, { $set: { platformFeePercent: plan!.platformFeePercent } })
    }
    expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(100)
    expect((await WalletModel.findOne({ userId: owner.userId }))?.balance).toBe(0)
    expect(await CreatorPayoutModel.countDocuments({ creatorUserId: owner.userId })).toBe(0)
  })

  it.each(['paystack', 'ujimora_wallet'] as const)('retries %s fee validation after concurrent policy edits', async destination => {
    for (const change of ['subscription', 'plan'] as const) {
      const owner = await creatorWithBalance(100)
      const plan = await SubscriptionPlanModel.findOne({ tier: 'starter' })
      const target = change === 'subscription' ? MongoSubscriptionRepository.prototype : MongoSubscriptionPlanRepository.prototype
      const original = target.lockForConsumption
      // The owner write has already established the transaction snapshot. Mutate
      // the policy outside that session before the policy write, forcing retry.
      const lock = vi.spyOn(target, 'lockForConsumption').mockImplementationOnce(async function (this: typeof target, key) {
        if (change === 'subscription') await SubscriptionModel.collection.updateOne({ userId: owner.userId }, { $set: { currentPeriodEnd: new Date(Date.now() - 1000) } }, { session: null })
        else await SubscriptionPlanModel.collection.updateOne({ tier: 'starter' }, { $set: { platformFeePercent: 4 } }, { session: null })
        return original.call(this, key)
      })
      const before = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length
      try {
        await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`).send({ amount: 100, expectedFeePercent: 3, destination, idempotencyKey: randomUUID(), recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } }).expect(409)
        expect(lock.mock.calls.length).toBeGreaterThanOrEqual(2)
      } finally {
        lock.mockRestore()
        await SubscriptionPlanModel.updateOne({ tier: 'starter' }, { $set: { platformFeePercent: plan!.platformFeePercent } })
      }
      expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(100)
      expect((await WalletModel.findOne({ userId: owner.userId }))?.balance).toBe(0)
      expect(await CreatorPayoutModel.countDocuments({ creatorUserId: owner.userId })).toBe(0)
      expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length).toBe(before)
    }
  })

  it.each(['paystack', 'ujimora_wallet'] as const)('materializes missing built-in policy before %s withdrawal', async destination => {
    const owner = await creatorWithBalance(100)
    await SubscriptionModel.deleteOne({ userId: owner.userId })
    const free = await SubscriptionPlanModel.findOne({ tier: 'free' }).lean()
    await SubscriptionPlanModel.deleteOne({ tier: 'free' })
    try {
      await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`).send({ amount: 100, expectedFeePercent: 3.5, destination, idempotencyKey: randomUUID(), recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } }).expect(201)
      expect(await SubscriptionModel.findOne({ userId: owner.userId }).lean()).toMatchObject({ tier: 'free', consumptionWriteVersion: 1 })
      expect(await SubscriptionPlanModel.findOne({ tier: 'free' }).lean()).toMatchObject({ platformFeePercent: 3.5, consumptionWriteVersion: 1 })
    } finally {
      if (free) await SubscriptionPlanModel.updateOne({ tier: 'free' }, { $set: { platformFeePercent: free.platformFeePercent } })
    }
  })

  it.each(['paystack', 'ujimora_wallet'] as const)('rejects stale %s fees when missing policy is concurrently inserted', async destination => {
    for (const change of ['subscription', 'plan'] as const) {
      const owner = await creatorWithBalance(100)
      await SubscriptionModel.deleteOne({ userId: owner.userId })
      if (change === 'plan') await SubscriptionPlanModel.deleteOne({ tier: 'free' })
      const target = change === 'subscription' ? MongoSubscriptionRepository.prototype : MongoSubscriptionPlanRepository.prototype
      const original = target.lockForConsumption
      const lock = vi.spyOn(target, 'lockForConsumption').mockImplementationOnce(async function (this: typeof target, key) {
        if (change === 'subscription') await SubscriptionModel.collection.insertOne({ userId: owner.userId, tier: 'starter', status: 'active', billingCycle: 'monthly', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 86400000), cancelAtPeriodEnd: false }, { session: null })
        else await SubscriptionPlanModel.collection.insertOne({ ...SUBSCRIPTION_PLANS[SubscriptionTier.FREE], platformFeePercent: 4 }, { session: null })
        return original.call(this, key)
      })
      const before = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length
      try {
        await request(app).post('/api/v1/creators/withdraw').set('Authorization', `Bearer ${owner.token}`).send({ amount: 100, expectedFeePercent: 3.5, destination, idempotencyKey: randomUUID(), recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' } }).expect(409)
      } finally {
        lock.mockRestore()
        await SubscriptionPlanModel.updateOne({ tier: 'free' }, { $set: { platformFeePercent: 3.5 } })
      }
      expect((await CreatorBalanceModel.findOne({ userId: owner.userId }))?.availableBalance).toBe(100)
      expect((await WalletModel.findOne({ userId: owner.userId }))?.balance).toBe(0)
      expect(await CreatorPayoutModel.countDocuments({ creatorUserId: owner.userId })).toBe(0)
      expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/transfer')).length).toBe(before)
    }
  })

  it('transfers net earnings to the owner wallet once through the authenticated endpoint', async () => {
    const {token,userId}=await creatorWithBalance(100)
    const body={amount:100,expectedFeePercent:3,destination:'ujimora_wallet',idempotencyKey:randomUUID()}
    for(let i=0;i<2;i++) {
      const response=await request(app).post('/api/v1/creators/withdraw').set('Authorization',`Bearer ${token}`).send(body).expect(201)
      expect(response.body.data).toMatchObject({status:'PAID',fee:3,netAmount:97})
    }
    expect((await WalletModel.findOne({userId,type:'local',currency:'GHS'}))?.balance).toBe(97)
    expect((await CreatorBalanceModel.findOne({userId}))?.availableBalance).toBe(0)
    expect(await CreatorPayoutModel.countDocuments({creatorUserId:userId,provider:'ujimora_wallet'})).toBe(1)
  })

  it('withdraws available funds and settles paidOut on the transfer webhook', async () => {
    const { token, userId } = await creatorWithBalance(200)

    const wd = await request(app)
      .post('/api/v1/creators/withdraw')
      .set('Authorization', `Bearer ${token}`)
      .send({
        expectedFeePercent: 3,
        idempotencyKey: randomUUID(),
        amount: 120,
        recipient: {
          type: 'mobile_money',
          accountNumber: '0551234567',
          bankCode: 'MTN',
          accountName: 'With Draw',
        },
      })
      .expect(201)
    expect(wd.body.data.status).toBe('PROCESSING')
    expect(wd.body.data).toMatchObject({ amount: 120, fee: 3.6, feePercent: 3, netAmount: 116.4 })
    expect(transferAmount).toBe(11640)
    const reference = wd.body.data.reference as string
    expect(reference.startsWith('cpay-')).toBe(true)

    // Reserved out of available immediately.
    let bal = await CreatorBalanceModel.findOne({ userId })
    expect(bal?.availableBalance).toBe(80)

    // Provider confirms the transfer → paidOut is credited.
    const raw = JSON.stringify({
      event: 'transfer.success',
      data: { reference, status: 'success' },
    })
    await request(app)
      .post('/api/v1/webhooks/paystack')
      .set('x-paystack-signature', sign(raw))
      .set('Content-Type', 'application/json')
      .send(raw)
      .expect(200)

    bal = await CreatorBalanceModel.findOne({ userId })
    expect(bal?.availableBalance).toBe(80)
    expect(bal?.paidOutBalance).toBe(116.4)

    // Duplicate webhook is a no-op.
    await request(app)
      .post('/api/v1/webhooks/paystack')
      .set('x-paystack-signature', sign(raw))
      .set('Content-Type', 'application/json')
      .send(raw)
      .expect(200)
    bal = await CreatorBalanceModel.findOne({ userId })
    expect(bal?.paidOutBalance).toBe(116.4)
  })

  it('rejects a withdrawal above the available balance with 400', async () => {
    const { token } = await creatorWithBalance(30)
    await request(app)
      .post('/api/v1/creators/withdraw')
      .set('Authorization', `Bearer ${token}`)
      .send({
        expectedFeePercent: 3,
        idempotencyKey: randomUUID(),
        amount: 100,
        recipient: {
          type: 'mobile_money',
          accountNumber: '0551234567',
          bankCode: 'MTN',
          accountName: 'With Draw',
        },
      })
      .expect(400)
  })

  it('reconciles a stuck-PROCESSING withdrawal whose webhook was missed', async () => {
    const { token, userId } = await creatorWithBalance(100)
    const wd = await request(app)
      .post('/api/v1/creators/withdraw')
      .set('Authorization', `Bearer ${token}`)
      .send({
        expectedFeePercent: 3,
        idempotencyKey: randomUUID(),
        amount: 100,
        recipient: {
          type: 'mobile_money',
          accountNumber: '0551234567',
          bankCode: 'MTN',
          accountName: 'With Draw',
        },
      })
      .expect(201)
    const reference = wd.body.data.reference as string

    // Simulate a missed webhook: still PROCESSING, backdated so the sweep sees it as stale.
    await CreatorPayoutModel.updateOne(
      { providerRef: reference },
      { $set: { updatedAt: new Date(Date.now() - 3600_000) } },
      { timestamps: false },
    )
    expect((await CreatorBalanceModel.findOne({ userId }))?.paidOutBalance).toBe(0)

    // An admin runs the reconciliation sweep → the provider reports success → settled.
    const admReg = await request(app)
      .post('/api/v1/auth/register')
      .send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email: uniqueEmail('recadm'), password: 'SecurePass123', name: 'Adm' })
      .expect(201)
    await UserModel.findByIdAndUpdate(admReg.body.data.user.id, { role: 'admin' })
    const admLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: admReg.body.data.user.email, password: 'SecurePass123' })
      .expect(200)
    await request(app)
      .post('/api/v1/admin/reconciliation/payouts')
      .set('Authorization', `Bearer ${admLogin.body.data.tokens.accessToken}`)
      .send({ olderThanMinutes: 1 })
      .expect(200)

    const bal = await CreatorBalanceModel.findOne({ userId })
    expect(bal?.paidOutBalance).toBe(97) // reconciled to PAID
    expect(bal?.payoutFees).toBe(3)
    expect(bal?.availableBalance).toBe(0)
  })

  it('a recipient-creation failure leaves balance untouched and creates no payout', async () => {
    const { token, userId } = await creatorWithBalance(60)
    failRecipient = true
    try {
      await request(app)
        .post('/api/v1/creators/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .send({
          expectedFeePercent: 3,
          idempotencyKey: randomUUID(),
          amount: 40,
          recipient: {
            type: 'mobile_money',
            accountNumber: '0551234567',
            bankCode: 'MTN',
            accountName: 'With Draw',
          },
        })
        .expect(502)
    } finally {
      failRecipient = false
    }

    // The reservation is returned in full — no silent balance loss.
    const bal = await CreatorBalanceModel.findOne({ userId })
    expect(bal?.availableBalance).toBe(60)

    expect(await CreatorPayoutModel.findOne({ creatorUserId: userId })).toBeNull()
  })

  it('returns the reservation when the transfer webhook reports failure', async () => {
    const { token, userId } = await creatorWithBalance(50)
    const wd = await request(app)
      .post('/api/v1/creators/withdraw')
      .set('Authorization', `Bearer ${token}`)
      .send({
        expectedFeePercent: 3,
        idempotencyKey: randomUUID(),
        amount: 50,
        recipient: {
          type: 'mobile_money',
          accountNumber: '0551234567',
          bankCode: 'MTN',
          accountName: 'With Draw',
        },
      })
      .expect(201)
    const reference = wd.body.data.reference as string
    expect((await CreatorBalanceModel.findOne({ userId }))?.availableBalance).toBe(0)

    const raw = JSON.stringify({ event: 'transfer.failed', data: { reference, status: 'failed' } })
    await request(app)
      .post('/api/v1/webhooks/paystack')
      .set('x-paystack-signature', sign(raw))
      .set('Content-Type', 'application/json')
      .send(raw)
      .expect(200)
    const bal = await CreatorBalanceModel.findOne({ userId })
    expect(bal?.availableBalance).toBe(50) // reservation returned
    expect(bal?.paidOutBalance).toBe(0)
  })
  it('keeps an existing balance withdrawable after downgrade, requires fee review, and reverses net plus fee once', async () => {
    const { token, userId } = await creatorWithBalance(100)
    await SubscriptionModel.updateOne({ userId }, { $set: { tier: 'free' } })
    const body = {
      amount: 100,
      recipient: {
        type: 'mobile_money',
        accountNumber: '0551234567',
        bankCode: 'MTN',
        accountName: 'With Draw',
      },
    }
    await request(app)
      .post('/api/v1/creators/withdraw')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...body, expectedFeePercent: 3, idempotencyKey: randomUUID() })
      .expect(409)
    expect((await CreatorBalanceModel.findOne({ userId }))?.availableBalance).toBe(100)
    const wd = await request(app)
      .post('/api/v1/creators/withdraw')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...body, expectedFeePercent: 3.5, idempotencyKey: randomUUID() })
      .expect(201)
    expect(wd.body.data).toMatchObject({ amount: 100, fee: 3.5, netAmount: 96.5 })
    expect(transferAmount).toBe(9650)
    for (const event of [
      'transfer.success',
      'transfer.success',
      'transfer.reversed',
      'transfer.reversed',
    ]) {
      const raw = JSON.stringify({ event, data: { reference: wd.body.data.reference } })
      await request(app)
        .post('/api/v1/webhooks/paystack')
        .set('x-paystack-signature', sign(raw))
        .set('Content-Type', 'application/json')
        .send(raw)
        .expect(200)
      const balance = await CreatorBalanceModel.findOne({ userId })
      if (event === 'transfer.success') {
        expect(balance?.paidOutBalance).toBe(96.5)
        expect(balance?.payoutFees).toBe(3.5)
      } else {
        expect(balance?.availableBalance).toBe(100)
        expect(balance?.paidOutBalance).toBe(0)
        expect(balance?.payoutFees).toBe(0)
      }
    }
  })

  it('keeps funds reserved after an ambiguous transfer timeout until provider settlement', async () => {
    const { token, userId } = await creatorWithBalance(100)
    failTransfer = true
    let wd
    try {
      wd = await request(app)
        .post('/api/v1/creators/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .send({
          expectedFeePercent: 3,
          idempotencyKey: randomUUID(),
          amount: 100,
          recipient: {
            type: 'mobile_money',
            accountNumber: '0551234567',
            bankCode: 'MTN',
            accountName: 'With Draw',
          },
        })
        .expect(201)
    } finally {
      failTransfer = false
    }
    expect(wd.body.data.status).toBe('PROCESSING')
    expect((await CreatorBalanceModel.findOne({ userId }))?.availableBalance).toBe(0)
    const raw = JSON.stringify({
      event: 'transfer.success',
      data: { reference: wd.body.data.reference },
    })
    await request(app)
      .post('/api/v1/webhooks/paystack')
      .set('x-paystack-signature', sign(raw))
      .set('Content-Type', 'application/json')
      .send(raw)
      .expect(200)
    expect((await CreatorBalanceModel.findOne({ userId }))?.paidOutBalance).toBe(97)
  })

  it('uses live admin plan fees and keeps the payout snapshot after the plan changes', async () => {
    const { token, userId } = await creatorWithBalance(100)
    const original = await SubscriptionPlanModel.findOne({ tier: 'starter' })
    expect(original).toBeTruthy()
    try {
      await SubscriptionPlanModel.updateOne(
        { tier: 'starter' },
        { $set: { platformFeePercent: 4 } },
      )
      const wd = await request(app)
        .post('/api/v1/creators/withdraw')
        .set('Authorization', `Bearer ${token}`)
        .send({
          expectedFeePercent: 4,
          idempotencyKey: randomUUID(),
          amount: 100,
          recipient: {
            type: 'mobile_money',
            accountNumber: '0551234567',
            bankCode: 'MTN',
            accountName: 'With Draw',
          },
        })
        .expect(201)
      expect(wd.body.data).toMatchObject({ fee: 4, netAmount: 96 })
      expect(transferAmount).toBe(9600)
      await SubscriptionPlanModel.updateOne(
        { tier: 'starter' },
        { $set: { platformFeePercent: 5 } },
      )
      const raw = JSON.stringify({
        event: 'transfer.success',
        data: { reference: wd.body.data.reference },
      })
      await request(app)
        .post('/api/v1/webhooks/paystack')
        .set('x-paystack-signature', sign(raw))
        .set('Content-Type', 'application/json')
        .send(raw)
        .expect(200)
      const balance = await CreatorBalanceModel.findOne({ userId })
      expect(balance?.paidOutBalance).toBe(96)
      expect(balance?.payoutFees).toBe(4)
    } finally {
      await SubscriptionPlanModel.updateOne(
        { tier: 'starter' },
        { $set: { platformFeePercent: original!.platformFeePercent } },
      )
    }
  })

  it('settles historical withdrawals without fee fields under their original zero-fee terms', async () => {
    const { userId } = await creatorWithBalance(0)
    const reference = `cpay-legacy-${randomUUID()}`
    await CreatorPayoutModel.create({
      creatorUserId: userId,
      amount: 100,
      currency: 'GHS',
      status: 'PROCESSING',
      provider: 'paystack',
      providerRef: reference,
    })
    const raw = JSON.stringify({ event: 'transfer.success', data: { reference } })
    await request(app)
      .post('/api/v1/webhooks/paystack')
      .set('x-paystack-signature', sign(raw))
      .set('Content-Type', 'application/json')
      .send(raw)
      .expect(200)
    const balance = await CreatorBalanceModel.findOne({ userId })
    expect(balance?.paidOutBalance).toBe(100)
    expect(balance?.payoutFees).toBe(0)
  })
})
