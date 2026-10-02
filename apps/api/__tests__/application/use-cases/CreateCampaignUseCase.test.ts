import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateCampaignUseCase, type OnBehalfCreationPort } from '../../../src/application/use-cases/CreateCampaignUseCase.js'
import type { CampaignsConfig } from '../../../src/infrastructure/config/index.js'
import { UserEntity } from '../../../src/domain/entities/User.js'
import { CampaignEntity } from '../../../src/domain/entities/Campaign.js'
import { Email } from '../../../src/domain/value-objects/Email.js'
import { TrustScore } from '../../../src/domain/value-objects/TrustScore.js'
import type { CampaignRepositoryPort } from '../../../src/domain/ports/outbound/CampaignRepositoryPort.js'
import type { UserRepositoryPort } from '../../../src/domain/ports/outbound/UserRepositoryPort.js'
import type { PublicationAdmissionPort } from '../../../src/domain/ports/outbound/PublicationAdmissionPort.js'
import { PlanLimitsService } from '../../../src/application/services/PlanLimitsService.js'
import type { SubscriptionRepositoryPort } from '../../../src/domain/ports/outbound/SubscriptionRepositoryPort.js'
import {
  CampaignCategory,
  CampaignPriority,
  VerificationLevel,
  UserRole,
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
  type CampaignContentReviewReason,
  type CreateCampaignInput,
  type Subscription,
} from '@ubuntu-fund/types'

/** Builds an in-memory subscription repo that always resolves the given tier (or none → Free). */
function makeSubscriptionRepo(tier?: SubscriptionTier): SubscriptionRepositoryPort {
  const now = new Date()
  const sub: Subscription | null = tier
    ? {
        id: 'sub-1',
        userId: 'user-1',
        tier,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: BillingCycle.MONTHLY,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        createdAt: now,
        updatedAt: now,
      }
    : null
  return {
    findByUserId: vi.fn().mockResolvedValue(sub),
    findById: vi.fn(),
    findAll: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
  }
}

function makeUser(overrides: Partial<ConstructorParameters<typeof UserEntity>[0]> = {}) {
  return new UserEntity({
    id: 'user-1',
    email: new Email('creator@example.com'),
    name: 'Campaign Creator',
    passwordHash: 'hashed',
    role: UserRole.USER,
    verificationLevel: VerificationLevel.NATIONAL_ID,
    trustScore: TrustScore.default(),
    emailVerified: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  })
}

const evidence = { fingerprint: 'f'.repeat(64) }

/** Screening approved the content: the campaign follows the usual status rules. */
const approvedAdmission: PublicationAdmissionPort = {
  assertAllowed: async () => {}, assertCurrent: async () => {},
  admitCampaign: async () => ({ outcome: 'approved', basis: 'screening', evidence: { ...evidence, automatedConsentAt: new Date(), screenedAt: new Date(), screener: 'test-screener' } }),
  commitCampaign: async () => {},
}

const validInput: CreateCampaignInput = {
  title: 'New Campaign',
  description: 'A campaign for testing',
  goalAmount: 10000,
  currency: 'GHS',
  category: CampaignCategory.EDUCATION,
  priority: CampaignPriority.NORMAL,
  beneficiaries: ['Community B'],
  endDate: new Date('2027-12-31'),
}

describe('CreateCampaignUseCase', () => {
  let campaignRepo: CampaignRepositoryPort
  let userRepo: UserRepositoryPort
  let subscriptionRepo: SubscriptionRepositoryPort
  let useCase: CreateCampaignUseCase

  beforeEach(() => {
    campaignRepo = {
      save: vi.fn().mockImplementation((campaign: CampaignEntity) => {
        // Simulate the repo assigning an ID
        return Promise.resolve(
          new CampaignEntity({
            ...campaign.toPlain(),
            id: 'generated-id',
          })
        )
      }),
      findById: vi.fn(),
      findBySlug: vi.fn().mockResolvedValue(null),
      findAll: vi.fn(),
      findByCreatorId: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      countByCreatorId: vi.fn().mockResolvedValue(0),
      countTowardCampaignAllowance: vi.fn().mockResolvedValue(0),
      countActiveByCreator: vi.fn().mockResolvedValue(0),
      incrementRaised: vi.fn(),
    }

    userRepo = {
      save: vi.fn(),
      findById: vi.fn().mockResolvedValue(makeUser()),
      findByEmail: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }

    // Default: a PRO plan so the base-case validInput (goal 10000) is allowed;
    // limit-specific tests override the subscription / counts explicitly.
    subscriptionRepo = makeSubscriptionRepo(SubscriptionTier.PRO)

    useCase = new CreateCampaignUseCase(
      campaignRepo,
      userRepo,
      new PlanLimitsService(subscriptionRepo, campaignRepo), undefined, undefined, undefined, undefined, approvedAdmission, { run: async <T>(_id: string, _version: string, work: () => Promise<T>) => work() }
    )
  })

  it('fails closed without a publication admission dependency', async () => {
    const unwired = new CreateCampaignUseCase(campaignRepo, userRepo, new PlanLimitsService(subscriptionRepo, campaignRepo))
    await expect(unwired.execute(validInput, 'user-1')).rejects.toThrow('Campaign safety review is unavailable')
    expect(campaignRepo.save).not.toHaveBeenCalled()
  })

  it('creates a campaign and calls save on the repository', async () => {
    const result = await useCase.execute(validInput, 'user-1')

    expect(userRepo.findById).toHaveBeenCalledWith('user-1')
    expect(campaignRepo.countTowardCampaignAllowance).toHaveBeenCalledWith('user-1')
    expect(campaignRepo.save).toHaveBeenCalledTimes(1)
    expect(result.title).toBe('New Campaign')
    expect(result.id).toBe('generated-id')
  })

  it('throws when user is not found', async () => {
    vi.mocked(userRepo.findById).mockResolvedValue(null)

    await expect(useCase.execute(validInput, 'unknown')).rejects.toThrow(
      'User not found'
    )
    expect(campaignRepo.save).not.toHaveBeenCalled()
  })

  it('throws when user has reached their campaign limit', async () => {
    // NATIONAL_ID allows 3 campaigns; mock count as 3
    vi.mocked(campaignRepo.countTowardCampaignAllowance).mockResolvedValue(3)

    await expect(useCase.execute(validInput, 'user-1')).rejects.toThrow(
      /cannot create more campaigns/i
    )
    expect(campaignRepo.save).not.toHaveBeenCalled()
  })

  it('throws when user with NONE verification tries to create', async () => {
    vi.mocked(userRepo.findById).mockResolvedValue(
      makeUser({ verificationLevel: VerificationLevel.NONE })
    )
    vi.mocked(campaignRepo.countTowardCampaignAllowance).mockResolvedValue(0)

    await expect(useCase.execute(validInput, 'user-1')).rejects.toThrow(
      /cannot create more campaigns/i
    )
  })

  it('returns a plain Campaign object with correct fields', async () => {
    const result = await useCase.execute(validInput, 'user-1')

    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('title', 'New Campaign')
    expect(result).toHaveProperty('description', 'A campaign for testing')
    expect(result).toHaveProperty('goalAmount', 10000)
    expect(result).toHaveProperty('raisedAmount', 0)
    expect(result).toHaveProperty('currency', 'GHS')
    expect(result).toHaveProperty('category', CampaignCategory.EDUCATION)
    expect(result).toHaveProperty('creatorId', 'user-1')
    expect(result).toHaveProperty('beneficiaries')
    expect(result.beneficiaries).toContain('Community B')
  })

  it('rejects (403) when the plan active-campaign cap is reached', async () => {
    // Free plan (no subscription) allows 1 active campaign. The verification
    // gate passes (limit 3), so the plan cap is what rejects.
    vi.mocked(campaignRepo.countActiveByCreator).mockResolvedValue(1)
    const freeUseCase = new CreateCampaignUseCase(
      campaignRepo,
      userRepo,
      new PlanLimitsService(makeSubscriptionRepo(), campaignRepo)
    )

    await expect(
      freeUseCase.execute({ ...validInput, goalAmount: 1000 }, 'user-1')
    ).rejects.toThrow(/allows 1 active campaign\. Upgrade to create more/i)
    expect(campaignRepo.save).not.toHaveBeenCalled()
  })

  it('rejects (422) when the goal exceeds the plan cap', async () => {
    // Free plan caps goals at GHS 5000. Count is under the active cap so the
    // goal ceiling is what rejects.
    vi.mocked(campaignRepo.countActiveByCreator).mockResolvedValue(0)
    const freeUseCase = new CreateCampaignUseCase(
      campaignRepo,
      userRepo,
      new PlanLimitsService(makeSubscriptionRepo(), campaignRepo)
    )

    let thrown: unknown
    try {
      await freeUseCase.execute({ ...validInput, goalAmount: 12000 }, 'user-1')
    } catch (err) {
      thrown = err
    }
    expect((thrown as { statusCode?: number }).statusCode).toBe(422)
    expect((thrown as Error).message).toMatch(/caps campaign goals at GHS/i)
    expect(campaignRepo.save).not.toHaveBeenCalled()
  })

  it('allows a higher goal on a plan with a higher cap', async () => {
    // Plus (starter) plan caps goals at GHS 50000; a 20000 goal is allowed.
    const starterUseCase = new CreateCampaignUseCase(
      campaignRepo,
      userRepo,
      new PlanLimitsService(makeSubscriptionRepo(SubscriptionTier.STARTER), campaignRepo), undefined, undefined, undefined, undefined, approvedAdmission, { run: async <T>(_id: string, _version: string, work: () => Promise<T>) => work() }
    )

    const result = await starterUseCase.execute(
      { ...validInput, goalAmount: 20000 },
      'user-1'
    )
    expect(result.goalAmount).toBe(20000)
    expect(campaignRepo.save).toHaveBeenCalledTimes(1)
  })

  describe('content a person must check', () => {
    // Every goal here auto-approves on tier, so only the content decides the status.
    const tiering: CampaignsConfig = { tierThresholds: [10_000, 50_000, 250_000, 1_000_000], autoApproveMaxTier: 5 }
    const creation = { run: async <T>(_id: string, _version: string, work: () => Promise<T>) => work() }
    const plan = {
      assertCanCreateCampaign: async () => {},
      assertCanCreateOnBehalf: async () => ({ planTier: 'organization', feePercent: 0 }),
      platformFeePercent: async () => 5,
    } as unknown as PlanLimitsService
    const held = (reason: CampaignContentReviewReason) => ({
      ...approvedAdmission,
      admitCampaign: vi.fn(async () => ({ outcome: 'staff_review' as const, reason, evidence })),
      commitCampaign: vi.fn(async () => {}),
    })
    const build = (admission: PublicationAdmissionPort, onBehalf?: OnBehalfCreationPort) => {
      const alerts = { campaignPendingReview: vi.fn(async () => {}) }
      const useCase = new CreateCampaignUseCase(campaignRepo, userRepo, plan, tiering, undefined, alerts, undefined, admission, creation, onBehalf)
      return { useCase, alerts }
    }
    const saved = () => vi.mocked(campaignRepo.save).mock.calls[0][0].toPlain()

    it.each(['new_media', 'no_screening_consent', 'screening_flagged', 'screening_unavailable'] as const)('saves %s content as pending_review with its reason and alerts staff', async reason => {
      const admission = held(reason)
      const { useCase, alerts } = build(admission)
      const result = await useCase.execute({ ...validInput, automatedReviewConsent: true }, 'user-1')
      expect(result).toMatchObject({ status: 'pending_review', contentReviewReason: reason })
      expect(result.contentReviewClearedAt).toBeUndefined()
      expect(saved()).toMatchObject({ status: 'pending_review', contentReviewReason: reason, contentAdmission: { basis: 'staff_review', reason, fingerprint: evidence.fingerprint } })
      // The admission is committed (and audited against the new campaign) inside the creation transaction.
      expect(admission.commitCampaign).toHaveBeenCalledWith(expect.objectContaining({ action: 'campaign.create', actorId: 'user-1' }), { outcome: 'staff_review', reason, evidence }, 'generated-id')
      expect(vi.mocked(admission.commitCampaign).mock.invocationCallOrder[0]).toBeGreaterThan(vi.mocked(campaignRepo.save).mock.invocationCallOrder[0])
      expect(alerts.campaignPendingReview).toHaveBeenCalledWith(expect.objectContaining({ campaignId: 'generated-id', contentReviewReason: reason }))
    })

    it('admits the goal as it is stored, so a decline rebuilt from the campaign binds the same version', async () => {
      const admission = held('no_screening_consent')
      const { useCase } = build(admission)
      // Only an API caller that skips the route's two-decimal rule can send this.
      await useCase.execute({ ...validInput, goalAmount: 500.555 }, 'user-1')
      expect(saved().goalAmount.amount).toBe(500.56)
      const [submission] = vi.mocked(admission.admitCampaign!).mock.calls[0] as unknown as [{ text: string }]
      expect(JSON.parse(submission.text)).toMatchObject({ goalAmount: 500.56 })
    })

    it('publishes content screening approved under the usual rules, with no reason or alert', async () => {
      const { useCase, alerts } = build(approvedAdmission)
      const result = await useCase.execute(validInput, 'user-1')
      expect(result.status).toBe('active')
      expect(result.contentReviewReason).toBeUndefined()
      expect(saved().contentReviewReason).toBeUndefined()
      // The organizer's consent and the screener's answer are kept as private evidence.
      expect(saved().contentAdmission).toMatchObject({ basis: 'screening', fingerprint: evidence.fingerprint, screener: 'test-screener', automatedConsentAt: expect.any(Date), screenedAt: expect.any(Date), admittedAt: expect.any(Date) })
      expect(result).not.toHaveProperty('contentAdmission')
      expect(alerts.campaignPendingReview).not.toHaveBeenCalled()
    })

    it('never lets beneficiary consent alone publish content held for staff', async () => {
      const onBehalfPort: OnBehalfCreationPort = {
        invitationsAvailable: true,
        resolveConfig: async () => ({ publicationRequiresConsent: true, donationsRequireConsent: true, staffReviewRequired: false, invitationTtlHours: 72, minManagerVerificationLevel: 0 }),
        issueInvitation: vi.fn(async () => ({ invitationId: 'invitation-1', expiresAt: new Date() })),
      }
      const onBehalfInput: CreateCampaignInput = { ...validInput, onBehalf: { beneficiaryType: 'individual', beneficiaryName: 'Ama Mensah', beneficiaryEmail: 'ama@example.com', relationship: 'patient', reason: 'Ama needs surgery her family cannot afford.', payoutArrangement: 'beneficiary' } }

      // Screened content: consent is the only thing holding it, so consent may publish it.
      const screened = build(approvedAdmission, onBehalfPort)
      expect((await screened.useCase.execute(onBehalfInput, 'user-1')).status).toBe('pending_review')
      expect(saved().onBehalf?.autoPublishOnConsent).toBe(true)
      expect(screened.alerts.campaignPendingReview).not.toHaveBeenCalled()

      expect(saved().onBehalf?.autoPublishAfterContentCheck).toBeUndefined()
      // Screened content is sent to the beneficiary straight away.
      expect(onBehalfPort.issueInvitation).toHaveBeenLastCalledWith(expect.not.objectContaining({ held: true }))

      vi.mocked(campaignRepo.save).mockClear()
      const media = build(held('new_media'), onBehalfPort)
      expect((await media.useCase.execute({ ...onBehalfInput, imageUrls: ['https://res.cloudinary.com/test_cloud/image/upload/v1/cover.jpg'] }, 'user-1')).contentReviewReason).toBe('new_media')
      expect(saved().onBehalf?.autoPublishOnConsent).toBe(false)
      // Once staff clear the content, consent may publish it again, as for screened content.
      expect(saved().onBehalf?.autoPublishAfterContentCheck).toBe(true)
      // Nothing unreviewed reaches the beneficiary: the invitation waits for the content check.
      expect(onBehalfPort.issueInvitation).toHaveBeenLastCalledWith(expect.objectContaining({ held: true, email: 'ama@example.com' }))
      expect(media.alerts.campaignPendingReview).toHaveBeenCalledWith(expect.objectContaining({ contentReviewReason: 'new_media' }))
    })

    it('keeps consent from publishing after the content check when staff review or tiering would hold it anyway', async () => {
      const onBehalfPort: OnBehalfCreationPort = {
        invitationsAvailable: true,
        resolveConfig: async () => ({ publicationRequiresConsent: true, donationsRequireConsent: true, staffReviewRequired: true, invitationTtlHours: 72, minManagerVerificationLevel: 0 }),
        issueInvitation: vi.fn(async () => ({ invitationId: 'invitation-1', expiresAt: new Date() })),
      }
      const { useCase } = build(held('screening_flagged'), onBehalfPort)
      await useCase.execute({ ...validInput, onBehalf: { beneficiaryType: 'individual', beneficiaryName: 'Ama Mensah', beneficiaryEmail: 'ama@example.com', relationship: 'patient', reason: 'Ama needs surgery her family cannot afford.', payoutArrangement: 'beneficiary' } }, 'user-1')
      expect(saved().onBehalf).toMatchObject({ autoPublishOnConsent: false, autoPublishAfterContentCheck: false })
      expect(onBehalfPort.issueInvitation).toHaveBeenCalledWith(expect.objectContaining({ held: true }))
    })

    it('fails closed when the admission cannot route new campaigns', async () => {
      const { useCase } = build({ assertAllowed: async () => {}, assertCurrent: async () => {} })
      await expect(useCase.execute(validInput, 'user-1')).rejects.toMatchObject({ statusCode: 503, message: 'Campaign safety review is unavailable' })
      expect(campaignRepo.save).not.toHaveBeenCalled()
    })
  })
})
