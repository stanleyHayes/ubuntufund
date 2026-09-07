import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CreateCampaignUseCase } from '../../../src/application/use-cases/CreateCampaignUseCase.js'
import { UserEntity } from '../../../src/domain/entities/User.js'
import { CampaignEntity } from '../../../src/domain/entities/Campaign.js'
import { Email } from '../../../src/domain/value-objects/Email.js'
import { TrustScore } from '../../../src/domain/value-objects/TrustScore.js'
import type { CampaignRepositoryPort } from '../../../src/domain/ports/outbound/CampaignRepositoryPort.js'
import type { UserRepositoryPort } from '../../../src/domain/ports/outbound/UserRepositoryPort.js'
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
      new PlanLimitsService(subscriptionRepo, campaignRepo)
    )
  })

  it('creates a campaign and calls save on the repository', async () => {
    const result = await useCase.execute(validInput, 'user-1')

    expect(userRepo.findById).toHaveBeenCalledWith('user-1')
    expect(campaignRepo.countByCreatorId).toHaveBeenCalledWith('user-1')
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
    vi.mocked(campaignRepo.countByCreatorId).mockResolvedValue(3)

    await expect(useCase.execute(validInput, 'user-1')).rejects.toThrow(
      /cannot create more campaigns/i
    )
    expect(campaignRepo.save).not.toHaveBeenCalled()
  })

  it('throws when user with NONE verification tries to create', async () => {
    vi.mocked(userRepo.findById).mockResolvedValue(
      makeUser({ verificationLevel: VerificationLevel.NONE })
    )
    vi.mocked(campaignRepo.countByCreatorId).mockResolvedValue(0)

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
      new PlanLimitsService(makeSubscriptionRepo(SubscriptionTier.STARTER), campaignRepo)
    )

    const result = await starterUseCase.execute(
      { ...validInput, goalAmount: 20000 },
      'user-1'
    )
    expect(result.goalAmount).toBe(20000)
    expect(campaignRepo.save).toHaveBeenCalledTimes(1)
  })
})
