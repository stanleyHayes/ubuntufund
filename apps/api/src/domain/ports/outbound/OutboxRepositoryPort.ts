import type { OutboxEventType, OutboxRecord } from '@ubuntu-fund/types';

export interface EnqueueOutboxInput {
  type: OutboxEventType;
  payload: unknown;
}

/** A pending row leased to one dispatcher; `leaseToken` settles it. */
export interface ClaimedOutboxRecord {
  record: OutboxRecord;
  leaseToken: string;
}

export interface OutboxRepositoryPort {
  /** Append a pending outbox row (written alongside the settlement). */
  enqueue(input: EnqueueOutboxInput): Promise<OutboxRecord>;
  /**
   * Atomically lease the pending row `id` for `leaseMs`. Returns the lease
   * token, or null when the row is already dispatched or another dispatcher
   * holds an unexpired lease on it. An expired lease (a crashed or stalled
   * dispatcher) can be taken over.
   */
  claim(id: string, leaseMs: number): Promise<string | null>;
  /**
   * Atomically lease the oldest pending row created at or before
   * `createdBefore` whose lease is free (used by the catch-up sweep).
   */
  claimNextPending(createdBefore: Date, leaseMs: number): Promise<ClaimedOutboxRecord | null>;
  /** Mark a leased row dispatched once its side-effects have been applied. */
  markDispatched(id: string, leaseToken: string): Promise<void>;
  /** Bump the attempt counter after a failed dispatch (for observability). */
  recordAttempt(id: string): Promise<void>;
}
