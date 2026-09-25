import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { renderHook } from '@testing-library/react'
import { publicationDraftKey, readPublicationDraft, writePublicationDraft, clearAllPublicationDrafts, draftSubmission, clearDraftSubmission } from '@/lib/publicationDrafts'
import { webcrypto } from 'node:crypto'
import { cleanup } from '@testing-library/react'
import { useCreateCampaign } from '@/hooks/useCampaigns'
import { api } from '@/lib/api'
import { installMemoryStorage } from '../memoryStorage'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner', role: 'user' } }) }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() }, ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message) } } }))
vi.mock('@/components/campaigns/AiWritingAssistant', () => ({ default: () => null }))

import { CampaignForm } from '@/components/campaigns/CampaignForm'

beforeEach(() => {
  installMemoryStorage()
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.get).mockImplementation(async (path: string) => path === '/campaigns/creation-options'
    ? { plan: { name: 'Free', maxMediaPerCampaign: 1, campaignCollaboration: false, maxCollaboratorsPerCampaign: 0 }, maxGoal: null, activeCount: 0, totalCount: 0, verificationCampaignLimit: 3, canCreate: true, creationBlockReason: null, canSplit: false, splitEnabled: false }
    : { items: [], total: 0 })
})
afterEach(() => { vi.unstubAllGlobals() })

it('keeps drafts per account, expires them after the review retention window and clears them on sign-out', () => {
  const key = publicationDraftKey('campaign', 'owner')
  writePublicationDraft(key, { title: 'Held title' })
  expect(readPublicationDraft(key, value => value as { title: string })).toEqual({ title: 'Held title' })
  expect(readPublicationDraft(publicationDraftKey('campaign', 'someone-else'), value => value)).toBeNull()
  localStorage.setItem(key, JSON.stringify({ savedAt: Date.now() - 31 * 86_400_000, value: { title: 'Stale' } }))
  expect(readPublicationDraft(key, value => value)).toBeNull()
  expect(localStorage.getItem(key)).toBeNull()
  writePublicationDraft(key, { title: 'Held title' })
  localStorage.setItem('uf_color_mode', 'dark')
  clearAllPublicationDrafts()
  expect(localStorage.getItem(key)).toBeNull()
  expect(localStorage.getItem('uf_color_mode')).toBe('dark')
})

it('restores the exact unsent campaign draft, including the cover, after the page is reopened', async () => {
  writePublicationDraft(publicationDraftKey('campaign', 'owner'), {
    title: 'Clinic roof repair', summary: 'Fix the leaking clinic roof', category: 'medical', description: 'The clinic roof leaks every rainy season.',
    beneficiaries: 'Village clinic', coverImageUrl: 'https://media.example.test/cover.jpg', goalAmount: '5000', currency: 'GHS', endDate: '2099-01-01', priority: 'urgent',
  })
  render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><CampaignForm /></MemoryRouter></ThemeProvider>)
  expect(await screen.findByText(/We restored your unsent draft/)).toBeInTheDocument()
  expect(screen.getByLabelText(/Campaign title/)).toHaveValue('Clinic roof repair')
  fireEvent.click(screen.getByRole('button', { name: 'Start over' }))
  await waitFor(() => expect(screen.getByLabelText(/Campaign title/)).toHaveValue(''))
  await waitFor(() => expect(localStorage.getItem(publicationDraftKey('campaign', 'owner'))).toBeNull())
})

it('sends the Idempotency-Key it is given so a resubmitted version cannot create a duplicate', async () => {
  vi.mocked(api.post).mockResolvedValue({ id: 'campaign-1' })
  const { result } = renderHook(() => useCreateCampaign())
  const payload = { title: 'Title', category: 'medical', description: 'Description text', beneficiaries: ['A'], imageUrls: [], goalAmount: 10, currency: 'GHS', endDate: '2099-01-01T00:00:00.000Z', priority: 'normal' } as unknown as Parameters<typeof result.current.createCampaign>[0]
  await result.current.createCampaign(payload, 'key-0123456789abcdef')
  expect(api.post).toHaveBeenCalledWith('/campaigns', payload, { 'Idempotency-Key': 'key-0123456789abcdef' })
})

// R2-055: the creation key lived only in a ref, so after a lost response and a
// reload the restored draft was resubmitted with a new key and the API created
// a second campaign.
const heldDraft = {
  title: 'Clinic roof repair', summary: 'Fix the leaking clinic roof', category: 'medical', description: 'The clinic roof leaks every rainy season and patients get wet.',
  beneficiaries: 'Village clinic', coverImageUrl: 'https://media.example.test/cover.jpg', goalAmount: '5000', currency: 'GHS', endDate: '2099-01-01', priority: 'urgent',
}

it('keeps one submission key per draft content across page loads, and only a digest of the content', async () => {
  vi.stubGlobal('crypto', webcrypto)
  const draft = publicationDraftKey('campaign', 'owner')
  const first = await draftSubmission(draft, { title: 'Clinic roof repair' }, null)
  // A fresh page load has no in-memory copy: the stored key is reused.
  expect(await draftSubmission(draft, { title: 'Clinic roof repair' }, null)).toEqual(first)
  expect(JSON.stringify(Object.entries(localStorage))).not.toContain('Clinic roof repair')
  const changed = await draftSubmission(draft, { title: 'Clinic roof repair (updated)' }, first)
  expect(changed.key).not.toBe(first.key)
  clearDraftSubmission(draft)
  expect((await draftSubmission(draft, { title: 'Clinic roof repair (updated)' }, null)).key).not.toBe(changed.key)
  // Sign-out removes it with the drafts.
  clearAllPublicationDrafts()
  expect(Object.keys(localStorage)).toEqual([])
  // Without storage the page's own copy still makes a same-page retry safe.
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } })
  const memoryOnly = await draftSubmission(draft, { title: 'T' }, null)
  expect(await draftSubmission(draft, { title: 'T' }, memoryOnly)).toEqual(memoryOnly)
})

it('resubmits a restored draft with the key of the attempt whose response was lost', async () => {
  vi.stubGlobal('crypto', webcrypto)
  writePublicationDraft(publicationDraftKey('campaign', 'owner'), heldDraft)
  vi.mocked(api.post).mockRejectedValue(new Error('Unable to connect to Ujimora. Check your connection and try again.'))
  const submit = async () => {
    render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><CampaignForm /></MemoryRouter></ThemeProvider>)
    expect(await screen.findByText(/We restored your unsent draft/)).toBeInTheDocument()
    for (let step = 0; step < 3; step++) {
      const next = await screen.findByRole('button', { name: 'Continue' })
      await waitFor(() => expect(next).toBeEnabled())
      fireEvent.click(next)
    }
    const publish = await screen.findByRole('button', { name: 'Publish campaign' })
    await waitFor(() => expect(publish).toBeEnabled())
    fireEvent.click(publish)
  }
  await submit()
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
  expect(await screen.findByText(/Unable to connect to Ujimora/)).toBeInTheDocument()
  // The user reloads: a new mount restores the draft and they submit again.
  cleanup()
  await submit()
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2))
  const keys = vi.mocked(api.post).mock.calls.map((call) => (call[2] as Record<string, string>)['Idempotency-Key'])
  expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/)
  expect(keys[1]).toBe(keys[0])
})
