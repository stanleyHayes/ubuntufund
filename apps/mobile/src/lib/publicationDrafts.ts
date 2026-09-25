import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Unsent public-content versions, per account, so a version held for safety
 * review can be resubmitted unchanged (images included) after approval even if
 * the app was closed. Review records are purged after 30 days, so older drafts
 * are discarded. Storage failures never block a form.
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

export const loadIdentityDraft = (userId: string) => loadDraft('account-identity', userId, value => {
  const draft: IdentityDraft = {}
  for (const field of IDENTITY_FIELDS) if (typeof value[field] === 'string') draft[field] = value[field] as string
  return Object.keys(draft).length ? draft : null
})
export const saveIdentityDraft = (userId: string, draft: IdentityDraft) => saveDraft('account-identity', userId, draft)
export const clearIdentityDraft = (userId: string) => clearDraft('account-identity', userId)
