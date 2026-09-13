import { randomUUID } from 'node:crypto'
import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createTestApp } from '../helpers/testApp.js'
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js'
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js'
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js'
import { CampaignUpdateModel } from '../../src/infrastructure/database/models/CampaignUpdateModel.js'
import { OrganizationMemberModel } from '../../src/infrastructure/database/models/OrganizationMemberModel.js'
import { AppError } from '../../src/infrastructure/adapters/inbound/middleware/errorHandler.js'

let app: Express
let afterScreen = async () => {}
let finalReview = async () => {}
beforeAll(async () => {
  await connectTestDatabase()
  app = await createTestApp({ publicationAdmission: { assertAllowed: async () => afterScreen(), assertCurrent: async () => finalReview() } })
})
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase() })
beforeEach(() => { afterScreen = async () => {}; finalReview = async () => {} })
async function account() {
  const result = await request(app).post('/api/v1/auth/register').send({ name: 'Update author', email: `${randomUUID()}@example.test`, password: 'SecurePass123', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }).expect(201)
  return { id: result.body.data.user.id as string, token: result.body.data.tokens.accessToken as string }
}
async function fixture() {
  const owner = await account()
  const campaign = await CampaignModel.create({ title: 'Publication transaction', description: 'A campaign fixture', goalAmount: 500, raisedAmount: 125, currency: 'GHS', category: 'education', status: 'active', creatorId: owner.id, startDate: new Date(), endDate: new Date(Date.now() + 86400000) })
  const update = await CampaignUpdateModel.create({ campaignId: campaign.id, authorId: owner.id, title: 'Original update', content: 'Original content', type: 'general', mediaUrls: [], isPinned: false })
  return { owner, campaign, update }
}
for (const action of ['create', 'edit'] as const) for (const change of ['credentials', 'closure', 'campaign removal', 'approval'] as const) {
  it(`${action} refuses ${change} after screening without changing content or funds`, async () => {
    const { owner, campaign, update } = await fixture()
    const before = await CampaignUpdateModel.findById(update.id).lean()
    const accountBefore = await UserModel.findById(owner.id).lean()
    if (change === 'credentials') afterScreen = async () => { await UserModel.updateOne({ _id: owner.id }, { $set: { authVersion: randomUUID() } }) }
    if (change === 'closure') afterScreen = async () => { await UserModel.updateOne({ _id: owner.id }, { $set: { deletedAt: new Date() } }) }
    if (change === 'campaign removal') afterScreen = async () => { await CampaignModel.updateOne({ _id: campaign.id }, { $set: { deletedAt: new Date() } }) }
    if (change === 'approval') finalReview = async () => { throw new AppError('Approval revoked', 403) }
    const path = `/api/v1/campaigns/${campaign.id}/updates${action === 'edit' ? `/${update.id}` : ''}`
    const response = action === 'edit' ? request(app).put(path) : request(app).post(path)
    await response.set('Authorization', `Bearer ${owner.token}`).send({ title: 'New publication', content: 'Changed public content', type: 'general' }).expect(change === 'approval' ? 403 : change === 'campaign removal' ? 409 : 401)
    expect(await CampaignUpdateModel.countDocuments({ campaignId: campaign.id })).toBe(1)
    expect(await CampaignUpdateModel.findById(update.id).lean()).toEqual(before)
    expect((await CampaignModel.findById(campaign.id))?.raisedAmount).toBe(125)
    expect((await UserModel.findById(owner.id))?.publicationWriteVersion).toBe(accountBefore?.publicationWriteVersion)
  })
}
it('refuses organization updates if editor membership is revoked during screening', async () => {
  const { owner, campaign } = await fixture()
  const editor = await account()
  await UserModel.updateOne({ _id: owner.id }, { $set: { role: 'organization' } })
  const member = await OrganizationMemberModel.create({ organizationId: owner.id, userId: editor.id, email: `${randomUUID()}@example.test`, role: 'editor', status: 'active', invitedBy: owner.id })
  afterScreen = async () => { await OrganizationMemberModel.updateOne({ _id: member.id }, { $set: { status: 'revoked' } }) }
  await request(app).post(`/api/v1/organization-team/${owner.id}/campaigns/${campaign.id}/updates`).set('Authorization', `Bearer ${editor.token}`).send({ title: 'Team publication', content: 'Team update content' }).expect(403)
  expect(await CampaignUpdateModel.countDocuments({ campaignId: campaign.id })).toBe(1)
})

it('commits approved organization updates with membership and exact review inside the transaction', async () => {
  const { owner, campaign } = await fixture()
  const editor = await account()
  await UserModel.updateOne({ _id: owner.id }, { $set: { role: 'organization' } })
  const member = await OrganizationMemberModel.create({ organizationId: owner.id, userId: editor.id, email: `${randomUUID()}@example.test`, role: 'editor', status: 'active', invitedBy: owner.id })
  let reviews = 0
  finalReview = async () => { reviews += 1; expect((await OrganizationMemberModel.findById(member.id))?.profileWriteVersion).toBe(1) }
  await request(app).post(`/api/v1/organization-team/${owner.id}/campaigns/${campaign.id}/updates`).set('Authorization', `Bearer ${editor.token}`).send({ title: 'Approved team publication', content: 'Team update content' }).expect(200)
  expect(reviews).toBe(1)
  expect(await CampaignUpdateModel.countDocuments({ campaignId: campaign.id, authorId: editor.id })).toBe(1)
  expect((await CampaignModel.findById(campaign.id))?.raisedAmount).toBe(125)
})
