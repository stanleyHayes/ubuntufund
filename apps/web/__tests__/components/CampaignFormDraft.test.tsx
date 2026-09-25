import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { renderHook } from '@testing-library/react'
import { publicationDraftKey, readPublicationDraft, writePublicationDraft, clearAllPublicationDrafts } from '@/lib/publicationDrafts'
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
