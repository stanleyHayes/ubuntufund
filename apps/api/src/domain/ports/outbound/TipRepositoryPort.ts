import type { TipEntity } from '../../entities/Tip.js';

export interface TipRepositoryPort {
  create(tip: TipEntity): Promise<TipEntity>;
  findByProviderRef(providerRef: string): Promise<TipEntity | null>;
  /** Recent tips a creator received (public feed / dashboard). */
  findByCreator(creatorUserId: string, limit?: number): Promise<TipEntity[]>;
  /** Total count + summed net of SUCCEEDED tips for a creator (public page stat). */
  creatorStats(creatorUserId: string): Promise<{ count: number; totalNet: number }>;

  /**
   * Atomically move a tip PENDING → SUCCEEDED. Returns the tip when THIS caller
   * won the transition (so the balance credit runs at most once), or null when
   * it was already settled (idempotent).
   */
  transitionToSucceeded(providerRef: string): Promise<TipEntity | null>;
  /** Atomically move a tip PENDING → FAILED. Null when not PENDING. */
  transitionToFailed(providerRef: string): Promise<TipEntity | null>;

  /** G7 compare-and-set: flag a SUCCEEDED tip's balance credit as recorded. */
  markSettlementApplied(id: string): Promise<void>;
  /**
   * SUCCEEDED tips whose balance credit never landed (crash between the status
   * transition and the credit), older than `olderThan`. Migration-safe: only
   * rows with `settlementApplied === false` — legacy tips (field absent) were
   * already credited under the old path and are never re-driven.
   */
  findSucceededUnsettled(olderThan: Date, limit?: number): Promise<TipEntity[]>;
}
