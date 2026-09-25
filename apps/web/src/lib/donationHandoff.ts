/**
 * Handoff between DonatePage and the Paystack return page (`/donate/callback`):
 * the intent id to poll and the campaign to link back to, keyed by the
 * reference Paystack echoes on the redirect.
 *
 * Kept in sessionStorage — Paystack returns in the same tab, so it survives
 * the round trip — and looked up by reference only. It used to live in
 * localStorage forever with a `__last` fallback, so on a shared device opening
 * a bare /donate/callback showed the previous donor's gift.
 */
const HANDOFF_KEY = 'uf_pending_donations'

export interface PendingDonation {
  intentId: string
  reference?: string
  slug: string
  title: string
  amount: number
  currency: string
}

function readStore(): Record<string, PendingDonation> {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY)
    const store: unknown = raw ? JSON.parse(raw) : {}
    return store && typeof store === 'object' ? (store as Record<string, PendingDonation>) : {}
  } catch {
    return {}
  }
}

function writeStore(store: Record<string, PendingDonation>): void {
  try {
    if (Object.keys(store).length) sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(store))
    else sessionStorage.removeItem(HANDOFF_KEY)
  } catch {
    // Storage may be unavailable (private mode) — the callback still works by
    // parsing the intent id out of the reference, so this is best-effort only.
  }
}

/** Persist the pending-donation handoff keyed by its Paystack reference. */
export function rememberPendingDonation(entry: PendingDonation): void {
  if (!entry.reference) return
  const store = readStore()
  store[entry.reference] = entry
  writeStore(store)
}

/** The handoff for this exact reference, or null. Never another donor's gift. */
export function readPendingDonation(reference: string | null): PendingDonation | null {
  if (!reference || reference === '__last') return null
  return readStore()[reference] ?? null
}

/** Drop a handoff once its payment reached a final state. */
export function forgetPendingDonation(reference: string | null | undefined): void {
  if (!reference) return
  const store = readStore()
  if (!(reference in store)) return
  delete store[reference]
  writeStore(store)
}

/** One-time cleanup of the old, never-pruned localStorage handoff store. */
export function clearLegacyDonationHandoff(): void {
  try {
    localStorage.removeItem(HANDOFF_KEY)
  } catch {
    // Nothing to clean when storage is unavailable.
  }
}
