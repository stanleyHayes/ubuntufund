/**
 * The API answers 428 when a publishing action needs a current account
 * agreement. The app's bundled LEGAL_ACCEPTANCE_VERSION can lag the API's until
 * the user updates, so a 428 tells AuthContext to re-read the server status.
 * No imports: lib/api uses this and must not form a cycle.
 */
type Listener = () => void
const listeners = new Set<Listener>()

export function onAgreementRequired(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function signalAgreementRequired(status: number): void {
  if (status !== 428) return
  for (const listener of [...listeners]) {
    try { listener() } catch { /* A failing observer must not break the request error path. */ }
  }
}
