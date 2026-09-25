import type { AffiliateCommissionStatus } from '@ubuntu-fund/types';
import type { AffiliateCommissionEntity } from '../../entities/AffiliateCommission.js';

export interface AffiliateCommissionRepositoryPort {
  /**
   * Persist a new commission only if none already exists for its `sourceRef`
   * (the subscription charge providerRef — a unique index makes this the webhook
   * idempotency seam). Returns the created commission, or null when one was
   * already recorded for that sourceRef (a duplicate/replayed settlement).
   */
  createIfAbsent(
    commission: AffiliateCommissionEntity
  ): Promise<AffiliateCommissionEntity | null>;

  findByAffiliateId(affiliateId: string): Promise<AffiliateCommissionEntity[]>;
  /** Correlate a settlement/refund back to its commission by the charge ref. */
  findBySourceRef(sourceRef: string): Promise<AffiliateCommissionEntity | null>;

  /**
   * Held commissions whose hold window has elapsed (status='held' &&
   * maturesAt <= now) — the maturity sweep's work list, ready to move to
   * 'available'.
   */
  findMaturedHeld(now: Date, affiliateId?: string): Promise<AffiliateCommissionEntity[]>;

  /**
   * Stamp `payoutId` on the affiliate's unlinked AVAILABLE commissions, oldest
   * first, while their running total stays within `maxAmount`. Returns the
   * linked total. The payout's webhook later marks exactly these paid.
   */
  linkAvailableToPayout?(affiliateId: string, payoutId: string, maxAmount: number): Promise<number>;
  /** The payout was paid: its linked available commissions become `paid`. */
  markPaidForPayout?(payoutId: string): Promise<void>;
  /**
   * The payout failed, was rejected or reversed: its linked commissions return
   * to unlinked `available` (a paid-then-reversed transfer's too).
   */
  releaseFromPayout?(payoutId: string): Promise<void>;

  /**
   * Persist a commission's mutated state (status + updatedAt) for its `id`.
   * Returns the updated commission, or null when no record exists. The
   * associated balance movements are guarded atomically on the balance port.
   */
  update(
    commission: AffiliateCommissionEntity
  ): Promise<AffiliateCommissionEntity | null>;

  /**
   * Atomically move a commission from `from` to `to`, only while it is still in
   * `from`. Returns the updated commission, or null when it is no longer in
   * `from` (another writer won the race). This is the exactly-once seam for a
   * reversal: only the caller that flips the status may unwind the balance, so a
   * replayed refund/chargeback can never double-decrement.
   */
  transitionStatus(
    id: string,
    from: AffiliateCommissionStatus,
    to: AffiliateCommissionStatus
  ): Promise<AffiliateCommissionEntity | null>;
}
