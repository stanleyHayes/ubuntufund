import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { webcrypto } from 'node:crypto'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { publicationDraftKey, writePublicationDraft } from '@/lib/publicationDrafts'
import { CAMPAIGN_SCREENING_NOTE, pendingReviewMessage } from '@/lib/campaignReview'
import { api } from '@/lib/api'
import { installMemoryStorage } from '../memoryStorage'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner', role: 'user' } }) }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() }, ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message) } } }))
vi.mock('@/components/campaigns/AiWritingAssistant', () => ({ default: () => null }))

import { CampaignForm } from '@/components/campaigns/CampaignForm'

const draft = {
  title: 'Clinic roof repair', category: 'medical', description: 'The clinic roof leaks every rainy season and patients get wet.',
  beneficiaries: 'Village clinic', coverImageUrl: 'https://media.example.test/cover.jpg', goalAmount: '5000', currency: 'GHS', endDate: '2099-01-01', priority: 'urgent',
}

// The success screen opens the payout section straight away. Answer its reads
// as the API does, so that section loads instead of crashing the screen.
function otherRead(path: string): unknown {
  if (path === '/payout-accounts') return { accounts: [] }
  if (path.endsWith('/payout-options')) return { eligible: 0, currency: 'GHS', fees: { earlyMaxWithdrawalPercent: 80, earlyFeePercent: 1, earlyMinFee: 20 }, recipient: null }
  if (path.endsWith('/payouts') || path.startsWith('/banks')) return []
  return { items: [], total: 0 }
}

beforeEach(() => {
  installMemoryStorage()
  vi.stubGlobal('crypto', webcrypto)
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.get).mockImplementation(async (path: string) => path === '/campaigns/creation-options'
    ? { plan: { name: 'Free', maxMediaPerCampaign: 1, campaignCollaboration: false, maxCollaboratorsPerCampaign: 0 }, maxGoal: null, activeCount: 0, totalCount: 0, verificationCampaignLimit: 3, canCreate: true, creationBlockReason: null, canSplit: false, splitEnabled: false }
    : otherRead(path))
  writePublicationDraft(publicationDraftKey('campaign', 'owner'), draft)
})
afterEach(() => { vi.unstubAllGlobals() })

async function publish() {
  render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><CampaignForm /></MemoryRouter></ThemeProvider>)
  for (let step = 0; step < 3; step++) {
    const next = await screen.findByRole('button', { name: 'Continue' })
    await waitFor(() => expect(next).toBeEnabled())
    fireEvent.click(next)
  }
  // Before publishing, the form says what happens with and without automated screening.
  expect(screen.getByText(CAMPAIGN_SCREENING_NOTE)).toBeInTheDocument()
  expect(screen.queryByText(/Check Settings → Publication reviews/)).not.toBeInTheDocument()
  const button = await screen.findByRole('button', { name: 'Publish campaign' })
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.click(button)
}

it('says a campaign with new media is saved and goes live after a person on the team checks it', async () => {
  vi.mocked(api.post).mockResolvedValue({ id: 'campaign-7', status: 'pending_review', contentReviewReason: 'new_media' })
  await publish()
  expect(await screen.findByText('Clinic roof repair is saved')).toBeInTheDocument()
  expect(screen.getByText('Saved · Pending review')).toBeInTheDocument()
  expect(screen.getByText(pendingReviewMessage('new_media'))).toBeInTheDocument()
  expect(screen.getByText(/A person on our team checks new photos and videos/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'View campaign' })).toHaveAttribute('href', '/campaigns/campaign-7')
  expect(screen.getByRole('link', { name: 'Go to my campaigns' })).toHaveAttribute('href', '/my-campaigns')
  // Not public yet: nothing to share, and neither a "held" notice nor an error.
  expect(screen.queryByRole('button', { name: /^Share/ })).not.toBeInTheDocument()
  expect(screen.queryByText(/Waiting for safety review|couldn.t publish/i)).not.toBeInTheDocument()
  expect(localStorage.getItem(publicationDraftKey('campaign', 'owner'))).toBeNull()
  expect(api.post).toHaveBeenCalledTimes(1)
})

it('keeps the live message and sharing for a campaign that passed screening', async () => {
  vi.mocked(api.post).mockResolvedValue({ id: 'campaign-8', status: 'active' })
  await publish()
  expect(await screen.findByText('Your campaign is live. Share it with your community.')).toBeInTheDocument()
  expect(screen.getByText('Clinic roof repair is on its way')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Share Clinic roof repair' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Explore campaigns' })).toHaveAttribute('href', '/explore')
  expect(screen.queryByRole('link', { name: 'Go to my campaigns' })).not.toBeInTheDocument()
})

it.each([
  ['no_screening_consent', /You chose not to use automated screening/],
  ['screening_flagged', /Our automated check asked for a person/],
  ['screening_unavailable', /Our automated check was not available/],
] as const)('explains the %s reason without promising a review time', (reason, text) => {
  const message = pendingReviewMessage(reason)
  expect(message).toMatch(/^Your campaign is saved and goes live after our team reviews it\./)
  expect(message).toMatch(text)
  expect(message).toMatch(/stays private and cannot take donations/)
  expect(message).not.toMatch(/\b(hours?|days?|minutes?|soon|shortly)\b/i)
})

it('keeps the general message for campaigns waiting for other reasons, and copes with an unknown reason', () => {
  expect(pendingReviewMessage()).toBe('Your campaign is awaiting review. You can share it once it is live.')
  expect(pendingReviewMessage('a_future_reason')).toBe('Your campaign is saved and goes live after our team reviews it. Until then it stays private and cannot take donations. We will notify you when it has been reviewed.')
})

it('shows the neutral held notice, not a failure, while an older API still holds new campaigns', async () => {
  // Before the 30 September 2026 API is live, a held creation answers 409 `held`.
  const held = Object.assign(new Error('Saved privately for safety review. Your content has not been published.'), { status: 409, errors: { publication: ['held'] } })
  vi.mocked(api.post).mockRejectedValue(held)
  await publish()
  expect(await screen.findByText('Waiting for safety review')).toBeInTheDocument()
  expect(screen.queryByText(/We couldn.t publish your campaign/)).not.toBeInTheDocument()
  // The draft is kept so the same version can be sent again after approval.
  expect(localStorage.getItem(publicationDraftKey('campaign', 'owner'))).not.toBeNull()
})

it('says collaborator invitations to a campaign waiting for its check are saved, not sent', async () => {
  vi.mocked(api.get).mockImplementation(async (path: string) => path === '/campaigns/creation-options'
    ? { plan: { name: 'Pro', maxMediaPerCampaign: 1, campaignCollaboration: true, maxCollaboratorsPerCampaign: 3 }, maxGoal: null, activeCount: 0, totalCount: 0, verificationCampaignLimit: 3, canCreate: true, creationBlockReason: null, canSplit: false, splitEnabled: false }
    : otherRead(path))
  vi.mocked(api.post).mockImplementation(async (path: string) => path === '/campaigns'
    ? { id: 'campaign-9', status: 'pending_review', contentReviewReason: 'new_media' }
    : { id: 'collaboration-1', status: 'pending' })
  render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><CampaignForm /></MemoryRouter></ThemeProvider>)
  for (let step = 0; step < 3; step++) {
    const next = await screen.findByRole('button', { name: 'Continue' })
    await waitFor(() => expect(next).toBeEnabled())
    fireEvent.click(next)
  }
  fireEvent.change(await screen.findByLabelText(/Invite collaborators by email/), { target: { value: 'editor@example.com' } })
  const button = await screen.findByRole('button', { name: 'Publish campaign' })
  await waitFor(() => expect(button).toBeEnabled())
  fireEvent.click(button)
  expect(await screen.findByText('Your collaborator invitation is saved and will be sent once our team has checked the campaign.')).toBeInTheDocument()
  // The API records it (and sends it after approval); the form does not report a failure.
  expect(api.post).toHaveBeenCalledWith('/campaigns/campaign-9/collaborators/invite', expect.objectContaining({ userEmail: 'editor@example.com' }))
  expect(screen.queryByText(/Campaign created, but/)).not.toBeInTheDocument()
  // Still shown once the payout section below it has loaded.
  expect(await screen.findByText(/eligible balance/)).toBeInTheDocument()
  expect(screen.getByText('Your collaborator invitation is saved and will be sent once our team has checked the campaign.')).toBeInTheDocument()
})

it('asks for a goal in whole pesewas, as it is stored', async () => {
  writePublicationDraft(publicationDraftKey('campaign', 'owner'), { ...draft, goalAmount: '500.555' })
  render(<ThemeProvider theme={ujimoraTheme}><MemoryRouter><CampaignForm /></MemoryRouter></ThemeProvider>)
  for (let step = 0; step < 2; step++) {
    const next = await screen.findByRole('button', { name: 'Continue' })
    await waitFor(() => expect(next).toBeEnabled())
    fireEvent.click(next)
  }
  fireEvent.blur(await screen.findByLabelText(/Goal amount/))
  expect(await screen.findByText('Use at most two decimal places')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
})
