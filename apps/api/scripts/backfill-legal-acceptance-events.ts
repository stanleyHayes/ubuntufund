import mongoose from 'mongoose';
import { UserModel } from '../src/infrastructure/database/models/UserModel.js';
import { LegalAcceptanceEventModel } from '../src/infrastructure/database/models/LegalAcceptanceEventModel.js';

/**
 * One-off: seed consent history for accounts created before
 * legal_acceptance_events existed, from their current users.legalAcceptance.
 * Dry run by default; pass --apply to write. Idempotent: an account that
 * already has any event is skipped, so it is safe to re-run. Closed accounts
 * are included, because their acceptance is still consent evidence.
 */
async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  if (args.some(arg => arg !== '--apply') || !process.env.MONGODB_URI) throw new Error('Set MONGODB_URI; arguments: [--apply].');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000, connectTimeoutMS: 10_000 });
  let candidates = 0, inserted = 0;
  const cursor = UserModel.find({ 'legalAcceptance.version': { $exists: true }, 'legalAcceptance.acceptedAt': { $exists: true } })
    .select('_id legalAcceptance').lean().cursor();
  for await (const user of cursor) {
    const userId = String(user._id);
    if (await LegalAcceptanceEventModel.exists({ userId })) continue;
    candidates++;
    if (!apply) continue;
    const acceptance = user.legalAcceptance!;
    await LegalAcceptanceEventModel.create({
      userId, version: acceptance.version, acceptedTerms: acceptance.acceptedTerms === true,
      ageConfirmed: acceptance.ageConfirmed === true, acceptedAt: acceptance.acceptedAt, source: 'backfill',
    });
    inserted++;
  }
  process.stdout.write(`${JSON.stringify({ mode: apply ? 'apply' : 'dry-run', candidates, inserted })}\n`);
}
main().catch(error => { process.stderr.write(`Legal acceptance backfill failed: ${error instanceof Error ? error.message : 'unknown error'}\n`); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
