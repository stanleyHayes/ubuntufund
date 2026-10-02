import { beforeEach, describe, expect, it, vi } from 'vitest'
const { data } = vi.hoisted(() => ({ data: new Map<string, string>() }))
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => { data.set(k, v) }, removeItem: async (k: string) => { data.delete(k) },
  getAllKeys: async () => [...data.keys()], multiRemove: async (keys: string[]) => { keys.forEach(k => data.delete(k)) },
} }))
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }))
import { clearAllPublicationDrafts, clearCampaignDraft, clearIdentityDraft, loadCampaignDraft, loadIdentityDraft, publishesOnApproval, saveCampaignDraft, saveIdentityDraft, savedPrivateChanges, type CampaignDraft } from '../publicationDrafts'
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
  expect(await loadIdentityDraft('ama')).toEqual({ fields: { avatarUrl: 'https://media.example.test/held.jpg', name: 'Ama' }, publishesOnApproval: false })
  await clearIdentityDraft('ama')
  expect(await loadIdentityDraft('ama')).toBeNull()
})

it('remembers whether the approval of a held profile change publishes it', async () => {
  await saveIdentityDraft('ama', { coverUrl: 'https://media.example.test/cover.jpg' }, true)
  expect(await loadIdentityDraft('ama')).toEqual({ fields: { coverUrl: 'https://media.example.test/cover.jpg' }, publishesOnApproval: true })
  // Kept before publishing on approval: the bare fields, never published by an approval.
  data.set('ujimora:publication-draft:account-identity:kofi', JSON.stringify({ savedAt: Date.now(), value: { name: 'Kofi' } }))
  expect(await loadIdentityDraft('kofi')).toEqual({ fields: { name: 'Kofi' }, publishesOnApproval: false })
  // The flag alone is no draft.
  data.set('ujimora:publication-draft:account-identity:esi', JSON.stringify({ savedAt: Date.now(), value: { publishesOnApproval: true } }))
  expect(await loadIdentityDraft('esi')).toBeNull()
})

describe('publishing on approval markers', () => {
  const AUTOMATIC = 'Saved privately for safety review. Your content has not been published yet. It will be published automatically once a reviewer approves it; check Publication reviews for the decision.'
  const MANUAL = 'Saved privately for safety review. Your content has not been published. Keep your draft and check Publication reviews before submitting this same version again.'
  const answer = (status: number, message: string, errors?: Record<string, string[]>) => Object.assign(new Error(message), { status, errors })

  it('tells a hold its approval publishes from one the author submits again', () => {
    expect(publishesOnApproval(answer(409, AUTOMATIC, { publication: ['held', 'publishes_on_approval'] }))).toBe(true)
    expect(publishesOnApproval(answer(409, MANUAL, { publication: ['held'] }))).toBe(false)
    // An API from before publishing on approval: held, by its message, and never automatic.
    expect(publishesOnApproval(answer(409, MANUAL))).toBe(false)
  })

  it('never reads the marker outside a hold', () => {
    expect(publishesOnApproval(answer(422, 'This version was declined in safety review.', { publication: ['publishes_on_approval'] }))).toBe(false)
    expect(publishesOnApproval(answer(409, 'This version is already published.', { publication: ['published'] }))).toBe(false)
    expect(publishesOnApproval({ status: 409, errors: { publication: ['held', 'publishes_on_approval'] }, message: AUTOMATIC })).toBe(false)
    expect(publishesOnApproval(answer(409, AUTOMATIC, { publication: 'held publishes_on_approval' as unknown as string[] }))).toBe(false)
    expect(publishesOnApproval(null)).toBe(false)
  })

  it('reports private settings a held profile save kept', () => {
    expect(savedPrivateChanges(answer(409, AUTOMATIC, { publication: ['held', 'publishes_on_approval'], saved: ['private'] }))).toBe(true)
    expect(savedPrivateChanges(answer(409, MANUAL, { publication: ['held'], saved: ['private'] }))).toBe(true)
    expect(savedPrivateChanges(answer(409, AUTOMATIC, { publication: ['held', 'publishes_on_approval'] }))).toBe(false)
    expect(savedPrivateChanges(answer(400, 'Invalid phone number', { saved: ['private'] }))).toBe(false)
  })
})
