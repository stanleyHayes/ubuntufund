import 'dotenv/config';
import mongoose from 'mongoose';
import { migrateRefundDonationUnique } from '../src/infrastructure/database/migrations/refundDonationUnique.js';
import { logger } from '../src/infrastructure/logging/logger.js';

async function main(): Promise<void> {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is required');
    // Do not import application models: automatic index creation must wait until
    // the existing index has been migrated. No collection synchronization/drop.
    await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
    await migrateRefundDonationUnique(mongoose.connection.db!);
    logger.info('Refund donation uniqueness index migration completed');
  } catch (error) {
    logger.error({ err: error }, 'Refund index migration failed; no records deleted');
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
void main();
