import AsyncStorage from '@react-native-async-storage/async-storage'
import { PUBLICATION_HELD, PUBLISHES_ON_APPROVAL } from '@ubuntu-fund/types'

/**
 * Unsent public-content versions, per account, so a version held for safety
 * review can be resubmitted unchanged (images included) after approval, or
 * after an approval could not publish it, even if the app was closed. Review
 * records are purged after 30 days, so older drafts are discarded. Storage
 * failures never block a form.
 */
const PREFIX = 'ujimora:publication-draft:'
const MAX_AGE_MS = 30 * 86_400_000

async function loadDraft<T>(scope: string, userId: string, parse: (value: Record<string, unknown>) => T | null): Promise<T | null> {
  const key = `${PREFIX}${scope}:${userId}`
  try {
    const raw = await AsyncStorage.getItem(key)
    if (!raw) return null
    const stored: unknown = JSON.parse(raw)
    const record = stored && typeof stored === 'object' ? stored as { savedAt?: unknown; value?: unknown } : {}
    if (typeof record.savedAt !== 'number' || Date.now() - record.savedAt > MAX_AGE_MS || !record.value || typeof record.value !== 'object') {
      await AsyncStorage.removeItem(key)
      return null
    }
    return parse(record.value as Record<string, unknown>)
  } catch {
    return null
  }
}

async function saveDraft(scope: string, userId: string, value: unknown): Promise<void> {
  try { await AsyncStorage.setItem(`${PREFIX}${scope}:${userId}`, JSON.stringify({ savedAt: Date.now(), value })) } catch { /* storage unavailable */ }
}

async function clearDraft(scope: string, userId: string): Promise<void> {
  try { await AsyncStorage.removeItem(`${PREFIX}${scope}:${userId}`) } catch { /* storage unavailable */ }
}

/** Explicit sign-out removes every account's drafts from a possibly shared device. */
export async function clearAllPublicationDrafts(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(PREFIX))
    if (keys.length) await AsyncStorage.multiRemove(keys)
  } catch { /* storage unavailable */ }
}

function strings<K extends string>(value: Record<string, unknown>, fields: readonly K[]): Record<K, string> {
  return Object.fromEntries(fields.map(field => [field, typeof value[field] === 'string' ? value[field] : ''])) as Record<K, string>
}

const CAMPAIGN_FIELDS = ['title', 'description', 'category', 'priority', 'beneficiaries', 'cover', 'amount', 'end'] as const
export type CampaignDraft = Record<(typeof CAMPAIGN_FIELDS)[number], string>

export const loadCampaignDraft = (userId: string) => loadDraft('campaign', userId, value => {
  const draft = strings(value, CAMPAIGN_FIELDS)
  return CAMPAIGN_FIELDS.some(field => field !== 'category' && field !== 'priority' && draft[field]) ? draft : null
})
export const saveCampaignDraft = (userId: string, draft: CampaignDraft) => saveDraft('campaign', userId, draft)
export const clearCampaignDraft = (userId: string) => clearDraft('campaign', userId)

/** Only the public identity fields a held profile save proposed. */
const IDENTITY_FIELDS = ['name', 'country', 'avatarUrl', 'coverUrl'] as const
export type IdentityDraft = Partial<Record<(typeof IDENTITY_FIELDS)[number], string>>

/** A held profile change kept on this device, and whether its approval publishes it by itself. */
export interface HeldIdentity {
  fields: IdentityDraft
  publishesOnApproval: boolean
}

export const loadIdentityDraft = (userId: string) => loadDraft<HeldIdentity>('account-identity', userId, value => {
  const fields: IdentityDraft = {}
  for (const field of IDENTITY_FIELDS) if (typeof value[field] === 'string') fields[field] = value[field] as string
  // A draft kept before publishing on approval has no flag: its approval never published it.
  return Object.keys(fields).length ? { fields, publishesOnApproval: value.publishesOnApproval === true } : null
})
export const saveIdentityDraft = (userId: string, fields: IdentityDraft, publishesOnApproval = false) =>
  saveDraft('account-identity', userId, publishesOnApproval ? { ...fields, publishesOnApproval } : fields)
export const clearIdentityDraft = (userId: string) => clearDraft('account-identity', userId)

/** One `errors` list of an `ApiError`-shaped error, or none. */
function errorMarkers(err: unknown, field: string): unknown[] {
  const list = (err as { errors?: Record<string, unknown> } | null)?.errors?.[field]
  return Array.isArray(list) ? list : []
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
  if ((err as { status?: unknown }).status !== 409) return false
  return errorMarkers(err, 'publication').includes(PUBLICATION_HELD) || err.message.startsWith('Saved privately for safety review')
}

/**
 * A held version that a reviewer's approval publishes by itself
 * (`errors.publication` also carries `publishes_on_approval`): the author
 * never submits it again, so a composer can start afresh. Without the marker
 * (live sessions, versions held before publishing on approval, or while it is
 * switched off) the author submits the same version again after approval.
 */
export function publishesOnApproval(err: unknown): boolean {
  return isPublicationHeld(err) && errorMarkers(err, 'publication').includes(PUBLISHES_ON_APPROVAL)
}

/**
 * A held profile save still saved its private settings, such as the phone
 * number or biography (`errors.saved: ['private']`): only the public part
 * waits for review.
 */
export function savedPrivateChanges(err: unknown): boolean {
  return isPublicationHeld(err) && errorMarkers(err, 'saved').includes('private')
}
