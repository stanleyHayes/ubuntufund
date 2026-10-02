import { AsyncLocalStorage } from 'node:async_hooks';
import mongoose from 'mongoose';
import type { UnitOfWorkPort } from '../../../../domain/ports/outbound/UnitOfWorkPort.js';

/** What Mongoose keeps in its transaction AsyncLocalStorage while a callback runs: a new object for every run. */
type TransactionStore = { session?: { inTransaction(): boolean } };

/**
 * One run of a MongoUnitOfWork transaction's callback. The driver runs the
 * callback again after a transient error, and only the last run commits.
 * Opaque: compare by identity.
 */
export type TransactionAttempt = object;

/**
 * Which MongoUnitOfWork transactions commit while some work runs
 * (withTransactionLog), for a caller that must know that a write and its own
 * record committed together (publishing on approval).
 */
export interface TransactionLog {
  /** The attempts that committed, in order, nested ones included. */
  readonly committed: TransactionAttempt[];
  /**
   * When set, a transaction started while another one is active is refused
   * with this error before it writes anything. Mongoose always opens a new
   * session for it, so it would commit on its own, even if the outer one were
   * rolled back afterwards.
   */
  readonly refuseNested?: () => Error;
}

const logs = new AsyncLocalStorage<TransactionLog>();
/** The callback runs MongoUnitOfWork started (other transactions are not tracked). */
const attempts = new WeakSet<object>();

function activeTransaction(): TransactionStore | undefined {
  const storage = (mongoose as unknown as { transactionAsyncLocalStorage?: AsyncLocalStorage<TransactionStore> }).transactionAsyncLocalStorage;
  const store = storage?.getStore();
  return store?.session?.inTransaction() === true ? store : undefined;
}

/** The MongoUnitOfWork transaction attempt the caller runs in, if any. */
export function currentTransactionAttempt(): TransactionAttempt | undefined {
  const store = activeTransaction();
  return store && attempts.has(store) ? store : undefined;
}

/** The log the caller runs under (withTransactionLog), if any. */
export const currentTransactionLog = (): TransactionLog | undefined => logs.getStore();

/** Runs `work`, recording in `log` every MongoUnitOfWork transaction that commits meanwhile. */
export function withTransactionLog<T>(log: TransactionLog, work: () => Promise<T>): Promise<T> {
  return logs.run(log, work);
}

/** Enlists existing Mongoose repositories without leaking sessions into domain ports. */
export class MongoUnitOfWork implements UnitOfWorkPort {
  constructor() {
    mongoose.set('transactionAsyncLocalStorage', true);
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    const log = logs.getStore();
    if (log?.refuseNested && activeTransaction()) throw log.refuseNested();
    let attempt: TransactionAttempt | undefined;
    // No non-transactional fallback: balances, entitlements and settlement gates
    // must commit together. This requires Atlas, a replica set or mongos.
    const result = await mongoose.connection.transaction(async () => {
      attempt = activeTransaction();
      if (attempt) attempts.add(attempt);
      return work();
    }, {
      readPreference: 'primary',
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });
    // Resolved, so the last run committed.
    if (log && attempt) log.committed.push(attempt);
    return result;
  }
}
