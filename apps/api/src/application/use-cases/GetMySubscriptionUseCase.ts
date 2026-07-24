import {
  SubscriptionTier,
  SubscriptionStatus,
  BillingCycle,
  type Subscription,
} from '@ubuntu-fund/types';
import type { SubscriptionRepositoryPort } from '../../domain/ports/outbound/SubscriptionRepositoryPort.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const FREE_PERIOD_DAYS = 30;

export class GetMySubscriptionUseCase {
  constructor(private readonly subscriptionRepo: SubscriptionRepositoryPort) {}

  async execute(userId: string): Promise<Subscription> {
    const existing = await this.subscriptionRepo.findByUserId(userId);
    if (existing) {
      return existing;
    }

    // Every user is implicitly on the Free plan until they subscribe.
    // Lazily provision that record on first access rather than requiring
    // it to exist from registration.
    const now = new Date();
    const freeSubscription: Subscription = {
      id: '', // Assigned by repository
      userId,
      tier: SubscriptionTier.FREE,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + FREE_PERIOD_DAYS * MS_PER_DAY),
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    };

    return this.subscriptionRepo.save(freeSubscription);
  }
}
