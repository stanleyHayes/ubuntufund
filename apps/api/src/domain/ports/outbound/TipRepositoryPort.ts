import type { TipEntity } from '../../entities/Tip.js';

export interface TipRepositoryPort {
  saveCheckout(providerRef: string, checkout: { checkoutUrl: string; accessCode: string }): Promise<boolean>;
  create(tip: TipEntity): Promise<TipEntity>;
  findByProviderRef(providerRef: string): Promise<TipEntity | null>;
  /** Recent tips a creator received (public feed / dashboard). */
  findByCreator(creatorUserId: string, limit?: number): Promise<TipEntity[]>;
  /** Total count + summed net of SUCCEEDED tips for a creator (public page stat). */
  creatorStats(creatorUserId: string): Promise<{ count: number; totalNet: number }>;

  /**
   * Atomically move a tip PENDING → SUCCEEDED. Returns the tip when THIS caller
   * won the transition (so the balance credit runs at most once), or null when
   * it was already settled (idempotent). `allowFromFailed` also admits FAILED —
   * only for a late success the caller has verified with the provider.
   */
  transitionToSucceeded(
    providerRef: string,
    opts?: { allowFromFailed?: boolean }
  ): Promise<TipEntity | null>;
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

  /**
   * PENDING tips last touched before `olderThan`, least-recently reconciled
   * first, so a backlog of unresolvable checkouts can never starve newer ones.
   * The reconciler re-verifies these with the provider to repair a lost webhook.
   */
  findStalePending(olderThan: Date, limit: number): Promise<TipEntity[]>;
  /** Stamp a sweep's visit on a still-PENDING tip (rotates it to the back). */
  recordReconciliationAttempt(id: string, attemptedAt: Date): Promise<void>;
}
