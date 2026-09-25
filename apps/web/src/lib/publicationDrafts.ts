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

/** The Idempotency-Key a draft was last submitted with, and a digest of what was sent. */
export interface DraftSubmission {
  fingerprint: string
  key: string
}

const submissionKey = (draftKey: string) => `${draftKey}:submission`

function parseSubmission(value: unknown): DraftSubmission | null {
  if (!value || typeof value !== 'object') return null
  const { fingerprint, key } = value as Record<string, unknown>
  return typeof fingerprint === 'string' && typeof key === 'string' && key ? { fingerprint, key } : null
}

async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * The Idempotency-Key for submitting `payload` from the draft at `draftKey`:
 * the same key for as long as the submitted content is unchanged, a new one
 * once it changes. It is kept beside the draft, so a resubmit after a lost
 * response reuses it even after a reload or reopening the page, when the
 * restored draft invites the user to submit again. Only a digest of the
 * content is stored with it. `current` is the page's own copy, which still
 * works when storage is unavailable.
 */
export async function draftSubmission(draftKey: string | null, payload: unknown, current: DraftSubmission | null): Promise<DraftSubmission> {
  const fingerprint = await digest(JSON.stringify(payload))
  const stored = draftKey ? readPublicationDraft(submissionKey(draftKey), parseSubmission) : null
  const submission = [current, stored].find((candidate) => candidate?.fingerprint === fingerprint)
    ?? { fingerprint, key: crypto.randomUUID() }
  if (draftKey) writePublicationDraft(submissionKey(draftKey), submission)
  return submission
}

/** Forget the draft's submission key once the draft is done with or discarded. */
export function clearDraftSubmission(draftKey: string): void {
  clearPublicationDraft(submissionKey(draftKey))
}

/**
 * The API saved this public change privately for staff safety review (HTTP 409
 * with `errors.publication: ['held']`). That is an expected state, not a
 * failure: show a neutral notice, keep the draft, and submit the same version
 * again after approval. A declined version (422) is still an error. The
 * message check covers an API deployed before the `errors` marker existed.
 * Duck-typed so it works with any `ApiError`-shaped error.
 */
export function isPublicationHeld(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const { status, errors } = err as Error & { status?: unknown; errors?: Record<string, unknown> }
  if (status !== 409) return false
  const publication = errors?.publication
  return (Array.isArray(publication) && publication.includes('held')) || err.message.startsWith('Saved privately for safety review')
}
