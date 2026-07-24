import { SubscriptionTier, type Subscription } from '@ubuntu-fund/types';
import type { SubscriptionRepositoryPort } from '../../domain/ports/outbound/SubscriptionRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/**
 * Schedules cancellation at the end of the current billing period, mirroring
 * typical SaaS behavior: the plan stays active until `currentPeriodEnd`, at
 * which point a separate billing-cycle job (out of scope here) would move
 * the user to the Free plan.
 */
export class CancelSubscriptionUseCase {
  constructor(private readonly subscriptionRepo: SubscriptionRepositoryPort) {}

  async execute(userId: string): Promise<Subscription> {
    const existing = await this.subscriptionRepo.findByUserId(userId);
    if (!existing) {
      throw new AppError('Subscription not found', 404);
    }

    if (existing.tier === SubscriptionTier.FREE) {
      throw new AppError('Cannot cancel a free plan subscription', 400);
    }

    if (existing.cancelAtPeriodEnd) {
      throw new AppError('Subscription is already scheduled for cancellation', 409);
    }

    const updated = await this.subscriptionRepo.update({
      ...existing,
      cancelAtPeriodEnd: true,
      updatedAt: new Date(),
    });

    if (!updated) {
      throw new AppError('Subscription not found', 404);
    }

    return updated;
  }
}
