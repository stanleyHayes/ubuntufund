import type { CouponRedemptionRepositoryPort } from '../../domain/ports/outbound/CouponRedemptionRepositoryPort.js';
import { logger } from '../../infrastructure/logging/logger.js';

/**
 * Give back the coupon seat a failed donation was holding.
 *
 * A fee-waiver seat is claimed PENDING when the intent is created, and PENDING
 * counts against the coupon's per-user limit. Without this, a donor who closed
 * the checkout tab or whose card declined had permanently spent one of their
 * allowed redemptions — and because an invalid code aborts the whole donation
 * rather than falling back to full fee, they could not even donate again until
 * they cleared the field. Money never moved; the redemption was gone anyway.
 *
 * A donation redemption is correlated to its intent by `providerRef`, so the
 * intent id is all a failure path needs to know.
 *
 * One function rather than the same five lines at each of the six places a
 * donation can fail: the rails diverge in everything except this, and a release
 * that reached five of them would leave the sixth burning seats silently.
 *
 * Never throws. A donation that failed has already told the donor so; a
 * bookkeeping problem on top of that must not turn into a second error.
 */
export async function releaseDonationSeat(
  repo: CouponRedemptionRepositoryPort | undefined,
  intentId: string,
  couponId?: string
): Promise<void> {
  // No coupon on the intent means no seat was ever claimed — the overwhelming
  // majority of donations, and not worth a query.
  if (!repo || !couponId) return;
  try {
    const redemption = await repo.findByProviderRef(intentId);
    if (redemption) await repo.markReleased(redemption.id);
  } catch (error) {
    logger.warn(
      { err: error, donationIntentId: intentId, couponId },
      'failed to release a donation fee-waiver seat'
    );
  }
}
