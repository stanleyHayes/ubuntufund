import { describe, it, expect } from 'vitest';
import { FeePolicy } from '../../../src/application/services/FeePolicy.js';

// Representative config: 5% platform cut, Paystack 1.95% + 1.00 flat.
const cfg = { platformFeePercent: 5, paystackFeePercent: 1.95, paystackFlatFee: 1 };

describe('FeePolicy — currency-aware rounding (spec §8)', () => {
  it('GHS (2dp): the split reconciles to the amount exactly (unchanged behaviour)', () => {
    const policy = new FeePolicy(cfg);
    const b = policy.computeSettlementFromProvider({
      gross: 220,
      tip: 20,
      processorFee: 3.3,
      currency: 'GHS',
    });
    expect(b.amount).toBe(200);
    expect(b.platformFee).toBe(10); // 5% of 200
    expect(b.processorFee).toBe(3.3);
    expect(b.beneficiaryNet).toBe(186.7);
    expect(b.beneficiaryNet + b.platformFee + b.processorFee).toBeCloseTo(b.amount, 10);
  });

  it('XOF (0dp): every leg is a whole unit and the split still sums exactly', () => {
    const policy = new FeePolicy(cfg);
    const b = policy.computeSettlementFromProvider({
      gross: 10000,
      tip: 0,
      processorFee: 195,
      currency: 'XOF',
    });
    expect(b.amount).toBe(10000);
    for (const leg of [b.amount, b.beneficiaryNet, b.platformFee, b.processorFee]) {
      // Exponent 0 → no sub-unit fractions; a hardcoded 2dp would leave dust.
      expect(Number.isInteger(leg)).toBe(true);
    }
    // Ledger integrity: net + platform + processor === amount, to the unit.
    expect(b.beneficiaryNet + b.platformFee + b.processorFee).toBe(b.amount);
  });

  it('KWD (3dp): keeps three-decimal precision and reconciles', () => {
    const policy = new FeePolicy(cfg);
    const b = policy.computeSettlementFromProvider({
      gross: 100,
      tip: 0,
      processorFee: 2.5,
      currency: 'KWD',
    });
    expect(b.platformFee).toBe(5); // 5% of 100.000
    expect(b.beneficiaryNet).toBe(92.5); // 100 - 5 - 2.5
    expect(b.beneficiaryNet + b.platformFee + b.processorFee).toBeCloseTo(b.amount, 10);
  });

  it('computeBreakdown honours the currency exponent for the wallet rail too', () => {
    const policy = new FeePolicy(cfg);
    const b = policy.computeBreakdown(10000, 0, 'XOF', 'wallet');
    expect(b.processorFee).toBe(0); // wallet has no processor fee
    expect(Number.isInteger(b.platformFee)).toBe(true);
    expect(b.beneficiaryNet + b.platformFee + b.processorFee).toBe(b.amount);
  });
});
