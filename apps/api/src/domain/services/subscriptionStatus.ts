import { SubscriptionStatus, SubscriptionTier, type Subscription } from '@ubuntu-fund/types';

/** The statuses under which a subscription's plan can still be in force. */
const IN_FORCE_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
]);

type PeriodFields = Pick<Subscription, 'tier' | 'status' | 'currentPeriodEnd' | 'trialEnd'>;

/**
 * Whether a PAID subscription still grants its plan at `now`: an in-force
 * status, a period that has not ended and, for a trial, a trial that has not
 * ended. Mirrors {@link PlanLimitsService.resolvePlan}, which already falls back
 * to the Free plan once any of these stop holding.
 *
 * Always false for the Free tier: its lazily provisioned 30-day period is never
 * refreshed, so its dates carry no meaning.
 */
export function isPaidPlanInForce(subscription: PeriodFields, now: Date = new Date()): boolean {
  if (subscription.tier === SubscriptionTier.FREE) return false;
  if (!IN_FORCE_STATUSES.has(subscription.status)) return false;
  const end = new Date(subscription.currentPeriodEnd).getTime();
  if (!Number.isFinite(end) || end <= now.getTime()) return false;
  if (subscription.status === SubscriptionStatus.TRIALING && subscription.trialEnd) {
    const trialEnd = new Date(subscription.trialEnd).getTime();
    if (!Number.isFinite(trialEnd) || trialEnd <= now.getTime()) return false;
  }
  return true;
}

/**
 * The status a reader should see. Web (Paystack) plans are one-time purchases
 * with no renewal job, so nothing ever writes EXPIRED onto them: the stored row
 * keeps saying `active` after its period ends. Derive it at read time instead —
 * no write, so a replayed read or a concurrent settlement can never be clobbered.
 *
 * Free rows are returned unchanged (see {@link isPaidPlanInForce}).
 */
export function withEffectiveStatus<T extends PeriodFields>(subscription: T, now: Date = new Date()): T {
  if (subscription.tier === SubscriptionTier.FREE) return subscription;
  if (!IN_FORCE_STATUSES.has(subscription.status)) return subscription;
  if (isPaidPlanInForce(subscription, now)) return subscription;
  return { ...subscription, status: SubscriptionStatus.EXPIRED };
}
