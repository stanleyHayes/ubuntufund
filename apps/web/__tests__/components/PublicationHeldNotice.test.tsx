import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { CampaignComments } from '@/components/campaigns/CampaignComments'
import { CreateUpdateDialog } from '@/components/campaigns/CreateUpdateDialog'
import { isPublicationHeld } from '@/lib/publicationDrafts'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'author' } }) }))

const MESSAGE = 'Saved privately for safety review. Your content has not been published. Keep your draft and check Publication reviews before submitting this same version again.'
/** The shape the API client throws: an Error carrying `status` and `errors`. */
const apiError = (status: number, message: string, errors?: Record<string, string[]>) => Object.assign(new Error(message), { status, errors })

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
