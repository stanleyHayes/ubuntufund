import { beforeAll, afterAll, expect, it } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createTestApp } from '../helpers/testApp.js'
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js'
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js'
import { PayoutModel } from '../../src/infrastructure/database/models/PayoutModel.js'
let app: Express
beforeAll(async () => {
  await connectTestDatabase()
  app = await createTestApp()
})
afterAll(async () => {
  await dropTestDatabase()
  await disconnectTestDatabase()
})
it('protects admin counts and matches the actual payout review queue as requests change state', async () => {
  await request(app).get('/api/v1/admin/action-center').expect(401)
  const email = 'action-center@example.com'
  const registered = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Queue Reviewer', email, password: 'SecurePass123' })
    .expect(201)
  const token = registered.body.data.tokens.accessToken
  await request(app)
    .get('/api/v1/admin/action-center')
    .set('Authorization', `Bearer ${token}`)
    .expect(403)
  await UserModel.findByIdAndUpdate(registered.body.data.user.id, { role: 'admin' })
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'SecurePass123' })
    .expect(200)
  const auth = `Bearer ${login.body.data.tokens.accessToken}`
  const saved = await PayoutModel.collection.insertOne({
    campaignId: 'campaign',
    recipientId: 'recipient',
    requestedBy: registered.body.data.user.id,
    amount: 100,
    fee: 0,
    netAmount: 100,
    currency: 'GHS',
    type: 'standard',
    provider: 'paystack',
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  const counts = await request(app)
    .get('/api/v1/admin/action-center')
    .set('Authorization', auth)
    .expect(200)
  expect(counts.body.data.items.find((item: { id: string }) => item.id === 'payouts').count).toBe(1)
  const queue = await request(app)
    .get('/api/v1/payouts/review-queue')
    .set('Authorization', auth)
    .expect(200)
  expect(queue.body.data.map((item: { id: string }) => item.id)).toContain(
    saved.insertedId.toString(),
  )
  await PayoutModel.collection.updateOne(
    { _id: saved.insertedId },
    { $set: { status: 'PROCESSING' } },
  )
  const updated = await request(app)
    .get('/api/v1/admin/action-center')
    .set('Authorization', auth)
    .expect(200)
  expect(updated.body.data.items.find((item: { id: string }) => item.id === 'payouts').count).toBe(
    0,
  )
})
