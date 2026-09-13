import mongoose, { Types } from 'mongoose';
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { auditDonationSettlementIntegrity } from '../../src/infrastructure/audits/donationSettlementIntegrity.js';

beforeAll(connectTestDatabase);
beforeEach(dropTestDatabase);
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
const before = new Date(Date.now() - 3600_000);
async function seed() {
  const db = mongoose.connection.db!, intent = new Types.ObjectId(), donation = new Types.ObjectId(), journal = new Types.ObjectId();
  await db.collection('donationintents').insertOne({ _id: intent, campaignId: 'campaign', donorUserId: 'donor', provider: 'wallet', amount: 25, tip: 0, currency: 'GHS', status: 'SUCCEEDED', updatedAt: new Date(before.getTime() - 1000), settlementCurrency: 'GHS', settlementAmountMinor: 2500, donorEmail: 'must-not-be-reported@example.com' });
  await db.collection('donations').insertOne({ _id: donation, campaignId: 'campaign', amount: 25, currency: 'GHS' });
  await db.collection('journalentries').insertOne({ _id: journal, donationIntentId: intent.toString(), donationId: donation.toString(), currency: 'GHS' });
  await db.collection('journallines').insertMany([
    { journalEntryId: journal.toString(), accountKind: 'campaign', accountOwnerId: 'campaign', direction: 'debit', amount: 25, currency: 'GHS' },
    { journalEntryId: journal.toString(), accountKind: 'beneficiary', accountOwnerId: 'campaign', direction: 'credit', amount: 25, currency: 'GHS' },
  ]);
  await db.collection('outbox').insertOne({ type: 'donation.succeeded', payload: { donationIntentId: intent.toString(), donationId: donation.toString() } });
  await db.collection('wallettransactions').insertOne({ reference: `donation-intent:${intent}`, type: 'donation', userId: 'donor', amount: 25, currency: 'GHS', status: 'completed' });
  return { intent, donation, journal };
}
async function snapshot() {
  const db = mongoose.connection.db!, result: Record<string, unknown> = {};
  for (const c of await db.listCollections().toArray()) result[c.name] = await db.collection(c.name).find({}).sort({ _id: 1 }).toArray();
  return JSON.stringify(result);
}
it('reports complete structural records without modifying data or claiming complete financial proof', async () => {
  await seed(); const original = await snapshot();
  const report = await auditDonationSettlementIntegrity(mongoose.connection, { before });
  expect(report).toMatchObject({ mode: 'read-only', scanned: 1, findings: [], nextCursor: null });
  expect(report?.unverified).toContain('historical-campaign-and-beneficiary-projections');
  expect(JSON.stringify(report)).not.toContain('must-not-be-reported');
  expect(await snapshot()).toBe(original);
});
it('finds successful intents with absent accounting and wallet history without replaying them', async () => {
  const f = await seed(), db = mongoose.connection.db!;
  await db.collection('journalentries').deleteOne({ _id: f.journal });
  await db.collection('outbox').deleteMany({}); await db.collection('wallettransactions').deleteMany({});
  const original = await snapshot();
  const report = await auditDonationSettlementIntegrity(mongoose.connection, { before });
  expect(report?.findings[0].issues).toEqual(['missing-journal', 'missing-outbox', 'missing-wallet-history']);
  expect(await snapshot()).toBe(original);
});
it('flags journal, donation, outbox and wallet inconsistencies', async () => {
  const f = await seed(), db = mongoose.connection.db!;
  await db.collection('journallines').updateOne({ direction: 'credit' }, { $set: { amount: 20 } });
  await db.collection('donations').updateOne({ _id: f.donation }, { $set: { campaignId: 'other', amount: 10 } });
  await db.collection('outbox').updateOne({}, { $set: { 'payload.donationId': 'other' } });
  await db.collection('wallettransactions').updateOne({}, { $set: { userId: 'other' } });
  const report = await auditDonationSettlementIntegrity(mongoose.connection, { before });
  expect(report?.findings[0].issues).toEqual(expect.arrayContaining(['unbalanced-journal', 'donation-link-mismatch', 'campaign-journal-mismatch', 'outbox-donation-mismatch', 'wallet-history-mismatch']));
});
it('paginates deterministically and excludes recent or unsettled intents', async () => {
  await seed(); await seed();
  await mongoose.connection.db!.collection('donationintents').insertMany([
    { status: 'SUCCEEDED', updatedAt: new Date() }, { status: 'PENDING', updatedAt: new Date(0) },
  ]);
  const first = await auditDonationSettlementIntegrity(mongoose.connection, { before, limit: 1 });
  expect(first?.scanned).toBe(1); expect(first?.nextCursor).toBeTruthy();
  const second = await auditDonationSettlementIntegrity(mongoose.connection, { before, limit: 1, after: first!.nextCursor! });
  expect(second?.scanned).toBe(1); expect(second?.nextCursor).toBeNull();
  await expect(auditDonationSettlementIntegrity(mongoose.connection, { before: new Date() })).rejects.toThrow('30 minutes');
  await expect(auditDonationSettlementIntegrity(mongoose.connection, { before, limit: 201 })).rejects.toThrow('1–200');
  await expect(auditDonationSettlementIntegrity(mongoose.connection, { before, after: 'invalid' })).rejects.toThrow('cursor');
});
