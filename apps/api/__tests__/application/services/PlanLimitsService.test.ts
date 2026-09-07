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
})
