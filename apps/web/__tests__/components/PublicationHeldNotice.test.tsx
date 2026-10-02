import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { CampaignComments } from '@/components/campaigns/CampaignComments'
import { CreateUpdateDialog } from '@/components/campaigns/CreateUpdateDialog'
import { PublicationHeldNotice } from '@/components/safety/PublicationHeldNotice'
import { isPublicationHeld, publicationHold, publishesOnApproval } from '@/lib/publicationDrafts'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'author' } }) }))

const MESSAGE = 'Saved privately for safety review. Your content has not been published. Keep your draft and check Publication reviews before submitting this same version again.'
/** The API's hold when the approval publishes the version by itself. */
const AUTOMATIC = 'Saved privately for safety review. Your content has not been published yet. It will be published automatically once a reviewer approves it; check Publication reviews for the decision.'
/** The shape the API client throws: an Error carrying `status` and `errors`. */
const apiError = (status: number, message: string, errors?: Record<string, string[]>) => Object.assign(new Error(message), { status, errors })
const heldAutomatically = (errors: Record<string, string[]> = {}) => apiError(409, AUTOMATIC, { ...errors, publication: ['held', 'publishes_on_approval'] })
/** The notice's whole text, once it has filled its live region. */
async function noticeText() {
  return (await screen.findByText('Waiting for safety review')).closest('[role="status"]')?.textContent
}

it('mounts an empty live region and fills that same region, so screen readers announce it', async () => {
  render(<ThemeProvider theme={ujimoraTheme}><PublicationHeldNotice /></ThemeProvider>)
  const region = screen.getByRole('status')
  expect(region).toHaveAttribute('aria-live', 'polite')
  expect(region).not.toHaveTextContent(/\S/)
  expect(await within(region).findByText('Waiting for safety review')).toBeInTheDocument()
  expect(screen.getByRole('status')).toBe(region)
})

describe('isPublicationHeld', () => {
  it('recognises the held marker and the message from an API without the marker', () => {
    expect(isPublicationHeld(apiError(409, MESSAGE, { publication: ['held'] }))).toBe(true)
    expect(isPublicationHeld(apiError(409, 'Reworded message', { publication: ['held'] }))).toBe(true)
    expect(isPublicationHeld(apiError(409, MESSAGE))).toBe(true)
  })
  it('leaves declined versions, other conflicts and non-API errors as errors', () => {
    expect(isPublicationHeld(apiError(422, 'This version was declined in safety review.'))).toBe(false)
    expect(isPublicationHeld(apiError(409, 'That handle is taken.'))).toBe(false)
    expect(isPublicationHeld(apiError(409, 'That handle is taken.', { handle: ['taken'] }))).toBe(false)
    expect(isPublicationHeld(new Error(MESSAGE))).toBe(false)
    expect(isPublicationHeld({ status: 409, message: MESSAGE })).toBe(false)
    expect(isPublicationHeld(null)).toBe(false)
  })
})

describe('publishesOnApproval', () => {
  it('recognises a hold its approval publishes by itself', () => {
    expect(publishesOnApproval(heldAutomatically())).toBe(true)
    expect(publishesOnApproval(apiError(409, 'Reworded message', { publication: ['held', 'publishes_on_approval'] }))).toBe(true)
  })
  it('leaves holds their author publishes, and anything that is not a hold, as they were', () => {
    expect(publishesOnApproval(apiError(409, MESSAGE, { publication: ['held'] }))).toBe(false)
    // An API from before the marker, known by its message only.
    expect(publishesOnApproval(apiError(409, MESSAGE))).toBe(false)
    expect(publishesOnApproval(apiError(409, 'This version is already published.', { publication: ['published'] }))).toBe(false)
    expect(publishesOnApproval(apiError(409, 'Not a hold.', { publication: ['publishes_on_approval'] }))).toBe(false)
    expect(publishesOnApproval(apiError(422, AUTOMATIC, { publication: ['held', 'publishes_on_approval'] }))).toBe(false)
    expect(publishesOnApproval(Object.assign(new Error(AUTOMATIC), { errors: { publication: ['held', 'publishes_on_approval'] } }))).toBe(false)
    expect(publishesOnApproval(null)).toBe(false)
  })
})

describe('publicationHold', () => {
  it('says how a hold gets published and whether the rest of the save went through', () => {
    expect(publicationHold(heldAutomatically({ saved: ['private'] }))).toEqual({ publishesOnApproval: true, savedOtherChanges: true })
    expect(publicationHold(heldAutomatically())).toEqual({ publishesOnApproval: true, savedOtherChanges: false })
    expect(publicationHold(apiError(409, MESSAGE, { publication: ['held'], saved: ['private'] }))).toEqual({ publishesOnApproval: false, savedOtherChanges: true })
    expect(publicationHold(apiError(409, MESSAGE))).toEqual({ publishesOnApproval: false, savedOtherChanges: false })
  })
  it('is null for anything that is not a hold', () => {
    expect(publicationHold(apiError(422, 'This version was declined in safety review.'))).toBeNull()
    expect(publicationHold(apiError(409, 'This version is already published.', { publication: ['published'] }))).toBeNull()
    expect(publicationHold(apiError(409, 'Saved, nothing held.', { saved: ['private'] }))).toBeNull()
    expect(publicationHold(undefined)).toBeNull()
  })
})

describe('the held notice', () => {
  const show = (props: Parameters<typeof PublicationHeldNotice>[0]) => render(<ThemeProvider theme={ujimoraTheme}><PublicationHeldNotice {...props} /></ThemeProvider>)
  it('says the approval publishes it, that nothing needs submitting again, and that it can be withdrawn', async () => {
    show({ publishesOnApproval: true, retry: 'post it again unchanged', reviews: 'below' })
    expect(await noticeText()).toBe("Waiting for safety reviewSaved privately for safety review. It isn't public yet. Once a reviewer approves it, it's published automatically, so you don't need to submit it again. Check Publication reviews below for the decision; you can withdraw it there.")
  })
  it('links to Publication reviews when they are elsewhere', async () => {
    show({ publishesOnApproval: true })
    expect(await noticeText()).toMatch(/so you don't need to submit it again\. Check Publication reviews for the decision \(opens in a new tab\)\. You can withdraw it there\.$/)
    expect(screen.getByRole('link', { name: /Check Publication reviews/ })).toHaveAttribute('href', '/settings#privacy')
  })
  it('keeps the words of the form that publishes it', async () => {
    show({ publishesOnApproval: true, whenApproved: "we email it to your donors automatically, so you don't need to send it again", reviews: 'above' })
    expect(await noticeText()).toContain("Once a reviewer approves it, we email it to your donors automatically, so you don't need to send it again. Check Publication reviews above for the decision; you can withdraw it there.")
  })
  it('says how to publish it after approval otherwise, as before', async () => {
    show({ retry: 'post it again unchanged', reviews: 'above' })
    expect(await noticeText()).toBe('Waiting for safety reviewSaved privately for safety review. This version is not public yet. After a reviewer approves it, post it again unchanged to publish it. Check Publication reviews above for the decision.')
  })
  it('says first that the rest of the save went through', async () => {
    show({ publishesOnApproval: true, savedOtherChanges: true, reviews: 'below' })
    expect(await noticeText()).toMatch(/^Waiting for safety reviewYour other changes are saved\. Saved privately for safety review\. It isn't public yet\./)
  })
})

beforeEach(() => { vi.resetAllMocks(); vi.mocked(api.get).mockResolvedValue({ items: [], total: 0 }) })

it('shows a held comment as an informational status, not an error, and keeps the draft', async () => {
  vi.mocked(api.post).mockRejectedValue(apiError(409, MESSAGE, { publication: ['held'] }))
  render(<ThemeProvider theme={ujimoraTheme}><CampaignComments campaignId="campaign" creatorId="author" /></ThemeProvider>)
  fireEvent.change(screen.getByPlaceholderText(/Share encouragement/), { target: { value: 'Proposed public comment' } })
  fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
  // A polite status region; loading indicators can be other status regions.
  const notice = (await screen.findByText('Waiting for safety review')).closest('[role="status"]')
  expect(notice).toHaveTextContent(/Saved privately for safety review/)
  expect(notice).toHaveClass('MuiAlert-colorInfo')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Check Publication reviews/ })).toHaveAttribute('href', '/settings#privacy')
  expect(screen.getByPlaceholderText(/Share encouragement/)).toHaveValue('Proposed public comment')
})

it('still shows a declined comment as an error', async () => {
  vi.mocked(api.post).mockRejectedValue(apiError(422, 'This version was declined in safety review.'))
  render(<ThemeProvider theme={ujimoraTheme}><CampaignComments campaignId="campaign" creatorId="author" /></ThemeProvider>)
  fireEvent.change(screen.getByPlaceholderText(/Share encouragement/), { target: { value: 'Proposed public comment' } })
  fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('This version was declined in safety review.')
  expect(screen.queryByText('Waiting for safety review')).not.toBeInTheDocument()
})

it('shows a held campaign update as an informational status and keeps its fields', async () => {
  const submit = vi.fn().mockRejectedValue(apiError(409, MESSAGE))
  render(<ThemeProvider theme={ujimoraTheme}><CreateUpdateDialog open onClose={() => {}} isLoading={false} onSubmit={submit} /></ThemeProvider>)
  fireEvent.change(screen.getByPlaceholderText('Enter update title'), { target: { value: 'Proposed update' } })
  fireEvent.change(screen.getByPlaceholderText('Write your update here...'), { target: { value: 'The complete proposed update content.' } })
  fireEvent.click(screen.getByRole('button', { name: /Post Update/i }))
  const notice = (await screen.findByText('Waiting for safety review')).closest('[role="status"]')
  expect(notice).toHaveClass('MuiAlert-colorInfo')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByPlaceholderText('Enter update title')).toHaveValue('Proposed update')
})

it('starts the comment composer afresh when its approval will post the held comment', async () => {
  vi.mocked(api.post).mockRejectedValue(heldAutomatically())
  render(<ThemeProvider theme={ujimoraTheme}><CampaignComments campaignId="campaign" creatorId="owner" /></ThemeProvider>)
  const composer = screen.getByPlaceholderText(/Share encouragement/)
  fireEvent.change(composer, { target: { value: 'Proposed public comment' } })
  const consent = screen.getByRole('checkbox', { name: /Use OpenAI/ })
  fireEvent.click(consent)
  fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
  expect(await noticeText()).toContain("Once a reviewer approves it, it's published automatically, so you don't need to submit it again.")
  expect(screen.getByText(/You can withdraw it there/)).toBeInTheDocument()
  expect(composer).toHaveValue('')
  expect(consent).not.toBeChecked()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(api.post).toHaveBeenCalledExactlyOnceWith('/campaigns/campaign/comments', { content: 'Proposed public comment', automatedReviewConsent: true })
})

it('lists a comment once when posting it again returns the one its approval already posted', async () => {
  const posted = { id: 'comment-1', campaignId: 'campaign', authorId: 'author', authorName: 'Reader', content: 'Thank you all', createdAt: '2026-10-01T10:00:00.000Z' }
  vi.mocked(api.get).mockResolvedValue({ items: [posted] })
  vi.mocked(api.post).mockResolvedValue(posted)
  render(<ThemeProvider theme={ujimoraTheme}><CampaignComments campaignId="campaign" creatorId="owner" /></ThemeProvider>)
  await screen.findByText('Thank you all', { selector: 'p' })
  const composer = screen.getByPlaceholderText(/Share encouragement/)
  fireEvent.change(composer, { target: { value: 'Thank you all' } })
  fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
  await waitFor(() => expect(composer).toHaveValue(''))
  expect(screen.getAllByText('Thank you all', { selector: 'p' })).toHaveLength(1)
})

it('closes out the update form when its approval will post the held update', async () => {
  const submit = vi.fn().mockRejectedValue(heldAutomatically())
  const close = vi.fn()
  render(<ThemeProvider theme={ujimoraTheme}><CreateUpdateDialog open onClose={close} isLoading={false} onSubmit={submit} /></ThemeProvider>)
  fireEvent.change(screen.getByPlaceholderText('Enter update title'), { target: { value: 'Proposed update' } })
  fireEvent.change(screen.getByPlaceholderText('Write your update here...'), { target: { value: 'The complete proposed update content.' } })
  fireEvent.click(screen.getByRole('button', { name: /Post Update/i }))
  expect(await noticeText()).toContain("so you don't need to submit it again. Check Publication reviews for the decision (opens in a new tab). You can withdraw it there.")
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  // Nothing left to post: the form makes way for the notice.
  expect(screen.queryByPlaceholderText('Enter update title')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Post Update/i })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(close).toHaveBeenCalledOnce()
  // Opened again (it stays mounted here), it starts empty.
  expect(screen.getByPlaceholderText('Enter update title')).toHaveValue('')
  expect(screen.getByPlaceholderText('Write your update here...')).toHaveValue('')
})
