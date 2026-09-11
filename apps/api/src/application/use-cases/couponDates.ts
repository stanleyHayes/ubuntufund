import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** A bare calendar day with no time component, as the admin date picker sends. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Coerce a coupon validity bound from the wire.
 *
 * The admin console sends a date-only string, because its inputs are
 * `<input type="date">` and `toDateInput` slices the ISO value at ten
 * characters. `new Date('2026-09-30')` is midnight, so an admin who set a
 * coupon to expire on the 30th watched it stop working at the *start* of the
 * 30th — a whole day early, silently, and only visible as customer complaints.
 *
 * So the two bounds are not symmetric: a date-only `validFrom` means "from the
 * beginning of that day" and a date-only `validUntil` means "through the end of
 * that day". A value that carries an explicit time is taken exactly as given,
 * so nothing here prevents scheduling a coupon to the minute.
 *
 * Times are UTC instants compared against the server clock. Ghana is UTC+0
 * year-round, so for the market this serves a UTC day boundary and a local one
 * are the same moment; a second market in another zone would need a stored
 * timezone rather than this assumption.
 */
export function toCouponDate(
  value: string | undefined,
  field: string,
  bound: 'start' | 'end'
): Date | undefined {
  if (!value) return undefined;

  const trimmed = value.trim();
  const date = new Date(DATE_ONLY.test(trimmed) ? `${trimmed}T00:00:00.000Z` : trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid ${field} date`, 400);
  }

  if (bound === 'end' && DATE_ONLY.test(trimmed)) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
}
