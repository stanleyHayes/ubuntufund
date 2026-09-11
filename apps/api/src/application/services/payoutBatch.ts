/**
 * Payout batching (spec §17 / ADR-4).
 *
 * A payout whose net amount exceeds the provider's single-transfer ceiling
 * (`PAYOUT_MAX_TRANSFER_AMOUNT`, default GHS 50k) cannot be sent as one
 * transfer. It is split into several legs, each ≤ the ceiling, that together sum
 * back to the exact net — no cedi created or lost.
 */

/**
 * Split `netAmount` into transfer legs of at most `maxTransferAmount` each.
 *
 * The legs always sum **exactly** to `netAmount`: the arithmetic is done in
 * minor units (pesewas) so there is no floating-point drift, then converted
 * back to major units. Legs are filled to the ceiling with a single smaller
 * remainder leg last; there is never a zero-value leg. A `netAmount` at or
 * below the ceiling yields a single leg equal to the whole amount.
 *
 * A remainder below {@link MIN_LEG_MINOR} is topped up out of the preceding
 * full leg rather than sent as-is: providers reject sub-minimum transfers, and
 * because legs are submitted in order, that rejection lands only AFTER the
 * earlier legs have moved real money — leaving the batch in NEEDS_REVIEW over
 * what can be as little as one pesewa.
 *
 * @throws if either argument is not a positive, finite number.
 */
/**
 * Smallest leg worth submitting, in minor units (GHS 1.00). Providers reject
 * transfers below roughly this, so a leg under it is a guaranteed failure.
 */
const MIN_LEG_MINOR = 100;

export function splitIntoTransferLegs(
  netAmount: number,
  maxTransferAmount: number
): number[] {
  if (!Number.isFinite(netAmount) || netAmount <= 0) {
    throw new Error('netAmount must be a positive number');
  }
  if (!Number.isFinite(maxTransferAmount) || maxTransferAmount <= 0) {
    throw new Error('maxTransferAmount must be a positive number');
  }

  const net = Math.round(netAmount * 100);
  const max = Math.round(maxTransferAmount * 100);

  const fullLegs = Math.floor(net / max);
  const remainder = net - fullLegs * max;

  const legs: number[] = Array.from({ length: fullLegs }, () => max);
  if (remainder > 0) {
    if (remainder < MIN_LEG_MINOR && fullLegs > 0) {
      // Borrow the shortfall from the last full leg. It has room: it sits at the
      // ceiling, and MIN_LEG_MINOR is far below it, so both legs stay within
      // [MIN_LEG_MINOR, max] and the total is unchanged.
      const shortfall = MIN_LEG_MINOR - remainder;
      legs[legs.length - 1] -= shortfall;
      legs.push(MIN_LEG_MINOR);
    } else {
      legs.push(remainder);
    }
  }

  // net > 0 guarantees at least one leg (a net ≤ max yields [net]).
  return legs.map((m) => m / 100);
}

/** True when a payout's net must be split across more than one transfer. */
export function requiresBatching(
  netAmount: number,
  maxTransferAmount: number
): boolean {
  return netAmount > maxTransferAmount;
}
