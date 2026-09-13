import mongoose from 'mongoose';
import { auditDonationSettlementIntegrity } from '../src/infrastructure/audits/donationSettlementIntegrity.js';

async function main() {
  const [before, after, limit = '100', ...extra] = process.argv.slice(2);
  if (!before || extra.length || !process.env.MONGODB_URI) throw new Error('Set MONGODB_URI; arguments: ISO_CUTOFF [AFTER_ID] [LIMIT]. No apply mode exists.');
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10_000, connectTimeoutMS: 10_000 });
  const report = await auditDonationSettlementIntegrity(mongoose.connection, { before: new Date(before), after: after || undefined, limit: Number(limit) });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report?.findings.length) process.exitCode = 2;
}
main().catch(() => { process.stderr.write('Donation integrity audit failed. Check arguments, database access and replica-set snapshot support.\n'); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
