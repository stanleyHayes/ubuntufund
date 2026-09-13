import type { mongo } from 'mongoose';

/** One-time, repeatable migration for the legacy non-unique refund index.
 * Never drops an index or edits records. A failed dry run leaves prepareUnique
 * enabled so new duplicates cannot enter while existing conflicts are reviewed.
 */
export async function migrateRefundDonationUnique(db: mongo.Db): Promise<void> {
  const collection = db.collection('refunds');
  const exists = await db.listCollections({ name: 'refunds' }, { nameOnly: true }).hasNext();
  const indexes = exists ? await collection.listIndexes().toArray() : [];
  const index = indexes.find(item => item.name === 'donationId_1');
  if (!index) {
    await collection.createIndex({ donationId: 1 }, { name: 'donationId_1', unique: true });
    return;
  }
  if (Object.keys(index.key).length !== 1 || index.key.donationId !== 1 ||
      index.sparse || index.partialFilterExpression || index.collation) {
    throw new Error('Unexpected refund index definition; manual review required');
  }
  if (index.unique) return;
  await db.command({ collMod: 'refunds', index: { name: index.name, prepareUnique: true } });
  await db.command({ collMod: 'refunds', index: { name: index.name, unique: true }, dryRun: true });
  await db.command({ collMod: 'refunds', index: { name: index.name, unique: true } });
}
