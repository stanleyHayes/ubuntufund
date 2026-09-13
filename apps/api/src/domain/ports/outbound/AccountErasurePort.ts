export interface AccountErasurePort {
  /** Persist the request before account closure, then remove safe-to-erase data. */
  request(userId: string): Promise<void>;
  /** Retry pending cleanup after a crash; financial/hold/processor review stays open. */
  sweepPending(): Promise<number>;
}
