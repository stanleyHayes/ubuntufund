import type { PayoutEntity } from '../../entities/Payout.js'
import type { PayoutLeg, PayoutLegStatus, PayoutStatus } from '@ubuntu-fund/types'

export interface PayoutRepositoryPort {
  findByRequestKey?(key: string): Promise<PayoutEntity | null>
  setProviderStatus?(id: string, status: string): Promise<void>

  /**
   * Try to take the provider-verification lease for `id`. Atomic across API
   * instances: N concurrent callers produce exactly ONE provider call per
   * window. Returns whether this caller won, and when the next check is due.
   */
  tryLeaseProviderCheck(id: string, ttlMs: number): Promise<{ acquired: boolean; nextCheckAt: Date }>

  /** Push the lease out (provider error / mismatch) so we stop hot-looping. */
  extendProviderCheckLease(id: string, ttlMs: number): Promise<void>
  create(payout: PayoutEntity): Promise<PayoutEntity>
  findById(id: string): Promise<PayoutEntity | null>
  findByCampaignId(campaignId: string): Promise<PayoutEntity[]>
  /** Correlate a provider transfer webhook back to its (single-transfer) payout. */
  findByProviderRef(providerRef: string): Promise<PayoutEntity | null>
  /** Correlate a transfer webhook to the batched payout owning a leg reference. */
  findByLegReference(reference: string): Promise<PayoutEntity | null>
  /** All payouts, newest first (admin console). */
  findAll(): Promise<PayoutEntity[]>

  /** Payouts in any of the given statuses, newest first (admin review queue). */
  findByStatuses(statuses: PayoutStatus[]): Promise<PayoutEntity[]>

  /**
   * Single-transfer payouts stuck in PROCESSING since before `olderThan` (a
   * provider webhook was missed/delayed). Batched payouts are excluded — their
   * per-leg reconciliation is a separate concern.
   */
  findStuckProcessing(olderThan: Date): Promise<PayoutEntity[]>

  /**
   * Batched (multi-leg) payouts stuck in PROCESSING since before `olderThan`;
   * their legs are reconciled individually by leg reference.
   */
  findStuckBatchedProcessing(olderThan: Date): Promise<PayoutEntity[]>

  /**
   * Flag a payout's terminal balance/ledger effect as applied (G5, idempotent).
   * When `expectedStatus` is given the flag is set only if the payout is STILL in
   * that status (compare-and-set) — so a repair cannot flag a payout that has
   * since transitioned and now owes a different effect (G7).
   */
  markSettlementApplied(id: string, expectedStatus?: PayoutStatus): Promise<void>

  /**
   * Single-transfer payouts that reached a repairable terminal state (PAID or
   * FAILED) whose settlement effect has NOT been recorded as applied (a crash
   * between the state transition and the balance write) and that are older than
   * `olderThan` — the reconciliation-repair candidates.
   *
   * Matched by `settlementApplied: false` (not `$ne: true`): only G5-era payouts
   * carry the field, so payouts that predate it — already settled by the old
   * code — are never mis-detected as unsettled and re-applied. REVERSED is
   * excluded: an unsettled REVERSED payout cannot be told apart from a
   * PAID-then-reversed crash, so its repair needs per-effect tracking (deferred).
   */
  findTerminalUnsettled(olderThan: Date): Promise<PayoutEntity[]>

  /**
   * Maker-checker (spec §16): atomically record the FIRST admin approval of a
   * high-value payout — set `firstApprovedBy`/`firstApprovedAt` while it is still
   * PENDING and not yet first-approved. Returns the updated payout, or null when
   * it was already first-approved or no longer PENDING.
   */
  recordFirstApproval(id: string, makerId: string): Promise<PayoutEntity | null>

  /**
   * Atomically move PENDING → PROCESSING, stamping the approver, our unique
   * transfer reference, and (optionally) the provider transfer code. Returns the
   * updated payout, or null when it was no longer PENDING (another approval won).
   */
  transitionToProcessing(
    id: string,
    fields: { approvedBy: string; providerRef: string; transferCode?: string },
  ): Promise<PayoutEntity | null>

  /**
   * Atomically move PENDING → PROCESSING for a BATCHED payout, stamping the
   * approver, the batch reference, and the transfer legs (all `queued`). Returns
   * the updated payout, or null when it was no longer PENDING.
   */
  transitionToProcessingBatched(
    id: string,
    fields: { approvedBy: string; providerRef: string; legs: PayoutLeg[] },
  ): Promise<PayoutEntity | null>

  /**
   * Atomically move one leg (matched by `reference`) from any of `from` to `to`,
   * optionally stamping its transfer code. Returns the updated payout when this
   * caller won the leg transition, or null (leg absent, or not in a `from` state
   * — the guard that makes per-leg settlement exactly-once/idempotent).
   */
  setLegStatus(
    id: string,
    reference: string,
    from: PayoutLegStatus[],
    to: PayoutLegStatus,
    extra?: { transferCode?: string },
  ): Promise<PayoutEntity | null>

  /**
   * Atomically move a batched payout PROCESSING → PAID, but ONLY when every leg
   * is `success`. Null when not PROCESSING or a leg has not succeeded.
   */
  transitionBatchedToPaid(id: string): Promise<PayoutEntity | null>

  /**
   * Atomically flag a batched payout for manual reconciliation: move
   * PROCESSING or PAID → NEEDS_REVIEW. Null when in neither state (idempotent).
   */
  flagNeedsReview(id: string): Promise<PayoutEntity | null>

  /** Attach the provider transfer code once the transfer is initiated. */
  attachTransferCode(id: string, transferCode: string): Promise<PayoutEntity | null>

  /** Atomically move PROCESSING → PAID. Null when not PROCESSING (idempotent). */
  transitionToPaid(id: string): Promise<PayoutEntity | null>

  /** Atomically move PROCESSING → FAILED. Null when not PROCESSING. */
  transitionToFailed(id: string): Promise<PayoutEntity | null>

  /** Atomically move PAID → REVERSED. Null when not PAID. */
  transitionPaidToReversed(id: string): Promise<PayoutEntity | null>

  /** Atomically move PROCESSING → REVERSED. Null when not PROCESSING. */
  transitionProcessingToReversed(id: string): Promise<PayoutEntity | null>
}
