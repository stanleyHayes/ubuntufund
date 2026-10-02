import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import type { PublicationAction, PublicationReviewItem } from '@ubuntu-fund/types'
import { CampaignComments } from '@/components/campaigns/CampaignComments'
import { CreateUpdateDialog } from '@/components/campaigns/CreateUpdateDialog'
import { PublicationReviews } from '@/components/account/PublicationReviews'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'author' } }) }))
beforeEach(() => { vi.resetAllMocks(); vi.mocked(api.get).mockResolvedValue({ items: [], total: 0 }) })
afterEach(() => { vi.restoreAllMocks() })
/** What the API client throws for a change held for safety review. */
const held = () => Object.assign(new Error('Saved privately for safety review.'), { status: 409, errors: { publication: ['held'] } })
/** Held is an expected step: an info status notice, never a red alert. */
async function expectHeldNotice() {
  const notice = (await screen.findByText('Waiting for safety review')).closest('[role="status"]')
  expect(notice).toHaveClass('MuiAlert-colorInfo')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
}
it('starts automated screening unchecked and retains a held comment draft', async () => {
  vi.mocked(api.post).mockRejectedValue(held())
  render(<ThemeProvider theme={ujimoraTheme}><CampaignComments campaignId="campaign" creatorId="author" /></ThemeProvider>)
  const consent = screen.getByRole('checkbox', { name: /Use OpenAI/ })
  expect(consent).not.toBeChecked()
  fireEvent.change(screen.getByPlaceholderText(/Share encouragement/), { target: { value: 'Proposed public comment' } })
  fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
  await expectHeldNotice()
  expect(api.post).toHaveBeenLastCalledWith('/campaigns/campaign/comments', { content: 'Proposed public comment', automatedReviewConsent: false })
  expect(screen.getByPlaceholderText(/Share encouragement/)).toHaveValue('Proposed public comment')
  fireEvent.click(consent)
  fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
  await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('/campaigns/campaign/comments', { content: 'Proposed public comment', automatedReviewConsent: true }))
})
it('keeps update fields and shows the held notice instead of a generic failure', async () => {
  const submit = vi.fn().mockRejectedValue(held())
  render(<ThemeProvider theme={ujimoraTheme}><CreateUpdateDialog open onClose={() => {}} isLoading={false} onSubmit={submit} /></ThemeProvider>)
  expect(screen.getByRole('checkbox', { name: /Use OpenAI/ })).not.toBeChecked()
  fireEvent.change(screen.getByPlaceholderText('Enter update title'), { target: { value: 'Proposed update' } })
  fireEvent.change(screen.getByPlaceholderText('Write your update here...'), { target: { value: 'The complete proposed update content.' } })
  fireEvent.click(screen.getByRole('button', { name: /Post Update/i }))
  await expectHeldNotice()
  expect(screen.getByPlaceholderText('Enter update title')).toHaveValue('Proposed update')
  expect(submit).toHaveBeenCalledWith(expect.objectContaining({ automatedReviewConsent: false }))
})

const IN_A_WEEK = new Date(Date.now() + 7 * 86400000).toISOString()
const review = (fields: Partial<PublicationReviewItem> = {}): PublicationReviewItem => ({
  id: 'review-1', action: 'campaign.create', status: 'pending', text: JSON.stringify({ title: 'Clean water', description: 'Private campaign story' }), ...fields,
})
const serve = (items: PublicationReviewItem[], total = items.length) => vi.mocked(api.get).mockResolvedValue({ items, total })
const renderReviews = (actions?: PublicationAction[]) => render(<ThemeProvider theme={ujimoraTheme}><PublicationReviews actions={actions} /></ThemeProvider>)
/** jsdom has no layout: report every element as taller than it shows, as a clamped note is. */
function overflowNotes(clipped: boolean) {
  vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(clipped ? 96 : 40)
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(40)
}

it.each([
  { action: 'account.profile', text: JSON.stringify({ name: 'Ama Mensah', country: 'Ghana', publicProfile: true }), line: 'Profile · Ama Mensah', hidden: /Ghana|publicProfile/, verb: 'save' },
  { action: 'organization.profile', text: JSON.stringify({ organizationName: 'Helping Hands', website: 'https://private.example.test' }), line: 'Organization details · Helping Hands', hidden: /private\.example/, verb: 'save' },
  { action: 'creator.profile', text: JSON.stringify({ displayName: 'Ama', bio: 'Private biography text', tipsEnabled: false }), line: 'Creator page · Ama', hidden: /Private biography|tipsEnabled/, verb: 'save' },
  { action: 'update.create', text: JSON.stringify(['Roof finished', 'Private update body', 'general']), line: 'Campaign update · Roof finished', hidden: /Private update body|Update type/, verb: 'post' },
  { action: 'campaign.create', text: JSON.stringify({ title: 'Approved campaign', description: 'Private campaign story', currency: 'GHS', goalAmount: 500 }), line: 'New campaign · Approved campaign', hidden: /Private campaign story|goalAmount/, verb: 'submit' },
])('shows an approved $action as a status card, never the submitted content', async ({ action, text, line, hidden, verb }) => {
  serve([review({ id: 'approved-1', action, text, status: 'approved', reviewNotes: 'Reviewed safely.', approvalExpiresAt: IN_A_WEEK })])
  renderReviews()
  const steps = await screen.findByRole('list', { name: 'Review status: Approved' })
  // Each step's state is in words too: its icon is decorative.
  expect(within(steps).getAllByRole('listitem').map(step => step.textContent)).toEqual(['Submitted, done', 'In review, done', 'Approved, done'])
  expect(within(steps).queryByText('In review')?.closest('li')).not.toHaveAttribute('aria-current')
  expect(screen.getByText(line.split(' · ')[0])).toHaveTextContent(line)
  expect(screen.getByText(new RegExp(`^Approved\\. If it isn't public yet, ${verb} it again unchanged before .+\\.$`))).toBeInTheDocument()
  expect(screen.getByText('Reviewed safely.', { exact: false })).toHaveTextContent("Reviewer's note: Reviewed safely.")
  expect(document.body.textContent).not.toMatch(hidden)
  // The reference is for support, and only a declined version needs it.
  expect(screen.queryByText(/approved-1/)).not.toBeInTheDocument()
})

it('marks In review as the current step while a person checks a submission', async () => {
  serve([review({ createdAt: '2026-09-29T08:00:00.000Z' })])
  renderReviews()
  const steps = await screen.findByRole('list', { name: 'Review status: In review' })
  expect(within(steps).getByText('In review').closest('li')).toHaveAttribute('aria-current', 'step')
  const submitted = new Date('2026-09-29T08:00:00.000Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  expect(within(steps).getAllByRole('listitem').map(step => step.textContent)).toEqual([`Submitted${submitted}, done`, 'In review', 'Approved, not yet'])
  expect(screen.getByText('A person is checking it.')).toBeInTheDocument()
  expect(screen.queryByText(/Reviewer's note/)).not.toBeInTheDocument()
})

it('shows a declined version with the note, how to go on and the reference for support', async () => {
  serve([review({ id: 'review-9', status: 'rejected', reviewNotes: 'The story includes a private phone number.' })])
  renderReviews()
  const steps = await screen.findByRole('list', { name: 'Review status: Declined' })
  expect(within(steps).getAllByRole('listitem').map(step => step.textContent)).toEqual(['Submitted, done', 'In review, done', 'Declined'])
  expect(screen.getByText(/private phone number/)).toBeInTheDocument()
  expect(screen.getByText('Declined. Change it before you submit it again.')).toBeInTheDocument()
  expect(screen.getByText('Questions? support@ujimora.com, reference review-9')).toBeInTheDocument()
})

it('tells the author when an approval has expired', async () => {
  serve([review({ action: 'creator.profile', text: JSON.stringify({ displayName: 'Ama' }), status: 'approved', approvalExpiresAt: '2026-01-01T00:00:00.000Z' })])
  renderReviews()
  const steps = await screen.findByRole('list', { name: 'Review status: Approval expired' })
  expect(within(steps).getByText('Approved').closest('li')).toHaveTextContent('ApprovedExpired, done')
  expect(screen.getByText("Approval expired. If it isn't public yet, save it again to request a new review.")).toBeInTheDocument()
})

it('clamps a long reviewer note to two lines until the author asks for the rest', async () => {
  overflowNotes(true)
  const note = 'The cover image shows a child’s face and school uniform. Replace it with a photo that does not identify a minor, then submit the page again for review.'
  serve([review({ status: 'rejected', reviewNotes: note })])
  renderReviews()
  const more = await screen.findByRole('button', { name: 'Show more' })
  expect(more).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByText(note, { exact: false }).id).toBe(more.getAttribute('aria-controls'))
  fireEvent.click(more)
  expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Show less' }))
  expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument()
})

it('offers no toggle for a note that fits', async () => {
  overflowNotes(false)
  serve([review({ status: 'rejected', reviewNotes: 'Too short to clamp.' })])
  renderReviews()
  await screen.findByText(/Too short to clamp/)
  expect(screen.queryByRole('button', { name: /Show (more|less)/ })).not.toBeInTheDocument()
})

it('lists only the form’s own kinds from the latest submissions and points to Settings for older ones', async () => {
  serve([
    review({ id: 'mine', action: 'live.start', text: JSON.stringify(['Friday fundraiser', 500]) }),
    review({ id: 'other', action: 'campaign.create' }),
  ], 140)
  renderReviews(['live.start'])
  expect(await screen.findByText('Live session title')).toHaveTextContent('Live session title · Friday fundraiser')
  expect(api.get).toHaveBeenCalledWith('/publication-reviews?page=1&pageSize=100')
  expect(screen.queryByText('New campaign')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /See all in Settings/ })).toHaveAttribute('href', '/settings#privacy')
  expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
})

it('says nothing is waiting when none of the form’s kinds are listed', async () => {
  serve([review({ action: 'comment.create', text: JSON.stringify({ comment: 'Hi' }) })])
  renderReviews(['creator.profile'])
  expect(await screen.findByText('Nothing waiting for review.')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /See all in Settings/ })).not.toBeInTheDocument()
})

it('pages through every kind in Settings', async () => {
  serve(Array.from({ length: 25 }, (_, index) => review({ id: `review-${index}` })), 30)
  renderReviews()
  await screen.findAllByRole('list', { name: 'Review status: In review' })
  expect(api.get).toHaveBeenLastCalledWith('/publication-reviews?page=1')
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/publication-reviews?page=2'))
})

it('keeps the page controls on a later page after the list shrank', async () => {
  serve(Array.from({ length: 25 }, (_, index) => review({ id: `review-${index}` })), 30)
  renderReviews()
  await screen.findAllByRole('list', { name: 'Review status: In review' })
  serve([], 20)
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  expect(await screen.findByText('Nothing waiting for review.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled()
})

it('shows no page controls when everything fits on one page', async () => {
  serve([review()])
  renderReviews()
  await screen.findByRole('list', { name: 'Review status: In review' })
  expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
})

it.each([[], null, { items: [], total: -1 }, { items: [null], total: 1 }, { items: [{ id: 'bad', action: null, text: '', status: 'pending' }], total: 1 }])('contains malformed review responses and supports retry: %j', async response => {
  vi.mocked(api.get).mockResolvedValueOnce(response).mockResolvedValueOnce({ items: [], total: 0 })
  render(<ThemeProvider theme={ujimoraTheme}><PublicationReviews /></ThemeProvider>)
  await screen.findByText('Could not load your publication reviews. Select Refresh to try again.')
  expect(screen.queryByText('Nothing waiting for review.')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh publication reviews' }))
  await screen.findByText('Nothing waiting for review.')
})
