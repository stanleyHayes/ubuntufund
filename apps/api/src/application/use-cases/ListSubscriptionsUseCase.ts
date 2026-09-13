import type { Subscription } from '@ubuntu-fund/types';
import type { SubscriptionRepositoryPort } from '../../domain/ports/outbound/SubscriptionRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';

export type AdminSubscription = Subscription & { userName: string; email: string };

export class ListSubscriptionsUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort, private readonly users: UserRepositoryPort) {}

  async execute(params: { page: number; pageSize: number }): Promise<{ items: AdminSubscription[]; total: number }> {
    const result = await this.subscriptions.findAll(params);
    const items = await Promise.all(result.items.map(async (subscription) => {
      const user = await this.users.findById(subscription.userId);
      return { ...subscription, userName: user?.name ?? 'Former member', email: user?.email.value ?? 'Unavailable' };
    }));
    return { items, total: result.total };
  }
}
