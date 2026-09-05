import type { SubscriptionCheckout } from '@ubuntu-fund/types';
import type { SubscriptionCheckoutRepositoryPort } from '../../domain/ports/outbound/SubscriptionCheckoutRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/**
 * Fetches one subscription checkout by id, scoped to its owner. The user polls
 * this after a Paystack redirect to watch PENDING → SUCCEEDED/FAILED. A checkout
 * belonging to another user is reported as not found (never leaks its existence).
 */
export class GetSubscriptionCheckoutUseCase {
  constructor(
    private readonly subscriptionCheckoutRepo: SubscriptionCheckoutRepositoryPort
  ) {}

  async execute(id: string, userId: string): Promise<SubscriptionCheckout> {
    const checkout = await this.subscriptionCheckoutRepo.findById(id);
    if (!checkout || checkout.userId !== userId) {
      throw new AppError('Subscription checkout not found', 404);
    }
    return checkout;
  }
}
