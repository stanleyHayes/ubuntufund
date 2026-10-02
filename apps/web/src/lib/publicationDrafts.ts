import { PUBLICATION_HELD, PUBLISHES_ON_APPROVAL } from '@ubuntu-fund/types'

/**
 * Unsent public-content drafts kept in this browser, per account, so an exact
 * version held for safety review can be resubmitted after staff approve it (or
 * after its approval couldn't publish it), even after the tab or dialog was
 * closed. A review record is purged after 30 days, so older drafts are
 * discarded. Storage can be unavailable (private windows, blocked site data):
 * every access is best-effort.
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

/** A profile image held for safety review, as the image editor keeps it (ProfileImageEditor). */
export interface HeldProfileImage {
  url: string
  /** Its approval publishes it by itself. */
  publishesOnApproval: boolean
}

/** The image editor's draft key for one kind of image. */
export const profileImageDraftKey = (kind: 'avatarUrl' | 'coverUrl', userId: string) => publicationDraftKey(`profile-${kind}`, userId)

/** A held profile image draft; drafts saved before publishing on approval are the bare URL. */
export function heldProfileImage(value: unknown): HeldProfileImage | null {
  const fields = value && typeof value === 'object' ? (value as Record<string, unknown>) : { url: value }
  return typeof fields.url === 'string' && fields.url.startsWith('https://') ? { url: fields.url, publishesOnApproval: fields.publishesOnApproval === true } : null
}

/**
 * Forgets the held profile images a withdrawn version proposed (its
 * `mediaUrls`, the newly proposed images), so the image editor no longer
 * offers them as waiting for review. Any other draft stays.
 */
export function clearWithdrawnProfileImages(userId: string, mediaUrls: readonly string[]): void {
  for (const kind of ['avatarUrl', 'coverUrl'] as const) {
    const key = profileImageDraftKey(kind, userId)
    const held = readPublicationDraft(key, heldProfileImage)
    if (held && mediaUrls.includes(held.url)) clearPublicationDraft(key)
  }
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

/** Whether the API error's `errors[field]` lists `marker`. */
function hasMarker(err: unknown, field: string, marker: string): boolean {
  const values = (err as { errors?: Record<string, unknown> } | null)?.errors?.[field]
  return Array.isArray(values) && values.includes(marker)
}

/**
 * The API saved this public change privately for staff safety review (HTTP 409
 * with `errors.publication: ['held']`). That is an expected state, not a
 * failure: show a neutral notice and keep the draft. A declined version (422)
 * is still an error. The message check covers an API deployed before the
 * `errors` marker existed. Duck-typed so it works with any `ApiError`-shaped
 * error.
 */
export function isPublicationHeld(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if ((err as Error & { status?: unknown }).status !== 409) return false
  return hasMarker(err, 'publication', PUBLICATION_HELD) || err.message.startsWith('Saved privately for safety review')
}

/**
 * The held version is published by itself once a reviewer approves it
 * (`errors.publication` also lists `publishes_on_approval`), so its author
 * doesn't submit it again. Without the marker (live sessions, versions held
 * before publishing on approval, or with it switched off), the author submits
 * the same version again after approval.
 */
export function publishesOnApproval(err: unknown): boolean {
  return isPublicationHeld(err) && hasMarker(err, 'publication', PUBLISHES_ON_APPROVAL)
}

/** What a hold means for its author: how it gets published, and whether the rest of the save went through. */
export interface PublicationHold {
  /** Published by itself once approved (see `publishesOnApproval`). */
  publishesOnApproval: boolean
  /** The private settings sent with it were saved anyway (`errors.saved` lists `private`); only the public part waits. */
  savedOtherChanges: boolean
}

/** The hold an error reports, or null when it is not a hold. */
export function publicationHold(err: unknown): PublicationHold | null {
  if (!isPublicationHeld(err)) return null
  return { publishesOnApproval: publishesOnApproval(err), savedOtherChanges: hasMarker(err, 'saved', 'private') }
}
