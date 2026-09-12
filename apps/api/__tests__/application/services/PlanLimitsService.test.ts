import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlanLimitsService } from '../../../src/application/services/PlanLimitsService.js'
import type { SubscriptionRepositoryPort } from '../../../src/domain/ports/outbound/SubscriptionRepositoryPort.js'
import type { CampaignRepositoryPort } from '../../../src/domain/ports/outbound/CampaignRepositoryPort.js'
import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
  type Subscription,
} from '@ubuntu-fund/types'

function makeSubscription(
  tier: SubscriptionTier,
  status: SubscriptionStatus = SubscriptionStatus.ACTIVE
): Subscription {
  const now = new Date()
  return {
    id: 'sub-1',
    userId: 'user-1',
    tier,
    status,
    billingCycle: BillingCycle.MONTHLY,
    currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    createdAt: now,
    updatedAt: now,
  }
}

describe('PlanLimitsService', () => {
  let subscriptionRepo: SubscriptionRepositoryPort
  let campaignRepo: CampaignRepositoryPort
  let service: PlanLimitsService

  beforeEach(() => {
    subscriptionRepo = {
      findByUserId: vi.fn().mockResolvedValue(null),
      findById: vi.fn(),
      findAll: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
    }
    campaignRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findAll: vi.fn(),
      findByCreatorId: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      countByCreatorId: vi.fn().mockResolvedValue(0),
      countActiveByCreator: vi.fn().mockResolvedValue(0),
      incrementRaised: vi.fn(),
    }
    service = new PlanLimitsService(subscriptionRepo, campaignRepo)
  })

  it('does not grant paid limits past the billing or trial end', async () => {
    const expired = makeSubscription(SubscriptionTier.PRO);
    expired.currentPeriodEnd = new Date(Date.now() - 1);
    vi.mocked(subscriptionRepo.findByUserId).mockResolvedValue(expired);
    expect((await service.resolvePlan('user-1')).tier).toBe(SubscriptionTier.FREE);
    const trial = makeSubscription(SubscriptionTier.PRO, SubscriptionStatus.TRIALING);
    trial.trialEnd = new Date(Date.now() - 1);
    vi.mocked(subscriptionRepo.findByUserId).mockResolvedValue(trial);
    expect((await service.resolvePlan('user-1')).tier).toBe(SubscriptionTier.FREE);
  });

  it('rejects non-finite goals instead of treating them as below the cap', async () => {
    await expect(service.assertCanCreateCampaign('user-1', NaN)).rejects.toThrow('finite positive');
    await expect(service.assertCanCreateCampaign('user-1', Infinity)).rejects.toThrow('finite positive');
  });

  describe('resolvePlan', () => {
    it('defaults to the Free plan when the user has no subscription', async () => {
      const plan = await service.resolvePlan('user-1')
      expect(plan.tier).toBe(SubscriptionTier.FREE)
      expect(plan.platformFeePercent).toBe(3.5)
    })

    it('maps an active subscription to its tier plan', async () => {
      vi.mocked(subscriptionRepo.findByUserId).mockResolvedValue(
        makeSubscription(SubscriptionTier.PRO)
      )
      const plan = await service.resolvePlan('user-1')
      expect(plan.tier).toBe(SubscriptionTier.PRO)
      expect(plan.platformFeePercent).toBe(2.5)
    })

    it('falls back to Free when the subscription is not active', async () => {
      vi.mocked(subscriptionRepo.findByUserId).mockResolvedValue(
        makeSubscription(SubscriptionTier.PRO, SubscriptionStatus.CANCELLED)
      )
      const plan = await service.resolvePlan('user-1')
      expect(plan.tier).toBe(SubscriptionTier.FREE)
    })
  })

  describe('platformFeePercent', () => {
    it('returns the plan rate for the user (Free 3.5%)', async () => {
      await expect(service.platformFeePercent('user-1')).resolves.toBe(3.5)
    })

    it('returns the Enterprise rate (1.25%) for an enterprise subscriber', async () => {
      vi.mocked(subscriptionRepo.findByUserId).mockResolvedValue(
        makeSubscription(SubscriptionTier.ENTERPRISE)
      )
      await expect(service.platformFeePercent('user-1')).resolves.toBe(1.25)
    })
  })

  describe('platformFeePercentForCampaign', () => {
    it('resolves via the campaign creator', async () => {
      vi.mocked(campaignRepo.findById).mockResolvedValue({
        creatorId: 'creator-9',
      } as never)
      vi.mocked(subscriptionRepo.findByUserId).mockImplementation((id) =>
        Promise.resolve(
          id === 'creator-9' ? makeSubscription(SubscriptionTier.STARTER) : null
        )
      )
      await expect(
        service.platformFeePercentForCampaign('camp-1')
      ).resolves.toBe(3.0)
    })

    it('falls back to the Free rate for a missing campaign', async () => {
      vi.mocked(campaignRepo.findById).mockResolvedValue(null)
      await expect(
        service.platformFeePercentForCampaign('missing')
      ).resolves.toBe(3.5)
    })
  })

  describe('assertCanCreateCampaign', () => {
    it('throws 403 when the active-campaign cap is reached', async () => {
      vi.mocked(campaignRepo.countActiveByCreator).mockResolvedValue(1) // Free cap = 1
      let err: unknown
      try {
        await service.assertCanCreateCampaign('user-1', 1000)
      } catch (e) {
        err = e
      }
      expect((err as { statusCode?: number }).statusCode).toBe(403)
    })

    it('throws 422 when the goal exceeds the plan cap', async () => {
      let err: unknown
      try {
        await service.assertCanCreateCampaign('user-1', 12000) // Free cap = 10000
      } catch (e) {
        err = e
      }
      expect((err as { statusCode?: number }).statusCode).toBe(422)
    })

    it('enforces the tighter compliance cap (effective = MIN(plan, compliance))', async () => {
      // Free plan caps at 10000; a compliance limit of 6000 binds tighter.
      let err: unknown;
      try {
        await service.assertCanCreateCampaign('user-1', 8000, 6000);
      } catch (e) {
        err = e;
      }
      expect((err as { statusCode?: number }).statusCode).toBe(422);
      expect((err as Error).message).toMatch(/compliance review/i);
    });

    it('a compliance cap at/above the plan cap never lifts the effective ceiling', async () => {
      // Free plan 10000, compliance 50000 → effective MIN = 10000; 8000 is fine.
      await expect(
        service.assertCanCreateCampaign('user-1', 8000, 50000)
      ).resolves.toBeUndefined();
      // …but 12000 still exceeds the plan cap (compliance can't raise it).
      let err: unknown;
      try {
        await service.assertCanCreateCampaign('user-1', 12000, 50000);
      } catch (e) {
        err = e;
      }
      expect((err as { statusCode?: number }).statusCode).toBe(422);
    });

    it('treats an unlimited cap (-1) as no ceiling', async () => {
      vi.mocked(subscriptionRepo.findByUserId).mockResolvedValue(
        makeSubscription(SubscriptionTier.ENTERPRISE)
      )
      vi.mocked(campaignRepo.countActiveByCreator).mockResolvedValue(50)
      await expect(
        service.assertCanCreateCampaign('user-1', 10_000_000)
      ).resolves.toBeUndefined()
    })
  })

  describe('assertFeature', () => {
    it('throws 403 when the plan lacks the feature', async () => {
      // Free plan: liveStreaming = false
      let err: unknown
      try {
        await service.assertFeature('user-1', 'liveStreaming', 'LIVE streaming')
      } catch (e) {
        err = e
      }
      expect((err as { statusCode?: number }).statusCode).toBe(403)
      expect((err as Error).message).toMatch(/LIVE streaming/)
    })

    it('passes when the plan includes the feature', async () => {
      vi.mocked(subscriptionRepo.findByUserId).mockResolvedValue(
        makeSubscription(SubscriptionTier.PRO)
      )
      await expect(
        service.assertFeature('user-1', 'liveStreaming', 'LIVE streaming')
      ).resolves.toBeUndefined()
    })
  })

  describe('platformFeePercentForIntent — the one resolver all five rails share', () => {
    beforeEach(() => {
      campaignRepo.findById = vi
        .fn()
        .mockResolvedValue({ creatorId: 'user-1', lockedPlatformFeePercent: 10 })
    })

    it('prefers a rate locked onto the intent by a fee-waiver coupon', async () => {
      await expect(
        service.platformFeePercentForIntent({ campaignId: 'c-1', platformFeePercentOverride: 4 }),
      ).resolves.toBe(4)
    })

    it('honours a full waiver rather than reading zero as "unset"', async () => {
      // A 100%-off coupon locks 0. Treating that as absent would silently
      // charge the ordinary fee on a donation sold as fee-free — the falsy
      // trap that makes "off" and "unconfigured" indistinguishable.
      await expect(
        service.platformFeePercentForIntent({ campaignId: 'c-1', platformFeePercentOverride: 0 }),
      ).resolves.toBe(0)
    })

    it('falls back to the campaign rate when there is no waiver', async () => {
      await expect(service.platformFeePercentForIntent({ campaignId: 'c-1' })).resolves.toBe(10)
    })
  })

  describe('platformFeePercentForCampaign — fee grandfathering (ADR-5)', () => {
    it('uses the campaign\'s locked fee, ignoring a later plan-fee change', async () => {
      // Organizer is on a plan whose live fee is now 1.0%, but the campaign
      // locked 3.5% at creation — donations must still be charged 3.5%.
      subscriptionRepo.findByUserId = vi
        .fn()
        .mockResolvedValue(makeSubscription(SubscriptionTier.ENTERPRISE)) // low live fee
      campaignRepo.findById = vi.fn().mockResolvedValue({
        creatorId: 'user-1',
        lockedPlatformFeePercent: 3.5,
      })
      await expect(service.platformFeePercentForCampaign('c-1')).resolves.toBe(3.5)
    })

    it('falls back to the live plan rate for a legacy campaign with no lock', async () => {
      subscriptionRepo.findByUserId = vi
        .fn()
        .mockResolvedValue(makeSubscription(SubscriptionTier.FREE))
      campaignRepo.findById = vi.fn().mockResolvedValue({
        creatorId: 'user-1',
        lockedPlatformFeePercent: undefined,
      })
      // Free plan's live platform fee (v6 = 3.5%).
      await expect(service.platformFeePercentForCampaign('c-1')).resolves.toBe(3.5)
    })
  })
})
