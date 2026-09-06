import {
  SubscriptionStatus,
  SubscriptionTier,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlan,
} from '@ubuntu-fund/types';
import type { SubscriptionRepositoryPort } from '../../domain/ports/outbound/SubscriptionRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { PlanService } from './PlanService.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/**
 * The boolean feature flags on a plan — the keys whose value is a boolean.
 * Used by {@link PlanLimitsService.assertFeature} so callers can only gate on a
 * real on/off capability (e.g. `liveStreaming`, `campaignCollaboration`).
 */
export type PlanBooleanFeature = {
  [K in keyof SubscriptionPlan]: SubscriptionPlan[K] extends boolean ? K : never;
}[keyof SubscriptionPlan];

/** A subscription only unlocks its plan while it is actually in force. */
const ACTIVE_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
]);

/** Plan limits use -1 (and, defensively, any negative) to mean "unlimited". */
function isUnlimited(limit: number): boolean {
  return limit < 0;
}

/**
 * Resolves a user's effective subscription plan and enforces its limits.
 *
 * {@link PlanService} is the single source of truth for per-tier limits — the
 * DB-backed, admin-editable plan (active-campaign count, campaign-goal cap, the
 * platform fee rate, and the boolean feature flags such as live streaming and
 * collaboration), falling back to the code-defined defaults. This service maps a
 * user's active subscription onto that plan, defaulting to the Free plan when
 * the user has no active subscription, and exposes the guards the use-cases call
 * to enforce it server-side.
 *
 * It reads through the subscription + campaign repository ports and PlanService
 * only (never the Mongo models directly), keeping it unit-testable with
 * in-memory fakes.
 */
export class PlanLimitsService {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    // Optional so unit tests can construct the service without the full DI graph;
    // when absent, plans resolve from the code-defined SUBSCRIPTION_PLANS defaults
    // (the same values PlanService itself falls back to). Prod always wires it.
    private readonly planService?: PlanService
  ) {}

  /** Resolve a plan via PlanService (DB-backed) when wired, else the code defaults. */
  private async getPlanFor(tier: SubscriptionTier): Promise<SubscriptionPlan> {
    if (this.planService) return this.getPlanFor(tier)
    return SUBSCRIPTION_PLANS[tier]
  }

  /**
   * The plan currently in force for a user. Falls back to the Free plan when the
   * user has no subscription record, or when their record is not active
   * (expired, cancelled, past-due) — those users get Free-tier limits, never a
   * stale paid plan.
   */
  async resolvePlan(userId: string): Promise<SubscriptionPlan> {
    const subscription = await this.subscriptionRepo.findByUserId(userId);
    if (!subscription || !ACTIVE_STATUSES.has(subscription.status)) {
      return this.getPlanFor(SubscriptionTier.FREE);
    }
    return this.getPlanFor(subscription.tier);
  }

  /** The platform revenue cut (%) to apply to donations for this user's plan. */
  async platformFeePercent(userId: string): Promise<number> {
    const plan = await this.resolvePlan(userId);
    return plan.platformFeePercent;
  }

  /**
   * The platform fee rate for a campaign's *creator* — the party the fee is
   * charged against. Resolves the campaign, then its creator's plan. A missing
   * campaign falls back to the Free-plan rate rather than throwing, so a
   * settlement is never blocked by fee resolution.
   */
  async platformFeePercentForCampaign(campaignId: string): Promise<number> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) {
      const freePlan = await this.getPlanFor(SubscriptionTier.FREE);
      return freePlan.platformFeePercent;
    }
    return this.platformFeePercent(campaign.creatorId);
  }

  /**
   * Guard for campaign creation: enforces the plan's active-campaign count and
   * campaign-goal caps. Throws {@link AppError} (403 over the campaign count,
   * 422 over the goal cap) with an upgrade-oriented message.
   */
  async assertCanCreateCampaign(
    userId: string,
    goalAmount: number
  ): Promise<void> {
    const plan = await this.resolvePlan(userId);

    if (!isUnlimited(plan.maxActiveCampaigns)) {
      const activeCount = await this.campaignRepo.countActiveByCreator(userId);
      if (activeCount >= plan.maxActiveCampaigns) {
        const noun =
          plan.maxActiveCampaigns === 1 ? 'campaign' : 'campaigns';
        throw new AppError(
          `Your ${plan.name} plan allows ${plan.maxActiveCampaigns} active ${noun}. Upgrade to create more.`,
          403
        );
      }
    }

    if (!isUnlimited(plan.maxCampaignGoal) && goalAmount > plan.maxCampaignGoal) {
      throw new AppError(
        `Your ${plan.name} plan caps campaign goals at GHS ${plan.maxCampaignGoal.toLocaleString(
          'en-US'
        )}. Upgrade for a higher goal.`,
        422
      );
    }
  }

  /**
   * Guard for a boolean plan feature. Throws {@link AppError} 403 with an
   * upgrade message when the user's plan does not include `feature`. `label` is
   * the human-facing name of the capability (e.g. "LIVE streaming").
   */
  async assertFeature(
    userId: string,
    feature: PlanBooleanFeature,
    label: string
  ): Promise<void> {
    const plan = await this.resolvePlan(userId);
    if (!plan[feature]) {
      throw new AppError(
        `Your ${plan.name} plan does not include ${label}. Upgrade to unlock it.`,
        403
      );
    }
  }
}
