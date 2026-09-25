/* eslint-disable no-console -- CLI report output */
/**
 * Paystack test → live cutover: tag untagged recipient codes with the mode that
 * created them, by asking Paystack (with the CURRENT key) whether it knows each
 * one. Read-only unless --apply is passed. Run once against production after
 * switching PAYSTACK_SECRET_KEY to sk_live_:
 *
 *   MONGODB_URI=... PAYSTACK_SECRET_KEY=sk_live_... npx tsx scripts/tag-recipient-mode.ts          # report
 *   MONGODB_URI=... PAYSTACK_SECRET_KEY=sk_live_... npx tsx scripts/tag-recipient-mode.ts --apply  # write
 *
 * Saved payout accounts tagged with the other mode get a fresh recipient the
 * next time they are used; campaign recipients tagged with it are refused at
 * approval until the owner adds the account again.
 */
import mongoose from 'mongoose'
import { tagRecipientModes } from '../src/infrastructure/database/tagRecipientModes.js'
import { paystackModeFromSecret } from '../src/domain/value-objects/PaystackMode.js'

async function main() {
  const uri = process.env.MONGODB_URI
  const secretKey = process.env.PAYSTACK_SECRET_KEY ?? ''
  if (!uri) throw new Error('MONGODB_URI required')
  if (!secretKey) throw new Error('PAYSTACK_SECRET_KEY required')
  const apply = process.argv.includes('--apply')
  await mongoose.connect(uri)
  try {
    const summary = await tagRecipientModes({
      currentMode: paystackModeFromSecret(secretKey),
      apply,
      lookup: async (code) => {
        try {
          const res = await fetch(`https://api.paystack.co/transferrecipient/${encodeURIComponent(code)}`, {
            headers: { Authorization: `Bearer ${secretKey}` },
            signal: AbortSignal.timeout(10_000),
          })
          if (res.status === 404) return 'missing'
          const json = (await res.json()) as { status?: boolean }
          return res.ok && json.status ? 'found' : 'unknown'
        } catch {
          return 'unknown'
        }
      },
    })
    console.log({ apply, mode: paystackModeFromSecret(secretKey), ...summary })
  } finally {
    await mongoose.disconnect()
  }
}
void main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
