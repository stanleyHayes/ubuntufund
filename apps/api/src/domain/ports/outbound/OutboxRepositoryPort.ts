import type { OutboxEventType, OutboxRecord } from '@ubuntu-fund/types';

export interface EnqueueOutboxInput {
  type: OutboxEventType;
  payload: unknown;
}

export interface OutboxRepositoryPort {
  /** Append a pending outbox row (written alongside the settlement). */
  enqueue(input: EnqueueOutboxInput): Promise<OutboxRecord>;
  /** Oldest-first pending rows awaiting dispatch (used by the boot sweep). */
  findPending(limit: number): Promise<OutboxRecord[]>;
  /** Mark a row dispatched once its side-effects have been applied. */
  markDispatched(id: string): Promise<void>;
  /** Bump the attempt counter after a failed dispatch (for observability). */
  recordAttempt(id: string): Promise<void>;
}
