import { describe, it, expect } from 'vitest';
import { distributeByShares } from '../../../src/application/services/splitDistribution.js';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('distributeByShares — largest-remainder split (ADR-3)', () => {
  it('splits evenly when it divides cleanly', () => {
    expect(distributeByShares(10000, [5000, 5000])).toEqual([5000, 5000]);
    expect(distributeByShares(9000, [3333, 3333, 3334])).toEqual([
      3000, 3000, 3000,
    ]);
  });

  it('assigns leftover pesewas to the largest remainders, deterministically', () => {
    // 100 pesewas / 3 equal shares → 33,33,33 + 1 leftover → first (tie) gets it.
    expect(distributeByShares(100, [1, 1, 1])).toEqual([34, 33, 33]);
    // 10 pesewas over 60/40 → 6 and 4 exactly.
    expect(distributeByShares(10, [6000, 4000])).toEqual([6, 4]);
  });

  it('always sums to the exact total — never creates or loses a pesewa', () => {
    const cases: Array<[number, number[]]> = [
      [1, [5000, 5000]],
      [7, [3333, 3333, 3334]],
      [99991, [2500, 2500, 2500, 2500]],
      [123457, [1000, 2000, 3000, 4000]],
      [1, [9999, 1]],
      [1000003, [1, 1, 1, 1, 1, 1, 1]],
    ];
    for (const [total, shares] of cases) {
      const parts = distributeByShares(total, shares);
      expect(sum(parts)).toBe(total);
      expect(parts.every((p) => Number.isInteger(p) && p >= 0)).toBe(true);
    }
  });

  it('handles a zero total and zero-weighted shares', () => {
    expect(distributeByShares(0, [5000, 5000])).toEqual([0, 0]);
    // A zero share never receives a leftover unit.
    expect(distributeByShares(5, [0, 10000])).toEqual([0, 5]);
  });

  it('is deterministic — identical inputs give identical output', () => {
    const a = distributeByShares(100003, [3000, 3000, 4000]);
    const b = distributeByShares(100003, [3000, 3000, 4000]);
    expect(a).toEqual(b);
  });

  it('rejects invalid inputs', () => {
    expect(() => distributeByShares(10.5, [1, 1])).toThrow(/integer/);
    expect(() => distributeByShares(-1, [1, 1])).toThrow(/non-negative integer/);
    expect(() => distributeByShares(10, [])).toThrow(/at least one/);
    expect(() => distributeByShares(10, [1, -1])).toThrow(/non-negative/);
    expect(() => distributeByShares(10, [0, 0])).toThrow(/positive/);
  });
});
