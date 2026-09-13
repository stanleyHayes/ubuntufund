import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { auditAccountClosureIntegrity } from '../../src/infrastructure/audits/accountClosureIntegrity.js';
beforeAll(connectTestDatabase);
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
const before = new Date('2026-01-01');
it('reports historical closure gaps without changing records or disclosing contact data', async () => {
  const db = mongoose.connection.db!;
  const ids = Array.from({ length: 5 }, () => new Types.ObjectId());
  await db.collection('users').insertMany([
    { _id: ids[0], deletedAt: new Date('2025-01-01') },
    { _id: ids[1], deletedAt: null },
    { _id: ids[2] },
    { _id: ids[3], deletedAt: 'invalid' },
  ]);
  await db.collection('accountdeletionrequests').insertMany(ids.map((id, index) => ({ userId: id.toString(), requestedAt: new Date('2025-01-01'), status: index === 2 ? 'pending' : 'review_required', coreRemovedAt: index === 3 ? null : new Date('2025-01-01'), contactEmail: 'private@example.test', reviewNotes: 'secret notes' })));
  const snapshot = async () => JSON.stringify(await Promise.all(['users', 'accountdeletionrequests'].map(name => db.collection(name).find().sort({ _id: 1 }).toArray())));
  const original = await snapshot();
  const report = await auditAccountClosureIntegrity(mongoose.connection, { before });
  expect(report?.scanned).toBe(5);
  expect(report?.findings.map(row => row.issues)).toEqual([
    ['missing-or-invalid-closure-date'],
    ['missing-or-invalid-closure-date', 'cleanup-pending'],
    ['missing-or-invalid-closure-date', 'missing-core-cleanup-date'],
    ['missing-account-tombstone'],
  ]);
  expect(JSON.stringify(report)).not.toMatch(/private@example|secret notes|contactEmail/);
  expect(await snapshot()).toBe(original);
});
it('paginates deterministically and rejects unsafe or malformed options', async () => {
  const all = await auditAccountClosureIntegrity(mongoose.connection, { before });
  let cursor: string | undefined;
  let scanned = 0;
  const findings = [];
  do {
    const page = await auditAccountClosureIntegrity(mongoose.connection, { before, after: cursor, limit: 2 });
    scanned += page!.scanned;
    findings.push(...page!.findings);
    cursor = page!.nextCursor ?? undefined;
  } while (cursor);
  expect(scanned).toBe(all?.scanned);
  expect(findings).toEqual(all?.findings);
  for (const opts of [{ before: new Date() }, { before, limit: 0 }, { before, after: 'invalid' }, { before: new Date('bad') }]) {
    await expect(auditAccountClosureIntegrity(mongoose.connection, opts)).rejects.toThrow();
  }
});
