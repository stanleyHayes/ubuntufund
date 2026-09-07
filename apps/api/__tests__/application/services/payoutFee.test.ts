import { describe, it, expect } from 'vitest';
import {
  computePayoutFee,
  isEarlyWithdrawal,
} from '../../../src/application/services/payoutFee.js';

// v6 §17 default fee policy.
const cfg = {
  priorityFeePercent: 0.5,
  priorityMinFee: 10,
  earlyFeePercent: 1.0,
  earlyMinFee: 20,
  urgentFeePercent: 1.5,
  urgentMinFee: 30,
  assistedFeePercent: 1.5,
  assistedFixedFee: 50,
  earlyMaxWithdrawalPercent: 80,
  maxTransferAmount: 50000,
};

describe('computePayoutFee (spec §17)', () => {
  it('standard payout is free', () => {
    expect(computePayoutFee('standard', 1000, cfg)).toEqual({ fee: 0, netAmount: 1000 });
  });

  it('priority is 0.5% with a GHS 10 minimum', () => {
    expect(computePayoutFee('priority', 1000, cfg)).toEqual({ fee: 10, netAmount: 990 }); // 5 → min 10
    expect(computePayoutFee('priority', 10000, cfg)).toEqual({ fee: 50, netAmount: 9950 });
  });

  it('early is 1.0% (min 20) and urgent is 1.5% (min 30)', () => {
    expect(computePayoutFee('early', 10000, cfg)).toEqual({ fee: 100, netAmount: 9900 });
    expect(computePayoutFee('early', 1000, cfg)).toEqual({ fee: 20, netAmount: 980 }); // 10 → min 20
    expect(computePayoutFee('urgent', 10000, cfg)).toEqual({ fee: 150, netAmount: 9850 });
  });

  it('assisted is 1.5% plus a GHS 50 fixed charge', () => {
    expect(computePayoutFee('assisted', 10000, cfg)).toEqual({ fee: 200, netAmount: 9800 });
  });

  it('never lets the fee exceed the amount (net ≥ 0)', () => {
    const { fee, netAmount } = computePayoutFee('assisted', 40, cfg); // 0.6 + 50 = 50.6 > 40
    expect(fee).toBe(40);
    expect(netAmount).toBe(0);
  });
});

describe('isEarlyWithdrawal', () => {
  it('flags early/urgent, not standard/priority/assisted', () => {
    expect(isEarlyWithdrawal('early')).toBe(true);
    expect(isEarlyWithdrawal('urgent')).toBe(true);
    expect(isEarlyWithdrawal('standard')).toBe(false);
    expect(isEarlyWithdrawal('priority')).toBe(false);
    expect(isEarlyWithdrawal('assisted')).toBe(false);
  });
});
