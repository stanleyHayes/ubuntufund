import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import type { SettleSubscriptionUseCase } from './SettleSubscriptionUseCase.js';
import type { SubscriptionCheckout } from '@ubuntu-fund/types';
import type { SubscriptionCheckoutRepositoryPort } from '../../domain/ports/outbound/SubscriptionCheckoutRepositoryPort.js';
import type { CouponRedemptionRepositoryPort } from '../../domain/ports/outbound/CouponRedemptionRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

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
    const verified = await this.gateway.verifyTransaction(checkout.providerRef);
    if (verified.reference !== checkout.providerRef || verified.currency !== checkout.currency ||
        !Number.isFinite(verified.amount) || Math.round(verified.amount * 100) !== Math.round(checkout.finalAmount * 100)) {
      throw new AppError('Payment does not match this subscription checkout', 409);
    }
    if (verified.status === 'success') {
      await this.settle.execute(checkout, checkout.providerRef);
    } else if (verified.status === 'failed') {
      await this.subscriptionCheckoutRepo.transitionToFailed(checkout.id);
      // Same reasoning as the webhook path: a PENDING slot still counts against
      // the per-user limit, so leaving it burns the seat on a failed payment.
      if (this.couponRedemptionRepo && checkout.couponId) {
        const redemption = await this.couponRedemptionRepo.findByProviderRef(
          checkout.providerRef
        );
        if (redemption) {
          await this.couponRedemptionRepo.markReleased(redemption.id);
        }
      }
    }
    return this.execute(id, userId);
  }

}
