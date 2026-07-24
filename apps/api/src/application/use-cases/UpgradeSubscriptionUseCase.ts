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

const TIER_RANK: Record<SubscriptionTier, number> = {
  [SubscriptionTier.FREE]: 0,
  [SubscriptionTier.STARTER]: 1,
  [SubscriptionTier.PRO]: 2,
  [SubscriptionTier.ENTERPRISE]: 3,
};

export class UpgradeSubscriptionUseCase {
  constructor(private readonly subscriptionRepo: SubscriptionRepositoryPort) {}

  async execute(input: UpgradeSubscriptionInput, userId: string): Promise<Subscription> {
    const existing = await this.subscriptionRepo.findByUserId(userId);
    if (!existing) {
      throw new AppError('Subscription not found', 404);
    }

    if (input.tier === existing.tier) {
      throw new AppError('Already subscribed to this tier', 409);
    }

    if (TIER_RANK[input.tier] < TIER_RANK[existing.tier]) {
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
