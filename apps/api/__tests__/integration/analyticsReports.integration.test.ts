import { beforeAll, afterAll, it, expect } from 'vitest'
import mongoose from 'mongoose'
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js'
import { MongoAnalyticsRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAnalyticsRepository.js'
import { DonationModel } from '../../src/infrastructure/database/models/DonationModel.js'
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js'
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js'
beforeAll(connectTestDatabase)
afterAll(async () => {
  await dropTestDatabase()
  await disconnectTestDatabase()
})
it('includes guest and legacy donations without casting non-user IDs or losing geographic totals', async () => {
  const user = new mongoose.Types.ObjectId(),
    campaign = new mongoose.Types.ObjectId()
  await UserModel.collection.insertOne({ _id: user, country: 'Ghana' })
  await CampaignModel.collection.insertOne({
    _id: campaign,
    creatorId: user.toString(),
    category: 'business',
  })
  await DonationModel.collection.insertMany([
    {
      campaignId: campaign.toString(),
      donorId: user.toString(),
      amount: 100,
      createdAt: new Date(),
    },
    { campaignId: campaign.toString(), donorId: 'guest', amount: 250, createdAt: new Date() },
    { campaignId: 'legacy', donorId: 'anonymous', amount: 50, createdAt: new Date() },
  ])
  const reports = await new MongoAnalyticsRepository().getReports()
  expect(reports.donationTrend.reduce((sum, row) => sum + row.amount, 0)).toBe(400)
  expect(reports.categoryBreakdown).toEqual([{ category: 'business', value: 350 }])
  expect(reports.geographicData).toEqual(
    expect.arrayContaining([
      { country: 'Ghana', campaigns: 1, donations: 100 },
      { country: 'Unspecified', campaigns: 0, donations: 300 },
    ]),
  )
  expect(reports.fraudMetrics.find((row) => row.metric === 'Pending Reports')?.value).toBe(0)
})
