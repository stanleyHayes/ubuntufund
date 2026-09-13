import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { CampaignComments } from '@/components/campaigns/CampaignComments'
import { CreateUpdateDialog } from '@/components/campaigns/CreateUpdateDialog'
import { PublicationReviews } from '@/components/account/PublicationReviews'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'author' } }) }))
beforeEach(() => { vi.resetAllMocks(); vi.mocked(api.get).mockResolvedValue({ items: [], total: 0 }) })
it('starts automated screening unchecked and retains a held comment draft', async () => {
  vi.mocked(api.post).mockRejectedValue(new Error('Saved privately for safety review.'))
  render(<ThemeProvider theme={ujimoraTheme}><CampaignComments campaignId="campaign" creatorId="author" /></ThemeProvider>)
  const consent = screen.getByRole('checkbox', { name: /Use OpenAI/ })
  expect(consent).not.toBeChecked()
  fireEvent.change(screen.getByPlaceholderText(/Share encouragement/), { target: { value: 'Proposed public comment' } })
  fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
  await screen.findByText('Saved privately for safety review.')
  expect(api.post).toHaveBeenLastCalledWith('/campaigns/campaign/comments', { content: 'Proposed public comment', automatedReviewConsent: false })
  expect(screen.getByPlaceholderText(/Share encouragement/)).toHaveValue('Proposed public comment')
  fireEvent.click(consent)
  fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
  await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('/campaigns/campaign/comments', { content: 'Proposed public comment', automatedReviewConsent: true }))
})
it('keeps update fields and shows the actual review response instead of a generic failure', async () => {
  const submit = vi.fn().mockRejectedValue(new Error('Saved privately for safety review.'))
  render(<ThemeProvider theme={ujimoraTheme}><CreateUpdateDialog open onClose={() => {}} isLoading={false} onSubmit={submit} /></ThemeProvider>)
  expect(screen.getByRole('checkbox', { name: /Use OpenAI/ })).not.toBeChecked()
  fireEvent.change(screen.getByPlaceholderText('Enter update title'), { target: { value: 'Proposed update' } })
  fireEvent.change(screen.getByPlaceholderText('Write your update here...'), { target: { value: 'The complete proposed update content.' } })
  fireEvent.click(screen.getByRole('button', { name: /Post Update/i }))
  await screen.findByText('Saved privately for safety review.')
  expect(screen.getByPlaceholderText('Enter update title')).toHaveValue('Proposed update')
  expect(submit).toHaveBeenCalledWith(expect.objectContaining({ automatedReviewConsent: false }))
})
it.each([
  { action: 'account.profile', text: JSON.stringify({ name: 'Reviewed public text', country: 'Ghana', publicProfile: true }) },
  { action: 'organization.profile', text: JSON.stringify({ organizationName: 'Reviewed public text', website: 'https://example.test' }) },
  { action: 'creator.profile', text: JSON.stringify({ displayName: 'Ama', bio: 'Reviewed public text', tipsEnabled: false }) },
  { action: 'update.create', text: JSON.stringify(['Approved update', 'Reviewed public text', 'general']) },
  { action: 'campaign.create', text: JSON.stringify({ title: 'Approved campaign', description: 'Reviewed public text', currency: 'GHS', goalAmount: 500 }) },
])('shows readable approved $action evidence and the resubmission instruction', async ({ action, text }) => {
  vi.mocked(api.get).mockResolvedValue({ items: [{ id: 'review', action, text, status: 'approved', reviewNotes: 'Reviewed safely.', approvalExpiresAt: '2026-09-19T00:00:00Z' }], total: 1 })
  render(<ThemeProvider theme={ujimoraTheme}><PublicationReviews /></ThemeProvider>)
  await screen.findByText(/Reviewed public text/)
  expect(screen.getByText(/submit the same version from its original form within seven days/)).toBeInTheDocument()
  expect(screen.getByText(/Review response: Reviewed safely/)).toBeInTheDocument()
})

it.each([[], null, { items: [], total: -1 }, { items: [null], total: 1 }, { items: [{ id: 'bad', action: null, text: '', status: 'pending' }], total: 1 }])('contains malformed review responses and supports retry: %j', async response => {
  vi.mocked(api.get).mockResolvedValueOnce(response).mockResolvedValueOnce({ items: [], total: 0 })
  render(<ThemeProvider theme={ujimoraTheme}><PublicationReviews /></ThemeProvider>)
  await screen.findByText('Could not load publication reviews. Please retry.')
  expect(screen.queryByText('No publication reviews yet.')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh publication reviews' }))
  await screen.findByText('No publication reviews yet.')
})
