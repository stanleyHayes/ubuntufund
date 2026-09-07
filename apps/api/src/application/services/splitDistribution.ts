/**
 * Split-proceeds distribution (spec §17 split / ADR-3).
 *
 * When a campaign's cleared net is shared among several beneficiaries by
 * percentage, the split must reconcile to the last pesewa: the parts always sum
 * to exactly the distributable total, with no cedi created or lost to rounding.
 * We use the **largest-remainder method** in minor units (pesewas) — the same
 * deterministic apportionment used for seat allocation — so a fixed input always
 * yields the same output and the parts are exact integers.
 */

/**
 * Apportion `totalMinor` (an integer amount in minor units) across weights
 * `sharesBps` (basis points; for a split they sum to 10000, but any positive
 * weights work). Returns one integer part per share, summing **exactly** to
 * `totalMinor`.
 *
 * Each part gets the floor of its exact proportional share; the leftover units
 * (at most `shares.length − 1`) go one each to the shares with the largest
 * fractional remainders, ties broken by lowest index — fully deterministic.
 *
 * @throws if `totalMinor` is not a non-negative integer, `sharesBps` is empty,
 *   any share is negative, or the shares sum to zero.
 */
export function distributeByShares(
  totalMinor: number,
  sharesBps: number[]
): number[] {
  if (!Number.isInteger(totalMinor) || totalMinor < 0) {
    throw new Error('totalMinor must be a non-negative integer (minor units)');
  }
  if (sharesBps.length === 0) {
    throw new Error('at least one share is required');
  }
  if (sharesBps.some((s) => !Number.isFinite(s) || s < 0)) {
    throw new Error('shares must be non-negative');
  }
  const sumShares = sharesBps.reduce((a, b) => a + b, 0);
  if (sumShares <= 0) {
    throw new Error('shares must sum to a positive value');
  }

  // Exact floor part + fractional remainder for each share, kept as integers
  // (remainder numerator over the common denominator sumShares) to avoid floats.
  const parts = sharesBps.map((share, index) => {
    const numerator = totalMinor * share;
    const floor = Math.floor(numerator / sumShares);
    const remainder = numerator - floor * sumShares; // 0 ≤ remainder < sumShares
    return { index, floor, remainder };
  });

  const allocated = parts.reduce((sum, p) => sum + p.floor, 0);
  let leftover = totalMinor - allocated; // integer in [0, shares.length)

  // Hand the leftover units to the largest remainders first (index breaks ties).
  const byRemainder = [...parts].sort(
    (a, b) => b.remainder - a.remainder || a.index - b.index
  );
  const result = parts.map((p) => p.floor);
  for (const p of byRemainder) {
    if (leftover <= 0) break;
    result[p.index] += 1;
    leftover -= 1;
  }

  return result;
}
