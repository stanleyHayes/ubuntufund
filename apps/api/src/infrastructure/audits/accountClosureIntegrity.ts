import { Types, type Connection } from 'mongoose';

/** Read-only inventory; never repairs accounts or initializes model indexes. */
export async function auditAccountClosureIntegrity(connection: Connection, opts: { before: Date; after?: string; limit?: number }) {
  const limit = opts.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('Limit must be 1–200');
  if (!Number.isFinite(opts.before.getTime()) || opts.before.getTime() > Date.now() - 30 * 60_000) throw new Error('Cutoff must be at least 30 minutes old');
  if (opts.after && !/^[a-f\d]{24}$/i.test(opts.after)) throw new Error('Invalid cursor');
  const db = connection.db;
  if (!db) throw new Error('Database connection required');
  const session = await connection.startSession();
  try {
    return await session.withTransaction(async () => {
      const options = { session, maxTimeMS: 30_000 };
      const rows = await db.collection('accountdeletionrequests').find({ requestedAt: { $lt: opts.before }, ...(opts.after ? { _id: { $gt: new Types.ObjectId(opts.after) } } : {}) },
        { ...options, projection: { userId: 1, status: 1, coreRemovedAt: 1 } }).sort({ _id: 1 }).limit(limit + 1).toArray();
      const findings: { requestId: string; issues: string[] }[] = [];
      for (const row of rows.slice(0, limit)) {
        const issues: string[] = [];
        if (typeof row.userId !== 'string' || !/^[a-f\d]{24}$/i.test(row.userId)) issues.push('invalid-account-reference');
        else {
          const account = await db.collection('users').findOne({ _id: new Types.ObjectId(row.userId) }, { ...options, projection: { deletedAt: 1 } });
          if (!account) issues.push('missing-account-tombstone');
          else if (!(account.deletedAt instanceof Date) || !Number.isFinite(account.deletedAt.getTime())) issues.push('missing-or-invalid-closure-date');
        }
        if (row.status === 'pending') issues.push('cleanup-pending');
        else if (row.status !== 'review_required') issues.push('unknown-request-status');
        else if (!(row.coreRemovedAt instanceof Date) || !Number.isFinite(row.coreRemovedAt.getTime())) issues.push('missing-core-cleanup-date');
        if (issues.length) findings.push({ requestId: row._id.toString(), issues });
      }
      return { mode: 'read-only', before: opts.before.toISOString(), scanned: Math.min(limit, rows.length), findings,
        nextCursor: rows.length > limit ? rows[limit - 1]._id.toString() : null,
        unverified: ['requests-without-valid-cutoff-date', 'accounts-without-deletion-requests', 'actual-category-erasure', 'processor-erasure', 'retention-authority'] };
    }, { readConcern: { level: 'snapshot' }, readPreference: 'primary' });
  } finally { await session.endSession(); }
}
