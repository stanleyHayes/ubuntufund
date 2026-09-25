import type { Subscription } from '@ubuntu-fund/types';
import type { SubscriptionRepositoryPort } from '../../domain/ports/outbound/SubscriptionRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import { withEffectiveStatus } from '../../domain/services/subscriptionStatus.js';

export type AdminSubscription = Subscription & { userName: string; email: string };

export class ListSubscriptionsUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort, private readonly users: UserRepositoryPort) {}

  async execute(params: { page: number; pageSize: number }): Promise<{ items: AdminSubscription[]; total: number }> {
    const result = await this.subscriptions.findAll(params);
    const now = new Date();
    const items = await Promise.all(result.items.map(async (subscription) => {
      const user = await this.users.findById(subscription.userId);
      // Staff see the same derived status as the member: a lapsed web plan is
      // expired, not active revenue.
      return { ...withEffectiveStatus(subscription, now), userName: user?.name ?? 'Former member', email: user?.email.value ?? 'Unavailable' };
    }));
    return { items, total: result.total };
  }
}
