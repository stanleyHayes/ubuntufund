import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import type { SettleSubscriptionUseCase } from './SettleSubscriptionUseCase.js';
import { SubscriptionCheckoutStatus, type SubscriptionCheckout } from '@ubuntu-fund/types';
import type { SubscriptionCheckoutRepositoryPort } from '../../domain/ports/outbound/SubscriptionCheckoutRepositoryPort.js';
import type { CouponRedemptionRepositoryPort } from '../../domain/ports/outbound/CouponRedemptionRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { SUBSCRIPTION_CHECKOUT_TTL_MS, SubscriptionCheckoutResolver } from '../services/SubscriptionCheckoutResolver.js';

/**
 * Fetches one subscription checkout by id, scoped to its owner. The user polls
 * this after a Paystack redirect to watch PENDING → SUCCEEDED/FAILED. A checkout
 * belonging to another user is reported as not found (never leaks its existence).
 */
export class GetSubscriptionCheckoutUseCase {
  constructor(
    private readonly subscriptionCheckoutRepo: SubscriptionCheckoutRepositoryPort,
    private readonly gateway?: PaymentGatewayPort,
    private readonly settle?: SettleSubscriptionUseCase,
    // Optional: frees the coupon seat when verification confirms the charge
    // failed, mirroring the webhook rail.
    private readonly couponRedemptionRepo?: CouponRedemptionRepositoryPort
  ) {}

  async execute(id: string, userId: string): Promise<SubscriptionCheckout> {
    const checkout = await this.subscriptionCheckoutRepo.findById(id);
    if (!checkout || checkout.userId !== userId) {
      throw new AppError('Subscription checkout not found', 404);
    }
    return checkout;
  }
  async verifyReference(reference: string, userId: string): Promise<SubscriptionCheckout> {
    const checkout = await this.subscriptionCheckoutRepo.findByProviderRef(reference);
    if (!checkout || checkout.userId !== userId) throw new AppError('Subscription checkout not found', 404);
    return this.verify(checkout.id, userId);
  }

  async verify(id: string, userId: string): Promise<SubscriptionCheckout> {
    const checkout = await this.execute(id, userId);
    if (checkout.status !== 'pending' || !checkout.providerRef) return checkout;
    if (!this.gateway || !this.settle) throw new AppError('Subscription verification unavailable', 503);
    // Success settles (repairing a missed webhook), failure frees the coupon
    // seat, and a checkout abandoned for longer than its lifetime expires so the
    // member is told to start again rather than wait forever.
    await new SubscriptionCheckoutResolver(
      this.subscriptionCheckoutRepo, this.gateway, this.settle, this.couponRedemptionRepo
    ).resolve(checkout, { expireUnpaidAfterMs: SUBSCRIPTION_CHECKOUT_TTL_MS });
    return this.execute(id, userId);
  }

  /**
   * The member walked away from an unpaid checkout and wants to start over
   * (another cycle, a coupon). Paystack is asked first: a paid one is settled
   * and a failed one closed as usual, and one it is still processing is
   * refused, since cancelling it could lead to paying twice. Otherwise the
   * checkout expires at once and frees its coupon seat. If the old payment page
   * is still paid later, that charge still settles (EXPIRED → SUCCEEDED).
   */
  async abandon(id: string, userId: string): Promise<SubscriptionCheckout> {
    const checkout = await this.execute(id, userId);
    if (checkout.status !== SubscriptionCheckoutStatus.PENDING) return checkout;
    if (!this.gateway || !this.settle) throw new AppError('Subscription verification unavailable', 503);
    const outcome = await new SubscriptionCheckoutResolver(
      this.subscriptionCheckoutRepo, this.gateway, this.settle, this.couponRedemptionRepo
    ).resolve(checkout, { expireUnpaidAfterMs: 0 });
    if (outcome === 'pending') {
      throw new AppError(
        'This payment is still being processed, so it cannot be cancelled yet. Check its status again in a few minutes.',
        409,
        { checkoutId: [id] }
      );
    }
    return this.execute(id, userId);
  }
}
