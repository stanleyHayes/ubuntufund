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
export type PlanBooleanFeature = NonNullable<
  {
    [K in keyof SubscriptionPlan]: SubscriptionPlan[K] extends boolean ? K : never;
  }[keyof SubscriptionPlan]
>;

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
  private async getPlanFor(tier: string): Promise<SubscriptionPlan> {
    if (this.planService) return this.planService.getPlan(tier, true)
    const seeds = SUBSCRIPTION_PLANS as Record<string, SubscriptionPlan>
    return seeds[tier] ?? seeds[SubscriptionTier.FREE]
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
    const expiry = new Date(subscription.currentPeriodEnd).getTime();
    const trialExpired = subscription.status === SubscriptionStatus.TRIALING && subscription.trialEnd && new Date(subscription.trialEnd).getTime() <= Date.now();
    if (subscription.tier !== SubscriptionTier.FREE && (!Number.isFinite(expiry) || expiry <= Date.now() || trialExpired)) {
      return this.getPlanFor(SubscriptionTier.FREE);
    }
    return this.getPlanFor(subscription.tier);
  }

  /** Paid-only creator entitlement and the effective plan rate for withdrawals. */
  async creatorPolicy(userId: string) {
    const [plan, subscription] = await Promise.all([this.resolvePlan(userId), this.subscriptionRepo.findByUserId(userId)]);
    const eligible = !!subscription && subscription.status === SubscriptionStatus.ACTIVE &&
      new Date(subscription.currentPeriodEnd).getTime() > Date.now() && plan.active &&
      plan.tier !== SubscriptionTier.FREE && (plan.priceMonthly > 0 || plan.priceYearly > 0);
    return { eligible, planName: plan.name, feePercent: plan.platformFeePercent };
  }

  async assertCreatorDonations(userId: string): Promise<void> {
    if (!(await this.creatorPolicy(userId)).eligible) throw new AppError('Creator donations require an active paid subscription. Upgrade your plan to enable your creator page.', 403);
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
  /**
   * The platform fee rate for a specific donation.
   *
   * One implementation for all five settlement rails — wallet, Paystack,
   * Flutterwave, crypto and reconciliation — because each computes the fee
   * independently and a waiver that reached only four of them would credit a
   * campaign the wrong amount on the fifth. They differ in everything except
   * this question, so this is the only place it is answered.
   *
   * A donation carrying a fee-waiver coupon has its rate locked on the intent
   * at creation, exactly as a campaign locks its rate at creation. Absent one,
   * this is the campaign's ordinary rate and nothing changes.
   */
  async platformFeePercentForIntent(intent: {
    campaignId: string;
    platformFeePercentOverride?: number;
  }): Promise<number> {
    if (
      typeof intent.platformFeePercentOverride === 'number' &&
      Number.isFinite(intent.platformFeePercentOverride)
    ) {
      return intent.platformFeePercentOverride;
    }
    return this.platformFeePercentForCampaign(intent.campaignId);
  }

  async platformFeePercentForCampaign(campaignId: string): Promise<number> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) {
      const freePlan = await this.getPlanFor(SubscriptionTier.FREE);
      return freePlan.platformFeePercent;
    }
    // Fee grandfathering (ADR-5): a campaign charges the rate locked at creation,
    // so a mid-campaign plan-fee change never surprises the organizer. Legacy
    // campaigns without a lock fall back to the organizer's live plan rate.
    if (campaign.lockedPlatformFeePercent !== undefined) {
      return campaign.lockedPlatformFeePercent;
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
    goalAmount: number,
    complianceApprovedLimit?: number,
    mediaCount = 0
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

    if (!Number.isFinite(goalAmount) || goalAmount <= 0) throw new AppError('Goal must be a finite positive amount', 422);
    if (plan.maxMediaPerCampaign >= 0 && mediaCount > plan.maxMediaPerCampaign) {
      throw new AppError(`Your ${plan.name} plan allows ${plan.maxMediaPerCampaign} media uploads per campaign.`, 422);
    }

    // Effective goal ceiling = MIN(plan cap, compliance-approved cap); either -1
    // or undefined means "no ceiling" (spec §18: effective = MIN(plan, compliance)).
    const effectiveCap = this.effectiveGoalCap(plan.maxCampaignGoal, complianceApprovedLimit);
    if (effectiveCap !== undefined && goalAmount > effectiveCap) {
      const complianceBinds =
        complianceApprovedLimit !== undefined &&
        complianceApprovedLimit >= 0 &&
        (isUnlimited(plan.maxCampaignGoal) || complianceApprovedLimit < plan.maxCampaignGoal);
      throw new AppError(
        complianceBinds
          ? `A compliance review has capped your campaign goals at GHS ${effectiveCap.toLocaleString('en-US')}.`
          : `Your ${plan.name} plan caps campaign goals at GHS ${effectiveCap.toLocaleString('en-US')}. Upgrade for a higher goal.`,
        422
      );
    }
  }

  /** MIN of the finite (>= 0) caps; undefined when both are unlimited. */
  effectiveGoalCap(planCap: number, complianceCap?: number): number | undefined {
    const caps: number[] = [];
    if (planCap >= 0) caps.push(planCap);
    if (complianceCap !== undefined && complianceCap >= 0) caps.push(complianceCap);
    return caps.length ? Math.min(...caps) : undefined;
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
