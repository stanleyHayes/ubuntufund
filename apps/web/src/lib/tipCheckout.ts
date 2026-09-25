const prefix = 'ujimora:tip-attempt:'
type Attempt = { key: string; reference?: string }
function readAttempt(stored: string | null): Attempt | null {
  if (!stored) return null
  try {
    const value: unknown = JSON.parse(stored)
    if (!value || typeof value !== 'object' || !('key' in value) || typeof value.key !== 'string' || !value.key.trim()) return null
    return { key: value.key, ...('reference' in value && typeof value.reference === 'string' ? { reference: value.reference } : {}) }
  } catch { return null }
}

async function attemptScope(viewerId: string | undefined, handle: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([viewerId ?? 'guest', handle])))
  return prefix + Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

// Store only an opaque attempt key and provider reference, never payment drafts.
export async function tipAttemptKey(viewerId: string | undefined, handle: string): Promise<string> {
  const scope = await attemptScope(viewerId, handle)
  const reserve = () => {
    const stored = localStorage.getItem(scope)
    if (stored !== null) {
      const attempt = readAttempt(stored)
      if (!attempt) throw new Error('Your saved payment attempt could not be read. Contact support before starting another payment for this creator.')
      return attempt.key
    }
    const key = crypto.randomUUID()
    localStorage.setItem(scope, JSON.stringify({ key }))
    return key
  }
  // Serialize same-origin tabs where Web Locks is available.
  return navigator.locks ? navigator.locks.request(scope, reserve) : reserve()
}

export function rememberTipReference(key: string, reference: string): void {
  for (const scope of Object.keys(localStorage).filter(name => name.startsWith(prefix))) {
    const attempt = readAttempt(localStorage.getItem(scope))
    if (!attempt) continue
    if (attempt.key === key) localStorage.setItem(scope, JSON.stringify({ ...attempt, reference }))
  }
}

export function finishTipAttempt(reference: string): void {
  for (const scope of Object.keys(localStorage).filter(name => name.startsWith(prefix))) {
    const attempt = readAttempt(localStorage.getItem(scope))
    if (!attempt) continue
    if (attempt.reference === reference) localStorage.removeItem(scope)
  }
}

/** The saved attempt for this supporter and creator, if any (key + reference). */
export async function readTipAttempt(viewerId: string | undefined, handle: string): Promise<Attempt | null> {
  return readAttempt(localStorage.getItem(await attemptScope(viewerId, handle)))
}

/**
 * Forget the saved attempt so the next Support click starts a new checkout.
 * Only after the earlier payment is known to be final, or the supporter chose
 * to start over.
 */
export async function abandonTipAttempt(viewerId: string | undefined, handle: string): Promise<void> {
  localStorage.removeItem(await attemptScope(viewerId, handle))
}
