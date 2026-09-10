import mongoose from 'mongoose'
import { pathToFileURL } from 'node:url'

/** Repair only a proven legacy wallet debit missing from campaign accounting. */
export async function reconcileLegacyWalletDonation(connection, donationId, apply = false) {
  const db = connection.db
  const session = await connection.startSession()
  let report
  try {
    await session.withTransaction(async () => {
      const options = { session }
      const ref = `legacy-wallet-repair:${donationId}`
      const existing = await db.collection('journalentries').findOne({ externalRef: ref }, options)
      if (existing) {
        report = { donationId, status: 'already-reconciled' }
        return
      }
      const donation = await db
        .collection('donations')
        .findOne({ _id: new mongoose.Types.ObjectId(donationId) }, options)
      if (!donation || donation.paymentMethod !== 'wallet' || donation.currency !== 'GHS')
        throw new Error('Expected a GHS wallet donation')
      if (await db.collection('journalentries').findOne({ donationId }, options))
        throw new Error('Donation already has a journal; investigate instead')
      const debit = await db
        .collection('wallettransactions')
        .findOne(
          {
            reference: `donation:${donationId}`,
            type: 'donation',
            userId: donation.donorId,
            amount: donation.amount,
            currency: donation.currency,
          },
          options,
        )
      if (!debit) throw new Error('No matching wallet debit; cannot reconcile')
      const campaign = await db
        .collection('campaigns')
        .findOne({ _id: new mongoose.Types.ObjectId(donation.campaignId) }, options)
      const balance = await db
        .collection('campaignbalances')
        .findOne({ campaignId: donation.campaignId }, options)
      const rate = campaign?.lockedPlatformFeePercent
      if (!balance || !Number.isFinite(rate) || rate < 0 || rate > 100)
        throw new Error('Missing balance or historical campaign rate')
      const cents = (n) => Math.round(n * 100)
      if (cents(campaign.raisedAmount - balance.totalRaised) !== cents(donation.amount))
        throw new Error('Unaccounted raised difference must match this donation exactly')
      const fee = Math.round((cents(donation.amount) * rate) / 100) / 100
      const net = (cents(donation.amount) - cents(fee)) / 100
      report = {
        donationId,
        amount: donation.amount,
        platformFeePercent: rate,
        platformFee: fee,
        processorFee: 0,
        beneficiaryNet: net,
        eligibleBefore: balance.pendingBalance + balance.availableBalance,
        eligibleAfter:
          Math.round((balance.pendingBalance + balance.availableBalance + net) * 100) / 100,
        status: apply ? 'reconciled' : 'dry-run',
      }
      if (!apply) return
      const now = new Date()
      const entry = await db
        .collection('journalentries')
        .insertOne(
          {
            externalRef: ref,
            donationId,
            memo: 'Reconcile legacy wallet donation omitted from campaign payout balance',
            currency: 'GHS',
            createdAt: now,
          },
          options,
        )
      const drafts = [
        ['campaign', donation.campaignId, 'debit', donation.amount],
        ['beneficiary', donation.campaignId, 'credit', net],
        ['platform_fee', 'platform', 'credit', fee],
      ]
      for (const [kind, ownerId, direction, amount] of drafts) {
        if (!amount) continue
        const account = await db
          .collection('ledgeraccounts')
          .findOneAndUpdate(
            { kind, ownerId, currency: 'GHS' },
            { $setOnInsert: { createdAt: now } },
            { ...options, upsert: true, returnDocument: 'after' },
          )
        await db
          .collection('journallines')
          .insertOne(
            {
              journalEntryId: entry.insertedId.toString(),
              accountId: account._id.toString(),
              accountKind: kind,
              accountOwnerId: ownerId,
              direction,
              amount,
              currency: 'GHS',
              createdAt: now,
            },
            options,
          )
      }
      await db
        .collection('campaignbalances')
        .updateOne(
          { _id: balance._id },
          {
            $inc: { totalRaised: donation.amount, pendingBalance: net, platformFees: fee },
            $set: { updatedAt: now },
          },
          options,
        )
      await db
        .collection('donations')
        .updateOne(
          { _id: donation._id },
          {
            $set: {
              accountingRepair: { ref, platformFee: fee, beneficiaryNet: net, appliedAt: now },
            },
          },
          options,
        )
    })
    return report
  } finally {
    await session.endSession()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const id = process.argv.find((arg) => /^[a-f0-9]{24}$/i.test(arg))
    if (!id) throw new Error('Supply a donation ID; --apply writes the reviewed correction')
    await mongoose.connect(process.env.MONGODB_URI)
    console.log(
      JSON.stringify(
        await reconcileLegacyWalletDonation(
          mongoose.connection,
          id,
          process.argv.includes('--apply'),
        ),
      ),
    )
  } finally {
    await mongoose.disconnect()
  }
}
