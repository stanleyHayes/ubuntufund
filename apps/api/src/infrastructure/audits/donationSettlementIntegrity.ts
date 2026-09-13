import { Types, type Connection } from 'mongoose';
import { toMinorUnits } from '../../domain/value-objects/Money.js';

export interface DonationIntegrityOptions { before: Date; limit?: number; after?: string }
export interface DonationIntegrityFinding { intentId: string; campaignId: string; issues: string[] }

/** Observational structural audit. No repair, provider calls or model/index initialization. */
export async function auditDonationSettlementIntegrity(connection: Connection, opts: DonationIntegrityOptions) {
  const limit = opts.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('Limit must be 1–200');
  if (!Number.isFinite(opts.before.getTime()) || opts.before.getTime() > Date.now() - 30 * 60_000) throw new Error('Cutoff must be at least 30 minutes old');
  if (opts.after && !/^[a-f\d]{24}$/i.test(opts.after)) throw new Error('Invalid continuation cursor');
  const db = connection.db;
  if (!db) throw new Error('Database connection is required');
  const session = await connection.startSession();
  try {
    return await session.withTransaction(async () => {
      const options = { session, maxTimeMS: 30_000 };
      const intents = await db.collection('donationintents').find({ status: 'SUCCEEDED', updatedAt: { $lt: opts.before },
        ...(opts.after ? { _id: { $gt: new Types.ObjectId(opts.after) } } : {}) },
      { ...options, projection: { campaignId: 1, provider: 1, amount: 1, tip: 1, currency: 1, donorUserId: 1, settlementCurrency: 1, settlementAmountMinor: 1 } })
        .sort({ _id: 1 }).limit(limit + 1).toArray();
      const findings: DonationIntegrityFinding[] = [];
      for (const intent of intents.slice(0, limit)) {
        const intentId = intent._id.toString(), issues: string[] = [];
        const journals = await db.collection('journalentries').find({ donationIntentId: intentId },
          { ...options, projection: { donationId: 1, currency: 1 } }).limit(2).toArray();
        if (journals.length !== 1) issues.push(journals.length ? 'duplicate-journal' : 'missing-journal');
        const journal = journals[0];
        if (journal) {
          const donationId = journal.donationId;
          const donation = typeof donationId === 'string' && /^[a-f\d]{24}$/i.test(donationId)
            ? await db.collection('donations').findOne({ _id: new Types.ObjectId(donationId) },
              { ...options, projection: { campaignId: 1, amount: 1, currency: 1 } }) : null;
          if (!donation) issues.push('missing-linked-donation');
          else if (donation.campaignId !== intent.campaignId || donation.currency !== journal.currency) issues.push('donation-link-mismatch');
          const lines = await db.collection('journallines').find({ journalEntryId: journal._id.toString() },
            { ...options, projection: { direction: 1, amount: 1, currency: 1, accountKind: 1, accountOwnerId: 1 } }).toArray();
          if (typeof journal.currency !== 'string' || !lines.length || lines.some(l => !Number.isFinite(l.amount) || l.amount < 0 || l.currency !== journal.currency || !['debit', 'credit'].includes(l.direction))) issues.push('invalid-journal-lines');
          else {
            const minor = (n: number) => toMinorUnits(n, journal.currency);
            const debit = lines.filter(l => l.direction === 'debit').reduce((sum, l) => sum + minor(l.amount), 0);
            const credit = lines.filter(l => l.direction === 'credit').reduce((sum, l) => sum + minor(l.amount), 0);
            if (debit !== credit) issues.push('unbalanced-journal');
            if (Number.isSafeInteger(intent.settlementAmountMinor) && (debit !== intent.settlementAmountMinor || journal.currency !== intent.settlementCurrency)) issues.push('settlement-journal-mismatch');
            if (donation && (!Number.isFinite(donation.amount) || lines.filter(l => l.accountKind === 'campaign' && l.accountOwnerId === intent.campaignId && l.direction === 'debit').reduce((sum, l) => sum + minor(l.amount), 0) !== minor(donation.amount))) issues.push('campaign-journal-mismatch');
          }
        }
        const events = await db.collection('outbox').find({ type: 'donation.succeeded', 'payload.donationIntentId': intentId },
          { ...options, projection: { 'payload.donationId': 1 } }).limit(2).toArray();
        if (events.length !== 1) issues.push(events.length ? 'duplicate-outbox' : 'missing-outbox');
        else if (journal && events[0].payload?.donationId !== journal.donationId) issues.push('outbox-donation-mismatch');
        if (intent.provider === 'wallet') {
          const history = await db.collection('wallettransactions').find({ reference: `donation-intent:${intentId}`, type: 'donation' },
            { ...options, projection: { userId: 1, amount: 1, currency: 1, status: 1 } }).limit(2).toArray();
          if (history.length !== 1) issues.push(history.length ? 'duplicate-wallet-history' : 'missing-wallet-history');
          else if (typeof intent.currency !== 'string' || !intent.donorUserId || history[0].userId !== intent.donorUserId || history[0].currency !== intent.currency || history[0].status !== 'completed' || !Number.isFinite(history[0].amount) || !Number.isFinite(intent.amount) || !Number.isFinite(intent.tip ?? 0) || toMinorUnits(history[0].amount, intent.currency) !== toMinorUnits(intent.amount + (intent.tip ?? 0), intent.currency)) issues.push('wallet-history-mismatch');
        }
        if (issues.length) findings.push({ intentId, campaignId: String(intent.campaignId), issues });
      }
      return { mode: 'read-only' as const, before: opts.before.toISOString(), scanned: Math.min(limit, intents.length), findings,
        nextCursor: intents.length > limit ? intents[limit - 1]._id.toString() : null,
        unverified: ['actual-provider-or-wallet-funds-movement', 'historical-campaign-and-beneficiary-projections', 'refunds-and-compensations', 'unlinked-orphan-records', 'legacy-donations-without-intents'] };
    }, { readConcern: { level: 'snapshot' }, readPreference: 'primary' });
  } finally { await session.endSession(); }
}
