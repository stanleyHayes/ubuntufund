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
  findMaturedHeld(now: Date): Promise<AffiliateCommissionEntity[]>;

  /**
   * Persist a commission's mutated state (status + updatedAt) for its `id`.
   * Returns the updated commission, or null when no record exists. The
   * associated balance movements are guarded atomically on the balance port.
   */
  update(
    commission: AffiliateCommissionEntity
  ): Promise<AffiliateCommissionEntity | null>;
}
