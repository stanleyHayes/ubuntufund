import { describe, expect, it } from 'vitest';
import { toCouponDate } from '../../../src/application/use-cases/couponDates.js';

/**
 * The admin console's date inputs send a bare `YYYY-MM-DD`, which parses as
 * midnight. A coupon set to expire on the 30th therefore stopped working at the
 * *start* of the 30th — a full day early, with nothing in the logs to say so.
 */
describe('toCouponDate', () => {
  it('runs a date-only validUntil through to the end of that day', () => {
    const end = toCouponDate('2026-09-30', 'validUntil', 'end')!;
    expect(end.toISOString()).toBe('2026-09-30T23:59:59.999Z');

    // The whole point: a redemption during the final day is still inside.
    expect(new Date('2026-09-30T18:00:00Z') <= end).toBe(true);
  });

  it('starts a date-only validFrom at the beginning of that day', () => {
    const start = toCouponDate('2026-09-01', 'validFrom', 'start')!;
    expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('leaves an explicit time exactly as given, for either bound', () => {
    // Scheduling to the minute must still be possible.
    expect(toCouponDate('2026-09-30T09:30:00.000Z', 'validUntil', 'end')!.toISOString())
      .toBe('2026-09-30T09:30:00.000Z');
    expect(toCouponDate('2026-09-30T09:30:00.000Z', 'validFrom', 'start')!.toISOString())
      .toBe('2026-09-30T09:30:00.000Z');
  });

  it('passes an absent value straight through', () => {
    expect(toCouponDate(undefined, 'validUntil', 'end')).toBeUndefined();
    expect(toCouponDate('', 'validFrom', 'start')).toBeUndefined();
  });

  it('rejects an unparseable date rather than storing Invalid Date', () => {
    // A NaN date silently disables every window check that reads it.
    expect(() => toCouponDate('not-a-date', 'validUntil', 'end')).toThrow(/Invalid validUntil/i);
    expect(() => toCouponDate('2026-13-45', 'validFrom', 'start')).toThrow(/Invalid validFrom/i);
  });
});
