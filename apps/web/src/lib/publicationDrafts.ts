/**
 * Unsent public-content drafts kept in this browser, per account, so an exact
 * version held for safety review can be resubmitted after staff approve it,
 * even after the tab or dialog was closed. A review record is purged after 30
 * days, so older drafts are discarded. Storage can be unavailable (private
 * windows, blocked site data): every access is best-effort.
 */
const PREFIX = 'ujimora:publication-draft:'
const MAX_AGE_MS = 30 * 86_400_000

export function publicationDraftKey(scope: string, userId: string): string {
  return `${PREFIX}${scope}:${userId}`
}

export function readPublicationDraft<T>(key: string, parse: (value: unknown) => T | null): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const stored: unknown = JSON.parse(raw)
    const savedAt = stored && typeof stored === 'object' ? (stored as { savedAt?: unknown }).savedAt : undefined
    if (typeof savedAt !== 'number' || Date.now() - savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key)
      return null
    }
    return parse((stored as { value?: unknown }).value)
  } catch {
    return null
  }
}

export function writePublicationDraft(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value })) } catch { /* storage unavailable */ }
}

export function clearPublicationDraft(key: string): void {
  try { localStorage.removeItem(key) } catch { /* storage unavailable */ }
}

/** Explicit sign-out removes every account's drafts from a possibly shared browser. */
export function clearAllPublicationDrafts(): void {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key)
  } catch { /* storage unavailable */ }
}
