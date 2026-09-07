import {
  SubscriptionStatus,
  SubscriptionTier,
  BillingCycle,
  type Subscription,
  type UpgradeSubscriptionInput,
} from '@ubuntu-fund/types';
import type { SubscriptionRepositoryPort } from '../../domain/ports/outbound/SubscriptionRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PERIOD_DAYS: Record<BillingCycle, number> = {
  [BillingCycle.MONTHLY]: 30,
  [BillingCycle.YEARLY]: 365,
};

// Coarse rank of the built-in seed tiers, used only to reject a downgrade via
// this endpoint. Admin-added tiers are unknown here and rank above the seeds, so
// a downgrade FROM a custom tier is still blocked. The authoritative ordering is
// each plan's `sortOrder`; a fuller ranking lands when paid upgrades are enabled.
const TIER_RANK: Record<string, number> = {
  [SubscriptionTier.FREE]: 0,
  [SubscriptionTier.STARTER]: 1,
  [SubscriptionTier.PRO]: 2,
  [SubscriptionTier.ORGANIZATION]: 3,
  [SubscriptionTier.ENTERPRISE]: 4,
};
const rankOf = (tier: string): number => TIER_RANK[tier] ?? 99;

export class UpgradeSubscriptionUseCase {
  constructor(private readonly subscriptionRepo: SubscriptionRepositoryPort) {}

  async execute(input: UpgradeSubscriptionInput, userId: string): Promise<Subscription> {
    if (input.tier !== SubscriptionTier.FREE) {
      throw new AppError('Paid upgrades require a verified billing checkout and are not available yet', 409);
    }
    const existing = await this.subscriptionRepo.findByUserId(userId);
    if (!existing) {
      throw new AppError('Subscription not found', 404);
    }

    if (input.tier === existing.tier) {
      throw new AppError('Already subscribed to this tier', 409);
    }

    if (rankOf(input.tier) < rankOf(existing.tier)) {
      throw new AppError(
        'Cannot downgrade via the upgrade endpoint; use POST /subscriptions instead',
        400
      );
    }

    const billingCycle = input.billingCycle ?? existing.billingCycle;
    const cycleChanged = billingCycle !== existing.billingCycle;
    const now = new Date();
    const periodDays = PERIOD_DAYS[billingCycle];
    if (periodDays === undefined) {
      throw new AppError('Invalid billing cycle', 400);
    }

    const updated = await this.subscriptionRepo.update({
      ...existing,
      tier: input.tier,
      billingCycle,
      status: SubscriptionStatus.ACTIVE,
      cancelAtPeriodEnd: false,
      currentPeriodStart: cycleChanged ? now : existing.currentPeriodStart,
      currentPeriodEnd: cycleChanged
        ? new Date(now.getTime() + periodDays * MS_PER_DAY)
        : existing.currentPeriodEnd,
      updatedAt: now,
    });

    if (!updated) {
      throw new AppError('Subscription not found', 404);
    }

    return updated;
  }
}
