import mongoose from 'mongoose';
import { SubscriptionModel } from '../src/infrastructure/database/models/SubscriptionModel.js';
import { SubscriptionCheckoutModel } from '../src/infrastructure/database/models/SubscriptionCheckoutModel.js';

/**
 * One-off: record which Paystack charges paid for each running web plan that
 * was settled before `paymentReferences` existed. A refund only takes back plan
 * time for a charge listed there, so without this a refund of a pre-deploy
 * charge (for example a yearly plan) left the member on the paid tier.
 *
 * For each web-billed, paid, still-running subscription with no
 * `paymentReferences`, it rebuilds the chain settlement would have written:
 * the SUCCEEDED `sub-` checkout for the same user and tier that started the
 * current period (settled within a few minutes of `currentPeriodStart`), plus
 * same-tier early renewals settled after it. The chain is only written when
 * its periods add up to `currentPeriodEnd`; anything else is reported by
 * subscription id for staff to review, never guessed.
 *
 * Dry run by default; pass --apply to write. Idempotent: rows that already
 * have `paymentReferences` are never touched, so it is safe to re-run.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Settlement writes the checkout and the subscription moments apart. */
const MATCH_TOLERANCE_MS = 5 * 60 * 1000;

export interface PaymentReferenceBackfillSummary {
  mode: 'apply' | 'dry-run';
  candidates: number;
  matched: number;
  updated: number;
  /** Subscription ids that need a manual decision. */
  unmatched: string[];
}

export async function backfillSubscriptionPaymentReferences(
  opts: { apply: boolean; now?: Date }
): Promise<PaymentReferenceBackfillSummary> {
  const now = opts.now ?? new Date();
  const summary: PaymentReferenceBackfillSummary = {
    mode: opts.apply ? 'apply' : 'dry-run', candidates: 0, matched: 0, updated: 0, unmatched: [],
  };
  const cursor = SubscriptionModel.find({
    billingProvider: { $nin: ['apple', 'google'] },
    tier: { $ne: 'free' },
    status: { $in: ['active', 'trialing'] },
    currentPeriodEnd: { $gt: now },
    paymentReferences: { $exists: false },
  }).select('_id userId tier currentPeriodStart currentPeriodEnd').lean().cursor();

  for await (const subscription of cursor) {
    summary.candidates += 1;
    const start = new Date(subscription.currentPeriodStart).getTime();
    const end = new Date(subscription.currentPeriodEnd).getTime();
    // Settled charges for this plan, in settlement order. A coupon-zeroed
    // activation (`sub_free_`) has no charge to refund, so it only counts
    // towards the period arithmetic.
    const settled = await SubscriptionCheckoutModel.find({
      userId: subscription.userId,
      tier: subscription.tier,
      status: 'succeeded',
      providerRef: { $exists: true },
      updatedAt: { $gte: new Date(start - MATCH_TOLERANCE_MS) },
    }).select('providerRef billingCycle updatedAt').sort({ updatedAt: 1 }).lean();

    const opener = settled[0];
    const opensPeriod = !!opener && Math.abs(new Date(opener.updatedAt).getTime() - start) <= MATCH_TOLERANCE_MS;
    const days = settled.reduce((total, checkout) => total + (checkout.billingCycle === 'yearly' ? 365 : 30), 0);
    const addsUp = Math.abs(start + days * MS_PER_DAY - end) <= MATCH_TOLERANCE_MS;
    const references = settled
      .map((checkout) => checkout.providerRef as string)
      .filter((reference) => reference.startsWith('sub-'));
    if (!opensPeriod || !addsUp || !references.length) {
      summary.unmatched.push(String(subscription._id));
      continue;
    }
    summary.matched += 1;
    if (!opts.apply) continue;
    const result = await SubscriptionModel.updateOne(
      { _id: subscription._id, paymentReferences: { $exists: false } },
      { $set: { paymentReferences: references } },
      { timestamps: false }
    );
    summary.updated += result.modifiedCount;
  }
  return summary;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  if (args.some(arg => arg !== '--apply') || !process.env.MONGODB_URI) throw new Error('Set MONGODB_URI; arguments: [--apply].');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000, connectTimeoutMS: 10_000 });
  const summary = await backfillSubscriptionPaymentReferences({ apply });
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

// CLI: `MONGODB_URI=… tsx scripts/backfill-subscription-payment-references.ts [--apply]`
// (NodeNext compiles this package to CommonJS, so use the CJS main check.)
if (require.main === module) {
  main().catch(error => {
    process.stderr.write(`Subscription payment-reference backfill failed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
    process.exitCode = 1;
  }).finally(() => mongoose.disconnect());
}
