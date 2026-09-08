import type { AffiliateBalance } from '@ubuntu-fund/types';

export interface AffiliateBalanceRepositoryPort {
  findByAffiliateId(affiliateId: string): Promise<AffiliateBalance | null>;

  /**
   * Upsert the affiliate's balance read model, returning it (creating a
   * zeroed record on first activity). Callers use the returned `id` for the
   * atomic bucket movements below.
   */
  ensure(affiliateId: string, currency: string): Promise<AffiliateBalance>;

  /**
   * Accrue a newly-held commission: `totalEarned += amount` and
   * `pendingBalance += amount` (held funds counted as pending until they
   * mature). Atomic $inc. Returns the updated balance.
   */
  accrueCommission(id: string, amount: number): Promise<AffiliateBalance>;

  // ── Maturity & payout lifecycle (held → available → in-transit → paidOut) ──

  /**
   * A held commission matured: clear it from `pendingBalance` to
   * `availableBalance` (making it withdrawable). Atomic and guarded: only fires
   * while `pendingBalance >= amount`. Returns the updated balance, or null when
   * there isn't enough pending to clear.
   */
  clearPendingToAvailable(
    id: string,
    amount: number
  ): Promise<AffiliateBalance | null>;

  /**
   * Reserve funds for an approved affiliate payout: `availableBalance -= amount`
   * (now in transit). Atomic and guarded on `availableBalance >= amount`.
   * Returns the updated balance, or null when available is short.
   */
  reserveForPayout(id: string, amount: number): Promise<AffiliateBalance | null>;

  /**
   * Return reserved in-transit funds to `availableBalance` after a failed
   * transfer (no paid-out amount was ever recorded). When `settleRef` is given
   * the move is applied at most once per key (G5 idempotency), so a
   * reconciliation re-drive is a no-op.
   */
  returnToAvailable(
    id: string,
    amount: number,
    settleRef?: string
  ): Promise<AffiliateBalance | null>;

  /**
   * Confirm a paid-out transfer: `paidOutBalance += amount` (the reserved
   * in-transit funds have left the platform). When `settleRef` is given the move
   * is applied at most once per key. Returns the updated balance.
   */
  markPaidOut(
    id: string,
    amount: number,
    settleRef?: string
  ): Promise<AffiliateBalance | null>;

  /**
   * Reverse a PAID payout (a settled transfer was reversed): move the funds out
   * of paid-out and back to available — `paidOutBalance -= amount` and
   * `availableBalance += amount`. When `settleRef` is given the move is applied
   * at most once per key. Atomic $inc. Returns the updated balance.
   */
  reverseFromPaidOut(
    id: string,
    amount: number,
    settleRef?: string
  ): Promise<AffiliateBalance | null>;

  /**
   * Reverse a still-held commission (referred subscription refunded before it
   * matured): `pendingBalance -= amount` and `totalEarned -= amount`. Atomic
   * $inc. Returns the updated balance.
   */
  reverseHeld(id: string, amount: number): Promise<AffiliateBalance | null>;

  /**
   * Reverse an already-available (matured, not-yet-paid) commission after a
   * refund: `availableBalance -= amount` and `totalEarned -= amount`. Atomic
   * $inc. Returns the updated balance.
   */
  reverseAvailable(id: string, amount: number): Promise<AffiliateBalance | null>;
}
