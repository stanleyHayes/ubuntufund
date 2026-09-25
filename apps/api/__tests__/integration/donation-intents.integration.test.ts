import { DonationModel } from '../../src/infrastructure/database/models/DonationModel.js'
import { randomUUID } from 'node:crypto'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
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
import { WalletModel } from '../../src/infrastructure/database/models/WalletModel.js'
import { CampaignBalanceModel } from '../../src/infrastructure/database/models/CampaignBalanceModel.js'
import { JournalEntryModel } from '../../src/infrastructure/database/models/JournalEntryModel.js'
import { JournalLineModel } from '../../src/infrastructure/database/models/JournalLineModel.js'
import { DonationIntentModel } from '../../src/infrastructure/database/models/DonationIntentModel.js'
import { SubscriptionModel } from '../../src/infrastructure/database/models/SubscriptionModel.js'
import {
  CampaignCategory,
  CampaignPriority,
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
} from '@ubuntu-fund/types'

function uniqueEmail(label: string): string {
  return `${label}-${randomUUID()}@example.com`
}

async function registerUser(app: Express, email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true }, email, password: 'SecurePass123', name: 'Test User' })
    .expect(201)
  return {
    userId: res.body.data.user.id as string,
    token: res.body.data.tokens.accessToken as string,
  }
}

async function createActiveCampaign(app: Express, creatorToken: string, creatorId: string) {
  await UserModel.findByIdAndUpdate(creatorId, { verificationLevel: 2 })
  const createRes = await request(app)
    .post('/api/v1/campaigns')
    .set('Authorization', `Bearer ${creatorToken}`)
    .send({
      title: 'Intent Campaign',
      description: 'A campaign to receive donation intents',
      goalAmount: 5000,
      currency: 'GHS',
      category: CampaignCategory.EDUCATION,
      priority: CampaignPriority.NORMAL,
      beneficiaries: [],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .expect(201)
  const campaignId = createRes.body.data.id as string
  await CampaignModel.findByIdAndUpdate(campaignId, { status: 'active' })
  return campaignId
}

async function getWalletId(app: Express, token: string): Promise<string> {
  const res = await request(app)
    .get('/api/v1/wallets')
    .set('Authorization', `Bearer ${token}`)
    .expect(200)
  return res.body.data[0].id as string
}

async function fundWallet(walletId: string, balance: number): Promise<void> {
  await WalletModel.findByIdAndUpdate(walletId, { $set: { balance } })
}

describe('Donation Intents Integration', () => {
  let app: Express
  // This suite asserts the Paystack rail's "not configured" behaviour, so the
  // app MUST be built with the Paystack secret absent regardless of the
  // developer's local .env. config/index.ts reads these at construction time
  // via dotenv (override:false), so an empty string assigned before
  // createTestApp() survives — a `delete` would let dotenv repopulate it from
  // .env. Originals are restored in afterAll to avoid leaking into later files.
  const PAYSTACK_ENV_KEYS = ['PAYSTACK_SECRET_KEY', 'PAYSTACK_PUBLIC_KEY'] as const
  const savedPaystackEnv: Partial<Record<(typeof PAYSTACK_ENV_KEYS)[number], string | undefined>> =
    {}

  beforeAll(async () => {
    for (const key of PAYSTACK_ENV_KEYS) {
      savedPaystackEnv[key] = process.env[key]
      process.env[key] = ''
    }
    await connectTestDatabase()
    app = await createTestApp()
  })

  afterAll(async () => {
    for (const key of PAYSTACK_ENV_KEYS) {
      const value = savedPaystackEnv[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await dropTestDatabase()
    await disconnectTestDatabase()
  })

  it('persists explicit terms acceptance for an anonymous wallet donation without a message', async () => {
    const creator = await registerUser(app, uniqueEmail('consent-creator'))
    const campaignId = await createActiveCampaign(app, creator.token, creator.userId)
    const donor = await registerUser(app, uniqueEmail('consent-donor'))
    const walletId = await getWalletId(app, donor.token)
    await fundWallet(walletId, 100)
    const startedAt = Date.now()
    const res = await request(app).post('/api/v1/donation-intents')
      .set('Authorization', `Bearer ${donor.token}`)
      .send({
        campaignId, amount: 10, provider: 'wallet', isAnonymous: true,
        legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
      }).expect(201)
    const stored = await DonationIntentModel.findById(res.body.data.id)
    expect(stored?.messageAgreement?.version).toBe('2026-09-12')
    expect(stored?.messageAgreement?.acceptedAt.getTime()).toBeGreaterThanOrEqual(startedAt)
    expect(stored?.messageAgreement?.acceptedAt.getTime()).toBeLessThanOrEqual(Date.now())
    expect(stored?.isAnonymous).toBe(true)
  })

  // I081: the saved "anonymous by default" setting must apply when a donation
  // does not say otherwise; an explicit per-donation choice still wins.
  it('applies the donor anonymous-by-default setting unless the donation chooses', async () => {
    const creator = await registerUser(app, uniqueEmail('anon-creator'))
    const campaignId = await createActiveCampaign(app, creator.token, creator.userId)
    const donor = await registerUser(app, uniqueEmail('anon-donor'))
    const walletId = await getWalletId(app, donor.token)
    await fundWallet(walletId, 100)
    await request(app).put('/api/v1/profile').set('Authorization', `Bearer ${donor.token}`).send({ anonymousDonations: true }).expect(200)

    const implicit = await request(app).post('/api/v1/donation-intents').set('Authorization', `Bearer ${donor.token}`)
      .send({ campaignId, amount: 10, provider: 'wallet' }).expect(201)
    expect((await DonationIntentModel.findById(implicit.body.data.id))?.isAnonymous).toBe(true)

    const legacy = await request(app).post(`/api/v1/campaigns/${campaignId}/donate`).set('Authorization', `Bearer ${donor.token}`)
      .send({ amount: 5, currency: 'GHS', paymentMethod: 'wallet' }).expect(200)
    expect(legacy.body.message).toBe('Donation successful')
    const legacyIntent = await DonationIntentModel.findOne({ campaignId, amount: 5 })
    expect(legacyIntent?.isAnonymous).toBe(true)

    const explicit = await request(app).post('/api/v1/donation-intents').set('Authorization', `Bearer ${donor.token}`)
      .send({ campaignId, amount: 11, provider: 'wallet', isAnonymous: false }).expect(201)
    expect((await DonationIntentModel.findById(explicit.body.data.id))?.isAnonymous).toBe(false)

    await request(app).put('/api/v1/profile').set('Authorization', `Bearer ${donor.token}`).send({ anonymousDonations: false }).expect(200)
    const publicByDefault = await request(app).post('/api/v1/donation-intents').set('Authorization', `Bearer ${donor.token}`)
      .send({ campaignId, amount: 12, provider: 'wallet' }).expect(201)
    expect((await DonationIntentModel.findById(publicByDefault.body.data.id))?.isAnonymous).toBe(false)
  })

  it('settles a wallet donation intent: debits wallet, posts a balanced ledger entry, projects raised + balance', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(
      app,
      uniqueEmail('creator'),
    )
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId)

    const { userId: donorId, token: donorToken } = await registerUser(app, uniqueEmail('donor'))
    const walletId = await getWalletId(app, donorToken)
    await fundWallet(walletId, 1000)

    const res = await request(app)
      .post('/api/v1/donation-intents')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        campaignId,
        amount: 500,
        tip: 50,
        provider: 'wallet',
        message: 'For the kids', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
        isAnonymous: false,
      })
    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe('SUCCEEDED')
    expect(res.body.data.provider).toBe('wallet')
    const intentId = res.body.data.id as string
    const storedIntent = await DonationIntentModel.findById(intentId)
    expect(storedIntent?.messageAgreement?.version).toBe('2026-09-12')
    expect(storedIntent?.messageAgreement?.acceptedAt).toBeInstanceOf(Date)

    // Wallet debited amount + tip.
    const walletRes = await request(app)
      .get(`/api/v1/wallets/${walletId}`)
      .set('Authorization', `Bearer ${donorToken}`)
    expect(walletRes.body.data.balance).toBe(450)

    // Campaign raised total projected (tip excluded).
    const campaignRes = await request(app).get(`/api/v1/campaigns/${campaignId}`)
    expect(campaignRes.body.data.raisedAmount).toBe(500)

    // Balanced, immutable journal entry recorded for the intent.
    const entry = await JournalEntryModel.findOne({ donationIntentId: intentId })
    expect(entry).not.toBeNull()
    const lines = await JournalLineModel.find({ journalEntryId: entry!._id!.toString() })
    const debits = lines.filter((l) => l.direction === 'debit').reduce((s, l) => s + l.amount, 0)
    const credits = lines.filter((l) => l.direction === 'credit').reduce((s, l) => s + l.amount, 0)
    expect(debits).toBe(credits)
    // amount(500) + tip(500->debit tip 50) => debit 550 == credit 550
    expect(debits).toBe(550)
    const campaignDebit = lines.find((l) => l.accountKind === 'campaign' && l.direction === 'debit')
    expect(campaignDebit?.amount).toBe(500)

    // Campaign balance read model: beneficiary-net pending, tip tracked.
    // The creator is on the Free plan (3.5% platform fee): net = 500 - 17.50.
    const balance = await CampaignBalanceModel.findOne({ campaignId })
    expect(balance?.totalRaised).toBe(500)
    expect(balance?.pendingBalance).toBe(482.5) // 500 - 17.50 platform (Free 3.5%)
    expect(balance?.platformFees).toBe(17.5)
    expect(balance?.availableBalance).toBe(0)
    expect(balance?.tips).toBe(50)

    // Public status polling.
    const publicRes = await request(app).get(`/api/v1/donation-intents/${intentId}/public`)
    expect(publicRes.status).toBe(200)
    expect(publicRes.body.data.status).toBe('SUCCEEDED')
    expect(publicRes.body.data.contentReviewStatus).toBe('pending')
    expect(JSON.stringify(publicRes.body.data)).not.toContain('For the kids')
    expect(publicRes.body.data.idempotencyKey).toBeUndefined()

    // Donation recorded under the donor, visible in their history.
    const mineRes = await request(app)
      .get('/api/v1/donations/mine')
      .set('Authorization', `Bearer ${donorToken}`)
    expect(mineRes.body.data.some((d: { campaignId: string }) => d.campaignId === campaignId)).toBe(
      true,
    )
    void donorId
  })

  it('keeps the campaign creation rate after the creator upgrades to Pro', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(
      app,
      uniqueEmail('procreator'),
    )
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId)
    // Upgrade after campaign creation; the existing campaign keeps its locked rate.
    const now = new Date()
    await SubscriptionModel.create({
      userId: creatorId,
      tier: SubscriptionTier.PRO,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    })

    const { token: donorToken } = await registerUser(app, uniqueEmail('prodonor'))
    const walletId = await getWalletId(app, donorToken)
    await fundWallet(walletId, 1000)

    const res = await request(app)
      .post('/api/v1/donation-intents')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ campaignId, amount: 500, provider: 'wallet', isAnonymous: false })
    expect(res.status).toBe(201)

    // The 3.5% creation rate applies on wallet and hosted payments alike.
    const balance = await CampaignBalanceModel.findOne({ campaignId })
    expect(balance?.platformFees).toBe(17.5)
    expect(balance?.pendingBalance).toBe(482.5)
  })

  it('is idempotent: the same Idempotency-Key never charges twice', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(
      app,
      uniqueEmail('creator2'),
    )
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId)
    const { token: donorToken } = await registerUser(app, uniqueEmail('donor2'))
    const walletId = await getWalletId(app, donorToken)
    await fundWallet(walletId, 1000)

    const key = `idem-${randomUUID()}`
    const body = { campaignId, amount: 300, provider: 'wallet', isAnonymous: false }

    const first = await request(app)
      .post('/api/v1/donation-intents')
      .set('Authorization', `Bearer ${donorToken}`)
      .set('Idempotency-Key', key)
      .send(body)
    expect(first.status).toBe(201)

    const second = await request(app)
      .post('/api/v1/donation-intents')
      .set('Authorization', `Bearer ${donorToken}`)
      .set('Idempotency-Key', key)
      .send(body)
    expect(second.status).toBe(201)

    // Same intent resolved both times.
    expect(second.body.data.id).toBe(first.body.data.id)

    // Debited exactly once.
    const walletRes = await request(app)
      .get(`/api/v1/wallets/${walletId}`)
      .set('Authorization', `Bearer ${donorToken}`)
    expect(walletRes.body.data.balance).toBe(700)

    // Exactly one intent + one ledger entry for the key.
    const intents = await DonationIntentModel.find({ idempotencyKey: key })
    expect(intents).toHaveLength(1)
    const entries = await JournalEntryModel.find({ donationIntentId: first.body.data.id })
    expect(entries).toHaveLength(1)
  })

  it('resumes an interrupted wallet intent from stored charge data for its owner only', async () => {
    const owner = await registerUser(app, uniqueEmail('resume-owner'))
    const campaignId = await createActiveCampaign(app, owner.token, owner.userId)
    const walletId = await getWalletId(app, owner.token)
    await fundWallet(walletId, 200)
    const key = randomUUID()
    const intent = await DonationIntentModel.create({ campaignId, donorUserId: owner.userId, amount: 50, tip: 5, currency: 'GHS', provider: 'wallet', status: 'CREATED', idempotencyKey: key })
    const other = await registerUser(app, uniqueEmail('resume-other'))
    await request(app).post('/api/v1/donation-intents').set('Authorization', `Bearer ${other.token}`).set('Idempotency-Key', key)
      .send({ campaignId, amount: 1, provider: 'wallet' }).expect(403)
    const retry = () => request(app).post('/api/v1/donation-intents').set('Authorization', `Bearer ${owner.token}`).set('Idempotency-Key', key)
      .send({ campaignId, amount: 1, provider: 'wallet' })
    const result = await retry()
    expect(result.status).toBe(201)
    expect(result.body.data.id).toBe(intent.id)
    expect(result.body.data.status).toBe('SUCCEEDED')
    await retry()
    expect((await WalletModel.findById(walletId))?.balance).toBe(145)
    expect(await JournalEntryModel.countDocuments({ donationIntentId: intent.id })).toBe(1)
    // The donation keeps the campaign-directed amount and records the tip
    // charged with it, so the donor's confirmation can state the full charge.
    const donations = await DonationModel.find({ campaignId }).lean()
    expect(donations).toHaveLength(1)
    expect(donations[0]).toMatchObject({ amount: 50, tip: 5 })
  })

  it('rejects a wallet intent with insufficient balance and takes no money', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(
      app,
      uniqueEmail('creator3'),
    )
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId)
    const { token: donorToken } = await registerUser(app, uniqueEmail('donor3'))
    const walletId = await getWalletId(app, donorToken)
    await fundWallet(walletId, 100)

    const res = await request(app)
      .post('/api/v1/donation-intents')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ campaignId, amount: 500, provider: 'wallet', isAnonymous: false })
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Insufficient wallet balance')

    const walletRes = await request(app)
      .get(`/api/v1/wallets/${walletId}`)
      .set('Authorization', `Bearer ${donorToken}`)
    expect(walletRes.body.data.balance).toBe(100)

    const campaignRes = await request(app).get(`/api/v1/campaigns/${campaignId}`)
    expect(campaignRes.body.data.raisedAmount).toBe(0)
  })

  it('returns 501 for a Paystack intent when the gateway is not configured', async () => {
    // This suite runs with PAYSTACK_SECRET_KEY unset, so the Paystack rail is
    // disabled: the request is rejected before any intent is persisted.
    const { userId: creatorId, token: creatorToken } = await registerUser(
      app,
      uniqueEmail('creator4'),
    )
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId)

    // No Authorization header → guest checkout.
    const res = await request(app).post('/api/v1/donation-intents').send({
      campaignId,
      amount: 200,
      provider: 'paystack',
      donorEmail: 'guest@example.com',
      donorName: 'Generous Guest',
      legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true },
      isAnonymous: false,
    })
    expect(res.status).toBe(501)
    expect(res.body.message).toBe('Payments are not configured')

    // Nothing persisted or settled: no intent created, raised untouched.
    const intents = await DonationIntentModel.find({ campaignId })
    expect(intents).toHaveLength(0)
    const campaignRes = await request(app).get(`/api/v1/campaigns/${campaignId}`)
    expect(campaignRes.body.data.raisedAmount).toBe(0)
  })

  it('rejects a guest wallet intent (wallet requires authentication)', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(
      app,
      uniqueEmail('creator5'),
    )
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId)

    const res = await request(app)
      .post('/api/v1/donation-intents')
      .send({ campaignId, amount: 100, provider: 'wallet', isAnonymous: false })
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Wallet donations require an authenticated account')
  })

  it('lets the donor edit their donation message but blocks others', async () => {
    const { userId: creatorId, token: creatorToken } = await registerUser(
      app,
      uniqueEmail('creator6'),
    )
    const campaignId = await createActiveCampaign(app, creatorToken, creatorId)
    const { token: donorToken } = await registerUser(app, uniqueEmail('donor6'))
    const walletId = await getWalletId(app, donorToken)
    await fundWallet(walletId, 1000)

    await request(app)
      .post('/api/v1/donation-intents')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ campaignId, amount: 250, provider: 'wallet', isAnonymous: false })
      .expect(201)

    const mineRes = await request(app)
      .get('/api/v1/donations/mine')
      .set('Authorization', `Bearer ${donorToken}`)
    const donationId = mineRes.body.data[0].id as string

    await DonationModel.updateOne({ _id: donationId }, { $set: { publicContentStatus: 'approved', publicContentFingerprint: 'a'.repeat(64), publicReviewNotes: 'Previous review notes', publicReviewedBy: creatorId, publicReviewedAt: new Date() } })
    await request(app).post(`/api/v1/donations/${donationId}/message`).set('Authorization', `Bearer ${donorToken}`).send({ message: 'Missing agreement' }).expect(428)
    expect((await DonationModel.findById(donationId))?.message).not.toBe('Missing agreement')
    const editRes = await request(app)
      .post(`/api/v1/donations/${donationId}/message`)
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ message: 'Wishing you all the best!', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } })
    expect(editRes.status).toBe(200)
    expect(editRes.body.data.message).toBe('Wishing you all the best!')
    expect(editRes.body.data.contentReviewStatus).toBe('pending')
    const edited = await DonationModel.findById(donationId)
    expect(edited?.publicContentStatus).toBe('pending')
    expect(edited?.publicContentFingerprint).toBeUndefined()
    expect(edited?.publicReviewNotes).toBeUndefined()
    expect(edited?.messageAgreement?.acceptedAt).toBeInstanceOf(Date)
    expect(edited?.amount).toBe(250)

    const { token: strangerToken } = await registerUser(app, uniqueEmail('stranger6'))
    const blockedRes = await request(app)
      .post(`/api/v1/donations/${donationId}/message`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .send({ message: 'Not my donation' })
    expect(blockedRes.status).toBe(403)
  })
})
