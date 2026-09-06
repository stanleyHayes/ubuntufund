import mongoose from 'mongoose';
import { DonationIntentModel } from './models/DonationIntentModel.js';
import { toMinorUnits } from '../../domain/value-objects/Money.js';
import { logger } from '../logging/logger.js';

/**
 * Backfill the integer minor-unit + currency fields on legacy donation intents
 * (spec §21). Idempotent and non-destructive: it only touches records that are
 * missing `originalAmountMinor`, derives the minor units from the existing
 * (GHS) float `amount + tip`, and records a legacy 1:1 settlement. It never
 * rewrites a record that already carries settlement figures, so re-running it —
 * or running it after new diaspora contributions exist — is safe and creates no
 * duplicates. Returns the number of records updated.
 */
export async function backfillContributionMinorUnits(): Promise<number> {
  const cursor = DonationIntentModel.find({
    originalAmountMinor: { $exists: false },
  }).cursor();

  let updated = 0;
  for await (const doc of cursor) {
    const currency = doc.currency || 'GHS';
    const originalMinor = toMinorUnits((doc.amount ?? 0) + (doc.tip ?? 0), currency);
    // Guard on the same "missing" predicate so a concurrent run can't double-set.
    const res = await DonationIntentModel.updateOne(
      { _id: doc._id, originalAmountMinor: { $exists: false } },
      {
        $set: {
          originalAmountMinor: originalMinor,
          originalCurrency: currency,
          // Legacy GHS contributions settled in the platform currency 1:1.
          settlementAmountMinor: originalMinor,
          settlementCurrency: currency,
          fxRate: 1,
          fxSource: 'legacy-backfill',
        },
      }
    );
    if (res.modifiedCount > 0) updated += 1;
  }

  logger.info(`Backfilled minor-unit money on ${updated} legacy donation intents`);
  return updated;
}

// CLI: `tsx src/infrastructure/database/backfillContributionMoney.ts`
// (NodeNext compiles this package to CommonJS, so use the CJS main check.)
if (require.main === module) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.error('MONGODB_URI is required to run the contribution money backfill');
    process.exit(1);
  }
  mongoose
    .connect(uri)
    .then(backfillContributionMinorUnits)
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, 'contribution money backfill failed');
      process.exit(1);
    });
}
