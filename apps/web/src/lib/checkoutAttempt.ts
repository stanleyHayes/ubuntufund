/**
 * One Idempotency-Key per logical checkout submission.
 *
 * A fresh key on every click turns a retry after a lost response (a gateway
 * timeout, a cold start) into a second donation: a second wallet debit, or a
 * second intent and checkout that also holds a fee-waiver seat. So the key is
 * kept for as long as the donor retries the SAME details, and replaced as soon
 * as the details change or the server gives a definite answer.
 *
 * Only opaque digests are stored (sessionStorage, same tab — it survives the
 * round trip through a hosted checkout), never the amounts, email or message.
 */
const prefix = 'ujimora:checkout-attempt:'
const memory = new Map<string, string>()

async function digest(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function read(slot: string): string | null {
  try {
    return sessionStorage.getItem(slot)
  } catch {
    return memory.get(slot) ?? null
  }
}

function write(slot: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(slot)
    else sessionStorage.setItem(slot, value)
  } catch {
    // Storage may be unavailable (private mode); keep the attempt for this page.
    if (value === null) memory.delete(slot)
    else memory.set(slot, value)
  }
}

function parse(stored: string | null): { key: string; fingerprint: string } | null {
  if (!stored) return null
  try {
    const value: unknown = JSON.parse(stored)
    if (!value || typeof value !== 'object') return null
    const { key, fingerprint } = value as Record<string, unknown>
    return typeof key === 'string' && key && typeof fingerprint === 'string' ? { key, fingerprint } : null
  } catch {
    return null
  }
}

/** The key for this submission: reused while `input` is unchanged, new otherwise. */
export async function checkoutAttemptKey(scope: string, input: unknown): Promise<string> {
  const slot = prefix + (await digest(scope))
  const fingerprint = await digest(input)
  const stored = parse(read(slot))
  if (stored && stored.fingerprint === fingerprint) return stored.key
  const key = crypto.randomUUID()
  write(slot, JSON.stringify({ key, fingerprint }))
  return key
}

/** Drop the saved attempt so the next submission starts a new one. */
export async function forgetCheckoutAttempt(scope: string): Promise<void> {
  write(prefix + (await digest(scope)), null)
}

/**
 * True when the server definitely answered the request (a 4xx), so retrying
 * the same key cannot help and a new attempt should get a new key. Network
 * failures, timeouts (408) and 5xx keep the key: the first request may still
 * have gone through.
 */
export function isDefinitiveRejection(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 408
}
