const prefix = 'ujimora:tip-attempt:'
type Attempt = { key: string; reference?: string }

// Store only an opaque attempt key and provider reference, never payment drafts.
export async function tipAttemptKey(viewerId: string | undefined, handle: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([viewerId ?? 'guest', handle])))
  const scope = prefix + Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
  const reserve = () => {
    const stored = localStorage.getItem(scope)
    if (stored) return (JSON.parse(stored) as Attempt).key
    const key = crypto.randomUUID()
    localStorage.setItem(scope, JSON.stringify({ key }))
    return key
  }
  // Serialize same-origin tabs where Web Locks is available.
  return navigator.locks ? navigator.locks.request(scope, reserve) : reserve()
}

export function rememberTipReference(key: string, reference: string): void {
  for (const scope of Object.keys(localStorage).filter(name => name.startsWith(prefix))) {
    const attempt = JSON.parse(localStorage.getItem(scope)!) as Attempt
    if (attempt.key === key) localStorage.setItem(scope, JSON.stringify({ ...attempt, reference }))
  }
}

export function finishTipAttempt(reference: string): void {
  for (const scope of Object.keys(localStorage).filter(name => name.startsWith(prefix))) {
    const attempt = JSON.parse(localStorage.getItem(scope)!) as Attempt
    if (attempt.reference === reference) localStorage.removeItem(scope)
  }
}
