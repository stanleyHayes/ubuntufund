import type { PayoutType } from '@ubuntu-fund/types';
import type { PayoutsConfig } from '../../infrastructure/config/index.js';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface PayoutFeeResult {
  fee: number;
  netAmount: number;
}

/**
 * Compute the Ujimora payout service fee and the net the beneficiary receives
 * for a payout type + gross amount (spec §17). `standard` is free; percentage
 * services honour their minimum fee; `assisted` adds a fixed service charge. The
 * fee never exceeds the amount, so the net is never negative.
 */
export function computePayoutFee(
  type: PayoutType,
  amount: number,
  cfg: PayoutsConfig
): PayoutFeeResult {
  let fee = 0;
  switch (type) {
    case 'priority':
      fee = Math.max(round2((amount * cfg.priorityFeePercent) / 100), cfg.priorityMinFee);
      break;
    case 'early':
      fee = Math.max(round2((amount * cfg.earlyFeePercent) / 100), cfg.earlyMinFee);
      break;
    case 'urgent':
      fee = Math.max(round2((amount * cfg.urgentFeePercent) / 100), cfg.urgentMinFee, round2((amount * cfg.earlyFeePercent) / 100), cfg.earlyMinFee);
      break;
    case 'assisted':
      fee = round2((amount * cfg.assistedFeePercent) / 100 + cfg.assistedFixedFee);
      break;
    case 'standard':
    default:
      fee = 0;
  }
  fee = round2(Math.min(fee, amount));
  return { fee, netAmount: round2(amount - fee) };
}

/** Early-withdrawal payout types are subject to the reserve ceiling (spec §17). */
export function isEarlyWithdrawal(type: PayoutType): boolean {
  return type === 'early' || type === 'urgent';
}

/** A campaign is early until its end date or funding goal is reached. */
export function campaignNeedsEarlyCashout(campaign: { endDate: Date; raisedAmount: { amount: number }; goalAmount: { amount: number } }): boolean {
  return new Date(campaign.endDate).getTime() > Date.now() && campaign.raisedAmount.amount < campaign.goalAmount.amount;
}
