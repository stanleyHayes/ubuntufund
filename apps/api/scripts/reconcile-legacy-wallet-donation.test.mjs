import { test } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { reconcileLegacyWalletDonation } from './reconcile-legacy-wallet-donation.mjs'

test('repair verifies debit, preserves raised total, balances journal, and is idempotent', async () => {
  const connection = await mongoose
    .createConnection('mongodb://127.0.0.1:28017/legacy-wallet-repair-test?replicaSet=testset')
    .asPromise()
  const db = connection.db
  try {
    await db.dropDatabase()
    const campaign = new mongoose.Types.ObjectId(),
      donation = new mongoose.Types.ObjectId()
    await db
      .collection('campaigns')
      .insertOne({ _id: campaign, raisedAmount: 5200, lockedPlatformFeePercent: 5 })
    await db
      .collection('campaignbalances')
      .insertOne({
        campaignId: campaign.toString(),
        totalRaised: 4200,
        pendingBalance: 3887.62,
        availableBalance: 0,
        platformFees: 210,
      })
    await db
      .collection('donations')
      .insertOne({
        _id: donation,
        campaignId: campaign.toString(),
        donorId: 'donor',
        paymentMethod: 'wallet',
        amount: 1000,
        currency: 'GHS',
      })
    await assert.rejects(
      reconcileLegacyWalletDonation(connection, donation.toString(), true),
      /No matching wallet debit/,
    )
    await db
      .collection('wallettransactions')
      .insertOne({
        reference: `donation:${donation}`,
        type: 'donation',
        userId: 'donor',
        amount: 1000,
        currency: 'GHS',
      })
    const preview = await reconcileLegacyWalletDonation(connection, donation.toString())
    assert.equal(preview.eligibleAfter, 4837.62)
    assert.equal(await db.collection('journalentries').countDocuments(), 0)
    await reconcileLegacyWalletDonation(connection, donation.toString(), true)
    assert.equal(
      (await reconcileLegacyWalletDonation(connection, donation.toString(), true)).status,
      'already-reconciled',
    )
    const balance = await db.collection('campaignbalances').findOne({})
    assert.equal(balance.totalRaised, 5200)
    assert.equal(balance.platformFees, 260)
    assert.equal(balance.pendingBalance, 4837.62)
    assert.equal((await db.collection('campaigns').findOne({})).raisedAmount, 5200)
    const lines = await db.collection('journallines').find({}).toArray()
    assert.equal(
      lines.reduce(
        (sum, line) => sum + (line.direction === 'debit' ? line.amount : -line.amount),
        0,
      ),
      0,
    )
  } finally {
    await db.dropDatabase()
    await connection.close()
  }
})
