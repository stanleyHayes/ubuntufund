import { BillingCycle, SubscriptionCheckoutStatus, SubscriptionStatus } from '@ubuntu-fund/types';
import type { SubscriptionCheckoutRepositoryPort } from '../../domain/ports/outbound/SubscriptionCheckoutRepositoryPort.js';
import type { SubscriptionRepositoryPort } from '../../domain/ports/outbound/SubscriptionRepositoryPort.js';
import type { UnitOfWorkPort } from '../../domain/ports/outbound/UnitOfWorkPort.js';
import { toMinorUnits } from '../../domain/value-objects/Money.js';
import { logger } from '../../infrastructure/logging/logger.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface RefundedSubscriptionPayment {
  /** The refunded Paystack charge (`sub-…`). */
  reference: string;
  /** Amount refunded, in minor units of `currency`; absent means the full charge. */
  refundedMinor?: number;
  currency?: string;
}

export type RefundRevocation = 'revoked' | 'shortened' | 'partial' | 'ignored';

/**
 * Takes back the plan time a refunded web (Paystack) charge paid for. Without
 * it a refunded member kept the paid tier — and its lower fees — for up to a
 * year.
 *
 * Only a charge still listed in the subscription's `paymentReferences` is acted
 * on, so a refund of an older, already-replaced plan never touches the plan the
 * member has now, and a replayed refund event is a no-op. The refunded charge's
 * period (30 or 365 days) is removed from the end of the current period: a
 * fresh period expires now, an early renewal just loses the time it added.
 * Store-billed plans are refunded and revoked by their store, not here.
 *
 * Partial refunds keep the entitlement (logged for staff) until the owner
 * decides whether they should shorten the period pro rata.
 */
export class RevokeRefundedSubscriptionUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly subscriptionCheckoutRepo: SubscriptionCheckoutRepositoryPort,
    private readonly subscriptionRepo: SubscriptionRepositoryPort
  ) {}

  async execute(payment: RefundedSubscriptionPayment): Promise<RefundRevocation> {
    return this.unitOfWork.run(async () => {
      const checkout = await this.subscriptionCheckoutRepo.findByProviderRef(payment.reference);
      if (!checkout || checkout.status !== SubscriptionCheckoutStatus.SUCCEEDED) return 'ignored';

      const sameCurrency = !payment.currency || payment.currency.toUpperCase() === checkout.currency.toUpperCase();
      if (payment.refundedMinor !== undefined && sameCurrency &&
          payment.refundedMinor < toMinorUnits(checkout.finalAmount, checkout.currency)) {
        logger.warn({ checkoutId: checkout.id, reference: payment.reference }, 'partial subscription refund; plan access left unchanged');
        return 'partial';
      }

      const subscription = await this.subscriptionRepo.findByUserId(checkout.userId);
      if (!subscription || subscription.billingProvider === 'apple' || subscription.billingProvider === 'google' ||
          subscription.tier !== checkout.tier || !subscription.paymentReferences?.includes(payment.reference)) {
        return 'ignored';
      }

      const now = new Date();
      const currentEnd = new Date(subscription.currentPeriodEnd).getTime();
      const periodDays = checkout.billingCycle === BillingCycle.YEARLY ? 365 : 30;
      const shortenedEnd = currentEnd - periodDays * MS_PER_DAY;
      const expired = shortenedEnd <= now.getTime();
      await this.subscriptionRepo.update({
        ...subscription,
        status: expired ? SubscriptionStatus.EXPIRED : subscription.status,
        // Never move the end date forward (a lapsed row stays where it was).
        currentPeriodEnd: new Date(expired ? Math.min(now.getTime(), currentEnd) : shortenedEnd),
        paymentReferences: subscription.paymentReferences.filter((reference) => reference !== payment.reference),
        updatedAt: now,
      });
      logger.info({ checkoutId: checkout.id, userId: checkout.userId, expired }, 'refunded subscription payment revoked');
      return expired ? 'revoked' : 'shortened';
    });
  }
}
