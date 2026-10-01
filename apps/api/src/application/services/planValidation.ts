import type { SubscriptionPlan } from '@ubuntu-fund/types';
import { roundToCurrency, toMinorUnits } from '../../domain/value-objects/Money.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** Plan prices are GHS list prices; checkout charges them in GHS. */
const CURRENCY = 'GHS';

/** The highest monthly or yearly price an admin can set on a plan. */
export const MAX_PLAN_PRICE = 1_000_000;

/**
 * A price checkout charges exactly as shown: at most {@link MAX_PLAN_PRICE} and
 * in whole pesewas. Checkout rounds to two decimals, so 9.995 would be stored
 * and shown as one price and charged as another. The zero floor stays with
 * each use case's own check.
 */
export function assertPlanPrice(field: string, value: number | undefined): void {
  if (typeof value !== 'number') return;
  if (value > MAX_PLAN_PRICE) {
    throw new AppError(`${field} must be ${MAX_PLAN_PRICE.toLocaleString('en-US')} or less`, 422);
  }
  if (roundToCurrency(value, CURRENCY) !== value) {
    throw new AppError(`${field} must have at most two decimal places`, 422);
  }
}

type ConsistencyFields = Pick<SubscriptionPlan, 'priceMonthly' | 'priceYearly'> &
  Partial<Pick<SubscriptionPlan, 'onBehalfCampaigns' | 'maxOnBehalfCampaigns'>>;

/**
 * Rules between fields, checked on the plan as it will be saved (the stored
 * plan with an edit applied, or a new plan), since an edit may send one field:
 *
 * - a yearly price above twelve monthly payments would cost more than paying
 *   monthly. A price of 0 means that cycle is not offered, so it is exempt.
 *   Compared in pesewas: 12 × 4.35 is 52.199999… as a float;
 * - campaigns on behalf of others switched on with 0 allowed lets nobody on the
 *   plan start one. A missing limit reads as 0 (see the plan repository).
 */
export function assertConsistentPlan(plan: ConsistencyFields): void {
  const monthly = toMinorUnits(plan.priceMonthly, CURRENCY);
  const yearly = toMinorUnits(plan.priceYearly, CURRENCY);
  if (monthly > 0 && yearly > 0 && yearly > 12 * monthly) {
    const cap = ((12 * monthly) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const message = `The yearly price is more than 12 times the monthly price (GHS ${cap}). Lower it, or set it to 0 if the plan is not sold yearly.`;
    throw new AppError(message, 422, { priceYearly: [message] });
  }
  if (plan.onBehalfCampaigns === true && (plan.maxOnBehalfCampaigns ?? 0) === 0) {
    const message = 'Switched on, but 0 allowed: nobody on this plan could start one. Set a limit or -1 for unlimited.';
    throw new AppError(message, 422, { maxOnBehalfCampaigns: [message] });
  }
}
