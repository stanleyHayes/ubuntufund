import { createHmac, randomUUID } from 'node:crypto'
import { beforeAll, afterAll, it, expect, vi } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createTestApp } from '../helpers/testApp.js'
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js'
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js'
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js'
import { CampaignBalanceModel } from '../../src/infrastructure/database/models/CampaignBalanceModel.js'
import { TransferRecipientModel } from '../../src/infrastructure/database/models/TransferRecipientModel.js'
import { PayoutModel } from '../../src/infrastructure/database/models/PayoutModel.js'
import { JournalEntryModel } from '../../src/infrastructure/database/models/JournalEntryModel.js'
process.env.PAYSTACK_SECRET_KEY = 'sk_test_lifecycle'
let app: Express

/**
 * Paystack's transfer-approval route authenticates by HMAC-SHA512 over the raw
 * request body, so these calls are signed exactly as the webhook route's are.
 */
function approvalRequest(app: Express, payload: Record<string, unknown>) {
  const raw = JSON.stringify(payload)
  return request(app)
    .post('/api/v1/payouts/paystack-approval')
    .set('x-paystack-signature', createHmac('sha512', process.env.PAYSTACK_SECRET_KEY ?? '').update(raw).digest('hex'))
    .set('Content-Type', 'application/json')
    .send(raw)
}

beforeAll(async () => {
  await connectTestDatabase()
  app = await createTestApp()
  // Wait for uniqueness indexes before exercising simultaneous settlement.
  await Promise.all([PayoutModel.init(), JournalEntryModel.init()])
})
afterAll(async () => {
  vi.unstubAllGlobals()
  await dropTestDatabase()
  await disconnectTestDatabase()
})
it('request → approval → OTP → provider success → admin and owner refresh settles exactly once without a webhook', async () => {
  let providerStatus = 'otp',
    reference = ''
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init?: RequestInit) => {
      const path = String(url)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const response = (data: unknown) =>
        new Response(JSON.stringify({ status: true, data }), { status: 200 })
      if (path.endsWith('/balance')) return response([{ currency: 'GHS', balance: 10000000 }])
      if (path.endsWith('/transfer')) {
        reference = body.reference
        return response({ transfer_code: 'TRF_test', reference, status: 'otp' })
      }
      if (path.includes('/transfer/verify/'))
        return response({
          transfer_code: 'TRF_test',
          reference,
          status: providerStatus,
          amount: 100000,
          currency: 'GHS',
        })
      throw new Error('Unexpected provider request')
    }),
  )
  const email = `life-${randomUUID()}@example.com`
  const owner = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'SecurePass123', name: 'Owner' })
    .expect(201)
  const uid = owner.body.data.user.id,
    token = owner.body.data.tokens.accessToken
  await UserModel.findByIdAndUpdate(uid, { verificationLevel: 2, emailVerified: true })
  const created = await request(app)
    .post('/api/v1/campaigns')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Lifecycle campaign',
      description: 'Payout lifecycle verification',
      goalAmount: 1000,
      currency: 'GHS',
      category: 'education',
      priority: 'normal',
      beneficiaries: [],
      endDate: new Date(Date.now() + 86400000).toISOString(),
    })
    .expect(201)
  const cid = created.body.data.id
  await CampaignModel.findByIdAndUpdate(cid, { status: 'funded', raisedAmount: 1000 })
  await CampaignBalanceModel.create({
    campaignId: cid,
    currency: 'GHS',
    pendingBalance: 1000,
    availableBalance: 0,
    paidOutBalance: 0,
  })
  const recipient = await TransferRecipientModel.create({
    campaignId: cid,
    createdBy: uid,
    type: 'mobile_money',
    accountNumber: '0550000000',
    bankCode: 'MTN',
    accountName: 'Owner',
    recipientCode: 'RCP_test',
    currency: 'GHS',
  })
  const body = { amount: 1000, type: 'standard', idempotencyKey: randomUUID() }
  const payout = await request(app)
    .post(`/api/v1/campaigns/${cid}/payouts`)
    .set('Authorization', `Bearer ${token}`)
    .send(body)
    .expect(201)
  const pid = payout.body.data.id
  const repeat = await request(app)
    .post(`/api/v1/campaigns/${cid}/payouts`)
    .set('Authorization', `Bearer ${token}`)
    .send(body)
    .expect(201)
  expect(repeat.body.data.id).toBe(pid)
  expect(await PayoutModel.countDocuments({ campaignId: cid })).toBe(1)
  await request(app)
    .post(`/api/v1/payouts/${pid}/transfer-control`)
    .set('Authorization', `Bearer ${token}`)
    .send({ action: 'refresh' })
    .expect(403)
  await request(app)
    .put('/api/v1/admin/automatic-payouts')
    .set('Authorization', `Bearer ${token}`)
    .send({})
    .expect(403)
  await UserModel.findByIdAndUpdate(uid, { role: 'admin' })
  const admin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'SecurePass123' })
    .expect(200)
  const auth = `Bearer ${admin.body.data.tokens.accessToken}`
  const approved = await request(app)
    .post(`/api/v1/payouts/${pid}/approve`)
    .set('Authorization', auth)
    .send({ reviewNote: 'Verified owner and receiving capacity for this test payout.' })
    .expect(200)
  expect(approved.body.data.providerStatus).toBe('otp')
  await approvalRequest(app, { reference, amount: 100000, currency: 'GHS', recipient: recipient.recipientCode })
    .expect(200)
  await approvalRequest(app, { reference, amount: 100001, currency: 'GHS', recipient: recipient.recipientCode })
    .expect(400)
  providerStatus = 'success'
  // Refreshing is an explicit command now — the GETs below are pure reads and
  // can no longer settle money as a side effect of a page load. Two concurrent
  // refreshes exercise the per-payout lease: only one may reach the provider,
  // and the journal assertion further down proves the effect landed once.
  await Promise.all([
    request(app)
      .post(`/api/v1/campaigns/${cid}/payouts/${pid}/refresh`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200),
    request(app)
      .post(`/api/v1/campaigns/${cid}/payouts/${pid}/refresh`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200),
  ])
  const results = await Promise.all([
    request(app)
      .get(`/api/v1/campaigns/${cid}/payouts`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200),
    request(app).get('/api/v1/payouts').set('Authorization', auth).expect(200),
  ])
  expect(results[0].body.data[0].status).toBe('PAID')
  expect(results[1].body.data[0].status).toBe('PAID')
  await request(app)
    .get(`/api/v1/campaigns/${cid}/payouts`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200)
  const balance = await CampaignBalanceModel.findOne({ campaignId: cid })
  expect(balance?.paidOutBalance).toBe(1000)
  expect(balance?.availableBalance).toBe(0)
  expect((await PayoutModel.findById(pid))?.settlementApplied).toBe(true)
  expect(await JournalEntryModel.countDocuments({ externalRef: `pout:${pid}:paid` })).toBe(1)
  await approvalRequest(app, { reference, amount: 100000, currency: 'GHS', recipient: recipient.recipientCode })
    .expect(400)
})
