import mongoose from 'mongoose';
import type { UnitOfWorkPort } from '../../../../domain/ports/outbound/UnitOfWorkPort.js';

/** Enlists existing Mongoose repositories without leaking sessions into domain ports. */
export class MongoUnitOfWork implements UnitOfWorkPort {
  constructor() {
    mongoose.set('transactionAsyncLocalStorage', true);
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    // No non-transactional fallback: balances, entitlements and settlement gates
    // must commit together. This requires Atlas, a replica set or mongos.
    return mongoose.connection.transaction(work, {
      readPreference: 'primary',
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });
  }
}
