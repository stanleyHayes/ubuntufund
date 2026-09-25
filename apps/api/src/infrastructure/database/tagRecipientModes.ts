import mongoose from 'mongoose'
import type { PaystackMode } from '../../domain/value-objects/PaystackMode.js'

/** Does the CURRENT Paystack key know this recipient code? */
export type RecipientLookup = (recipientCode: string) => Promise<'found' | 'missing' | 'unknown'>

export interface TagRecipientModesSummary {
  scanned: number
  /** Codes the current key knows: tagged with the current mode. */
  current: number
  /** Codes the current key does not know: tagged with the other mode (re-created lazily / refused at approval). */
  otherMode: number
  /** Lookup inconclusive (network, auth, rate limit): left untagged. */
  unresolved: number
  written: number
}

/**
 * One-off cutover helper. Recipient codes stored before mode tagging carry no
 * `recipientMode`, so a test-mode code saved before the live cutover cannot be
 * told apart from a live one. This asks Paystack, with the CURRENT key, about
 * every untagged code in the two collections transfers are addressed from
 * (saved payout accounts and campaign transfer recipients) and records the
 * answer. Read-only unless `apply` is true; historical payouts and review
 * snapshots are never rewritten, and inconclusive lookups stay untagged.
 */
export async function tagRecipientModes(opts: {
  currentMode: PaystackMode
  apply: boolean
  lookup: RecipientLookup
}): Promise<TagRecipientModesSummary> {
  const summary: TagRecipientModesSummary = { scanned: 0, current: 0, otherMode: 0, unresolved: 0, written: 0 }
  const other: PaystackMode = opts.currentMode === 'live' ? 'test' : 'live'
  const db = mongoose.connection
  const decide = async (code: string): Promise<PaystackMode | null> => {
    summary.scanned += 1
    const found = await opts.lookup(code)
    if (found === 'found') { summary.current += 1; return opts.currentMode }
    if (found === 'missing') { summary.otherMode += 1; return other }
    summary.unresolved += 1
    return null
  }

  const wallets = db.collection('payoutaccounts').find({ 'accounts.0': { $exists: true } })
  for await (const wallet of wallets) {
    for (const account of (wallet.accounts ?? []) as { id: string; recipientCode?: string; recipientMode?: string }[]) {
      if (account.recipientMode || !account.recipientCode) continue
      const mode = await decide(account.recipientCode)
      if (!mode || !opts.apply) continue
      const res = await db.collection('payoutaccounts').updateOne(
        { _id: wallet._id },
        { $set: { 'accounts.$[a].recipientMode': mode } },
        { arrayFilters: [{ 'a.id': account.id, 'a.recipientCode': account.recipientCode, 'a.recipientMode': { $exists: false } }] },
      )
      summary.written += res.modifiedCount
    }
  }

  const recipients = db.collection('transferrecipients').find({ recipientMode: { $exists: false } })
  for await (const recipient of recipients) {
    if (!recipient.recipientCode) continue
    const mode = await decide(String(recipient.recipientCode))
    if (!mode || !opts.apply) continue
    const res = await db.collection('transferrecipients').updateOne(
      { _id: recipient._id, recipientCode: recipient.recipientCode, recipientMode: { $exists: false } },
      { $set: { recipientMode: mode } },
    )
    summary.written += res.modifiedCount
  }
  return summary
}
