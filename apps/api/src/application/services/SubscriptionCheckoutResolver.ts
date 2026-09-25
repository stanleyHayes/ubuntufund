import { SubscriptionCheckoutStatus, type SubscriptionCheckout } from '@ubuntu-fund/types';
import type { SubscriptionCheckoutRepositoryPort } from '../../domain/ports/outbound/SubscriptionCheckoutRepositoryPort.js';
import type { CouponRedemptionRepositoryPort } from '../../domain/ports/outbound/CouponRedemptionRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import type { SettleSubscriptionUseCase } from '../use-cases/SettleSubscriptionUseCase.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { ProviderTransactionNotFoundError } from '../../domain/errors/ProviderTransactionNotFoundError.js';

/** How long an unpaid web checkout may stay PENDING before it expires. */
export const SUBSCRIPTION_CHECKOUT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Prefix of the synthetic reference a coupon-zeroed checkout settles under
 * inline. No provider ever saw it, so it can never be verified or paid.
 */
export const INLINE_REFERENCE_PREFIX = 'sub_free_';

/**
 * A checkout that cannot hold money (its charge never opened, or its inline
 * no-charge settlement did not commit) is only kept this long, however long
 * the caller would hold a payable one: settlement for it is synchronous, so
 * after a few minutes nothing is still coming.
 */
const NO_CHARGE_GRACE_MS = 5 * 60 * 1000;

/**
 * A charge Paystack still reports as processing after this long is treated as
 * stuck, so it cannot block the member or the sweep forever. A genuine late
 * success still settles (EXPIRED → SUCCEEDED is allowed).
 */
const IN_FLIGHT_CEILING_MS = SUBSCRIPTION_CHECKOUT_TTL_MS;

/**
 * Where a checkout ended up after {@link SubscriptionCheckoutResolver.resolve}:
 * `settled` (paid and activated), `failed`, `expired` (unpaid past its
 * lifetime), or `pending` (still payable, or the provider is still processing).
 */
export type CheckoutResolution = 'settled' | 'failed' | 'expired' | 'pending';

/** Paystack statuses that can still become a successful charge. */
const IN_FLIGHT = new Set(['pending', 'ongoing', 'processing', 'queued']);

/**
 * The single place a PENDING subscription checkout is re-checked against the
 * payment provider and moved to a safe terminal state. Used by the member's
 * own "check payment" verification, by checkout creation (so a second charge is
 * never opened over an unresolved first one) and by the reconciliation sweep.
 *
 *  - provider success (matching reference, currency and amount) → settle via
 *    {@link SettleSubscriptionUseCase} (exactly-once; repairs a missed webhook);
 *  - provider failed/reversed → FAILED, coupon seat released;
 *  - abandoned (the member never paid) past `expireUnpaidAfterMs` → EXPIRED,
 *    coupon seat released. A later genuine charge.success still settles it;
 *  - still processing → left PENDING, until it has been processing for a day;
 *  - anything else → left PENDING.
 *
 * A checkout that holds no charge (no provider reference, a synthetic
 * no-charge reference, or a reference the provider has never heard of) can
 * hold no money, so it expires once past the same age. Other provider errors
 * propagate; callers decide whether that is transient.
 */
export class SubscriptionCheckoutResolver {
  constructor(
    private readonly subscriptionCheckoutRepo: SubscriptionCheckoutRepositoryPort,
    private readonly gateway: PaymentGatewayPort,
    private readonly settle: SettleSubscriptionUseCase,
    private readonly couponRedemptionRepo?: CouponRedemptionRepositoryPort
  ) {}

  async resolve(
    checkout: SubscriptionCheckout,
    options: { expireUnpaidAfterMs?: number; now?: Date } = {}
  ): Promise<CheckoutResolution> {
    if (checkout.status === SubscriptionCheckoutStatus.SUCCEEDED) return 'settled';
    if (checkout.status === SubscriptionCheckoutStatus.FAILED) return 'failed';
    if (checkout.status === SubscriptionCheckoutStatus.EXPIRED) return 'expired';

    const now = options.now ?? new Date();
    const age = now.getTime() - new Date(checkout.createdAt).getTime();
    const pastLifetime = options.expireUnpaidAfterMs !== undefined &&
      Number.isFinite(age) && age >= options.expireUnpaidAfterMs;

    if (!checkout.providerRef || checkout.providerRef.startsWith(INLINE_REFERENCE_PREFIX)) {
      // Nothing was charged: the payment page never opened, or a coupon-zeroed
      // activation failed to commit. Verifying it with Paystack could only fail,
      // which used to lock the member out of every purchase for a week.
      const pastGrace = options.expireUnpaidAfterMs !== undefined &&
        Number.isFinite(age) && age >= Math.min(options.expireUnpaidAfterMs, NO_CHARGE_GRACE_MS);
      return pastGrace ? this.expire(checkout) : 'pending';
    }

    let verified: Awaited<ReturnType<PaymentGatewayPort['verifyTransaction']>>;
    try {
      verified = await this.gateway.verifyTransaction(checkout.providerRef);
    } catch (error) {
      // Paystack has no transaction under this reference (for example it was
      // opened under a different key), so it cannot be paid through this
      // account: treat it as never paid rather than as unverifiable forever.
      if (!(error instanceof ProviderTransactionNotFoundError)) throw error;
      return pastLifetime ? this.expire(checkout) : 'pending';
    }
    if (verified.reference !== checkout.providerRef || verified.currency !== checkout.currency ||
        !Number.isFinite(verified.amount) ||
        Math.round(verified.amount * 100) !== Math.round(checkout.finalAmount * 100)) {
      throw new AppError('Payment does not match this subscription checkout', 409);
    }
    const status = verified.status.toLowerCase();
    if (status === 'success') {
      await this.settle.execute(checkout, checkout.providerRef);
      return 'settled';
    }
    if (status === 'failed' || status === 'reversed') {
      await this.subscriptionCheckoutRepo.transitionToFailed(checkout.id);
      // A PENDING slot still counts against the per-user limit, so leaving it
      // burns the seat on a failed payment.
      await this.releaseSeat(checkout);
      return 'failed';
    }
    const stuckInFlight = Number.isFinite(age) && age >= IN_FLIGHT_CEILING_MS;
    if (pastLifetime && (!IN_FLIGHT.has(status) || stuckInFlight)) return this.expire(checkout);
    return 'pending';
  }

  /** Expire an unpaid checkout and free the coupon seat it was holding. */
  async expire(checkout: SubscriptionCheckout): Promise<CheckoutResolution> {
    const expired = await this.subscriptionCheckoutRepo.transitionToExpired(checkout.id);
    if (!expired) {
      // Raced with a settlement or failure; report what actually happened.
      const current = await this.subscriptionCheckoutRepo.findById(checkout.id);
      return current?.status === SubscriptionCheckoutStatus.SUCCEEDED ? 'settled'
        : current?.status === SubscriptionCheckoutStatus.FAILED ? 'failed' : 'expired';
    }
    await this.releaseSeat(checkout);
    return 'expired';
  }

  private async releaseSeat(checkout: SubscriptionCheckout): Promise<void> {
    if (!this.couponRedemptionRepo || !checkout.couponId) return;
    // Correlate by reference when there is one; a checkout whose charge never
    // opened, or whose slot never got the reference (the process stopped
    // between the two writes), only has its slot's checkout id.
    const redemption =
      (checkout.providerRef ? await this.couponRedemptionRepo.findByProviderRef(checkout.providerRef) : null) ??
      await this.couponRedemptionRepo.findByCheckoutId(checkout.id);
    if (redemption) await this.couponRedemptionRepo.markReleased(redemption.id);
  }
}
