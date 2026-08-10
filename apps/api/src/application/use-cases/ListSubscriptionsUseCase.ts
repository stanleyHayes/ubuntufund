import type { Subscription } from '@ubuntu-fund/types';
import type { SubscriptionRepositoryPort } from '../../domain/ports/outbound/SubscriptionRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';

export type AdminSubscription = Subscription & { userName: string; email: string };

export class ListSubscriptionsUseCase {
  constructor(private readonly subscriptions: SubscriptionRepositoryPort, private readonly users: UserRepositoryPort) {}

  async execute(): Promise<AdminSubscription[]> {
    const subscriptions = await this.subscriptions.findAll();
    return Promise.all(subscriptions.map(async (subscription) => {
      const user = await this.users.findById(subscription.userId);
      return { ...subscription, userName: user?.name ?? 'Former member', email: user?.email.value ?? 'Unavailable' };
    }));
  }
}
