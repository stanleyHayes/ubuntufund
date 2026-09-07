import { describe, it, expect } from 'vitest';
import {
  splitIntoTransferLegs,
  requiresBatching,
} from '../../../src/application/services/payoutBatch.js';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('splitIntoTransferLegs (spec §17 / ADR-4)', () => {
  it('returns a single leg when the amount is at or below the ceiling', () => {
    expect(splitIntoTransferLegs(50000, 50000)).toEqual([50000]);
    expect(splitIntoTransferLegs(965, 50000)).toEqual([965]);
    expect(splitIntoTransferLegs(0.5, 50000)).toEqual([0.5]);
  });

  it('fills ceiling-sized legs with a smaller remainder last', () => {
    expect(splitIntoTransferLegs(120000, 50000)).toEqual([50000, 50000, 20000]);
    expect(splitIntoTransferLegs(75000, 50000)).toEqual([50000, 25000]);
  });

  it('never emits a zero-value remainder leg when evenly divisible', () => {
    expect(splitIntoTransferLegs(100000, 50000)).toEqual([50000, 50000]);
    expect(splitIntoTransferLegs(150000, 50000)).toEqual([50000, 50000, 50000]);
  });

  it('splits exactly in pesewas — legs sum to the net with no float drift', () => {
    const legs = splitIntoTransferLegs(120000.99, 50000);
    expect(sum(legs)).toBeCloseTo(120000.99, 2);
    expect(legs.every((l) => l <= 50000)).toBe(true);
    expect(legs[legs.length - 1]).toBeCloseTo(20000.99, 2);
  });

  it('handles a fractional remainder cleanly', () => {
    const legs = splitIntoTransferLegs(50000.5, 50000);
    expect(legs).toEqual([50000, 0.5]);
    expect(sum(legs)).toBeCloseTo(50000.5, 2);
  });

  it('rejects non-positive or non-finite inputs', () => {
    expect(() => splitIntoTransferLegs(0, 50000)).toThrow(/positive/);
    expect(() => splitIntoTransferLegs(-1, 50000)).toThrow(/positive/);
    expect(() => splitIntoTransferLegs(1000, 0)).toThrow(/positive/);
    expect(() => splitIntoTransferLegs(Number.NaN, 50000)).toThrow(/positive/);
    expect(() => splitIntoTransferLegs(1000, Number.POSITIVE_INFINITY)).toThrow(
      /positive/
    );
  });
});

describe('requiresBatching', () => {
  it('is true only above the ceiling', () => {
    expect(requiresBatching(50001, 50000)).toBe(true);
    expect(requiresBatching(50000, 50000)).toBe(false);
    expect(requiresBatching(965, 50000)).toBe(false);
  });
});
