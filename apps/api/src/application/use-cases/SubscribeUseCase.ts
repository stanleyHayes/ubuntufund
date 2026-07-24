import {
  SubscriptionStatus,
  BillingCycle,
  type Subscription,
  type CreateSubscriptionInput,
} from '@ubuntu-fund/types';
import type { SubscriptionRepositoryPort } from '../../domain/ports/outbound/SubscriptionRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PERIOD_DAYS: Record<BillingCycle, number> = {
  [BillingCycle.MONTHLY]: 30,
  [BillingCycle.YEARLY]: 365,
};

/**
 * Subscribes the user to a plan. Creates a fresh subscription record for
 * first-time subscribers, or replaces the tier/billing cycle of an existing
 * one (covers switching to a different or lower tier; use the upgrade
 * use case for moving to a strictly higher tier).
 */
export class SubscribeUseCase {
  constructor(private readonly subscriptionRepo: SubscriptionRepositoryPort) {}

  async execute(input: CreateSubscriptionInput, userId: string): Promise<Subscription> {
    const periodDays = PERIOD_DAYS[input.billingCycle];
    if (periodDays === undefined) {
      throw new AppError('Invalid billing cycle', 400);
    }

    const existing = await this.subscriptionRepo.findByUserId(userId);
    const now = new Date();

    const next: Subscription = {
      id: existing?.id ?? '', // Assigned by repository when creating
      userId,
      tier: input.tier,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: input.billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + periodDays * MS_PER_DAY),
      cancelAtPeriodEnd: false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) {
      const updated = await this.subscriptionRepo.update(next);
      if (!updated) {
        throw new AppError('Subscription not found', 404);
      }
      return updated;
    }

    return this.subscriptionRepo.save(next);
  }
}
