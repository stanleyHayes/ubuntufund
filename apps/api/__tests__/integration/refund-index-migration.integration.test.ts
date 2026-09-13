import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { migrateRefundDonationUnique } from '../../src/infrastructure/database/migrations/refundDonationUnique.js';

describe('legacy refund index migration', () => {
  beforeAll(connectTestDatabase);
  beforeEach(dropTestDatabase);
  afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

  it('converts in place, preserves records and unrelated indexes, and is repeatable', async () => {
    const db = mongoose.connection.db!;
    const collection = db.collection('refunds');
    await collection.createIndex({ donationId: 1 });
    await collection.createIndex({ campaignId: 1 });
    await collection.insertOne({ donationId: 'donation-a', amount: 25 });
    const before = await collection.find().toArray();
    await migrateRefundDonationUnique(db);
    await migrateRefundDonationUnique(db);
    expect(await collection.find().toArray()).toEqual(before);
    expect(await collection.listIndexes().toArray()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'donationId_1', unique: true }),
      expect.objectContaining({ name: 'campaignId_1' }),
    ]));
    await expect(collection.insertOne({ donationId: 'donation-a' })).rejects.toMatchObject({ code: 11000 });
  });

  it('refuses duplicates without removing them and prevents new duplicates', async () => {
    const db = mongoose.connection.db!;
    const collection = db.collection('refunds');
    await collection.createIndex({ donationId: 1 });
    await collection.insertMany([{ donationId: 'same' }, { donationId: 'same' }]);
    const before = await collection.find().toArray();
    await expect(migrateRefundDonationUnique(db)).rejects.toThrow();
    expect(await collection.find().toArray()).toEqual(before);
    await expect(collection.insertOne({ donationId: 'same' })).rejects.toMatchObject({ code: 11000 });
  });

  it('supports a fresh database', async () => {
    const db = mongoose.connection.db!;
    await migrateRefundDonationUnique(db);
    expect(await db.collection('refunds').listIndexes().toArray()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'donationId_1', unique: true }),
    ]));
  });
});
