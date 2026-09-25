import { beforeEach, expect, it, vi } from 'vitest'
const { data } = vi.hoisted(() => ({ data: new Map<string, string>() }))
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => { data.set(k, v) }, removeItem: async (k: string) => { data.delete(k) },
  getAllKeys: async () => [...data.keys()], multiRemove: async (keys: string[]) => { keys.forEach(k => data.delete(k)) },
} }))
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }))
import { clearAllPublicationDrafts, clearCampaignDraft, clearIdentityDraft, loadCampaignDraft, loadIdentityDraft, saveCampaignDraft, saveIdentityDraft, type CampaignDraft } from '../publicationDrafts'
import { creationRequestKey } from '../campaignCreationKey'

const draft: CampaignDraft = { title: 'Clinic roof', description: 'The roof leaks.', category: 'medical', priority: 'urgent', beneficiaries: 'Clinic', cover: 'https://media.example.test/cover.jpg', amount: '5000', end: '2099-01-01' }
beforeEach(() => { data.clear() })

it('restores the exact draft for the same account only and clears it after creation', async () => {
  await saveCampaignDraft('ama', draft)
  expect(await loadCampaignDraft('ama')).toEqual(draft)
  expect(await loadCampaignDraft('kofi')).toBeNull()
  await clearCampaignDraft('ama')
  expect(await loadCampaignDraft('ama')).toBeNull()
})

it('discards drafts older than the review retention window, malformed drafts and all drafts on sign-out', async () => {
  data.set('ujimora:publication-draft:campaign:ama', JSON.stringify({ savedAt: Date.now() - 31 * 86_400_000, value: draft }))
  expect(await loadCampaignDraft('ama')).toBeNull()
  expect(data.size).toBe(0)
  data.set('ujimora:publication-draft:campaign:ama', '{not json')
  expect(await loadCampaignDraft('ama')).toBeNull()
  await saveCampaignDraft('ama', draft); await saveCampaignDraft('kofi', draft); await saveIdentityDraft('ama', { avatarUrl: 'https://x.test/a.jpg' }); data.set('uf_user', '{}')
  await clearAllPublicationDrafts()
  expect([...data.keys()]).toEqual(['uf_user'])
})

it('reuses the Idempotency-Key for the same payload and starts a new one when it changes', () => {
  const first = creationRequestKey(null, { title: 'A' })
  expect(creationRequestKey(first, { title: 'A' })).toBe(first)
  const changed = creationRequestKey(first, { title: 'B' })
  expect(changed.key).not.toBe(first.key)
  expect(changed.key).toMatch(/^[a-zA-Z0-9_-]{16,100}$/)
})

it('keeps only the held public identity fields for a profile save', async () => {
  await saveIdentityDraft('ama', { avatarUrl: 'https://media.example.test/held.jpg', name: 'Ama' })
  expect(await loadIdentityDraft('ama')).toEqual({ avatarUrl: 'https://media.example.test/held.jpg', name: 'Ama' })
  await clearIdentityDraft('ama')
  expect(await loadIdentityDraft('ama')).toBeNull()
})
