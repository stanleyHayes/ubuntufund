import { beforeAll, afterAll, it, expect, vi } from 'vitest'
import mongoose from 'mongoose'
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js'
import { AuditLogController } from '../../src/infrastructure/adapters/inbound/http/controllers/AuditLogController.js'
import { AuditLogModel } from '../../src/infrastructure/database/models/AuditLogModel.js'
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js'
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js'
import { PayoutModel } from '../../src/infrastructure/database/models/PayoutModel.js'
import { providerToPaymentMethod } from '../../src/application/use-cases/SettleDonationUseCase.js'
beforeAll(connectTestDatabase)
afterAll(async () => {
  await dropTestDatabase()
  await disconnectTestDatabase()
})
it('resolves names, campaign and approval description while preserving raw evidence and name search', async () => {
  const actor = new mongoose.Types.ObjectId(),
    campaign = new mongoose.Types.ObjectId(),
    payout = new mongoose.Types.ObjectId()
  await UserModel.collection.insertOne({ _id: actor, name: 'Stanley Hayford' })
  await CampaignModel.collection.insertOne({ _id: campaign, title: 'Keep our platform running' })
  await PayoutModel.collection.insertOne({
    _id: payout,
    campaignId: campaign.toString(),
    amount: 4837.62,
    currency: 'GHS',
  })
  const path = `/api/v1/payouts/${payout}/approve`
  await AuditLogModel.create({
    actorId: actor.toString(),
    actorRole: 'admin',
    action: 'payouts.create',
    resource: 'payouts',
    details: `POST ${path}`,
    path,
    method: 'POST',
    statusCode: 200,
  })
  const json = vi.fn(),
    next = vi.fn()
  await new AuditLogController().list(
    { query: { search: 'Stanley' } } as never,
    { json } as never,
    next,
  )
  expect(next).not.toHaveBeenCalled()
  const row = json.mock.calls[0][0].data.items[0]
  expect(row.user).toBe('Stanley Hayford · Admin')
  expect(row.summary).toContain('Approve payout · Keep our platform running · GHS 4,837.62')
  expect(row.details).toBe(`POST ${path}`)
  expect(row.actorId).toBe(actor.toString())
})
it('maps verified payment channels to their real methods', () => {
  expect(providerToPaymentMethod('paystack', 'mobile_money')).toBe('mobile_money')
  expect(providerToPaymentMethod('paystack', 'card')).toBe('card')
  expect(providerToPaymentMethod('wallet')).toBe('wallet')
  expect(providerToPaymentMethod('bitnob')).toBe('crypto')
  expect(providerToPaymentMethod('paystack', 'bank_transfer')).toBe('bank_transfer')
})
