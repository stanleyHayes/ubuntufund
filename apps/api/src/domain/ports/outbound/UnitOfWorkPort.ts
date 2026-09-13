/** All work must be database-only, sequential and safe for transaction retries. */
export interface UnitOfWorkPort {
  run<T>(work: () => Promise<T>): Promise<T>;
}
