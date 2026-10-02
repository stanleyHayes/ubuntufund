import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { webcrypto } from 'node:crypto'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import type { DonorThankYouState, DonorThankYouView } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('@/lib/seo', () => ({ useSeo: vi.fn() }))
vi.mock('@/hooks/useCampaigns', () => ({
  useCampaign: () => ({ campaign: { id: 'c1', title: 'Clinic roof repair' }, isLoading: false, error: null, refresh: () => {} }),
}))

import { ThankDonorsPage } from '@/pages/ThankDonorsPage'

const draftContent = { subject: 'Thank you', body: 'Your gifts fixed the clinic roof. Thank you all.', signature: 'Ama' }
function view(over: Partial<DonorThankYouView> = {}): DonorThankYouView {
  return {
    id: 't1', campaignId: 'c1', status: 'draft', authorRole: 'manager', ...draftContent,
    recipientCount: 0, sentCount: 0, failedCount: 0, skippedCount: 0, retryableCount: 0, updatedAt: '2026-09-29T10:00:00.000Z', ...over,
  }
}
function state(over: Partial<DonorThankYouState> = {}): DonorThankYouState {
  return { eligible: true, trigger: 'campaign_ended', estimatedRecipients: 12, sendsUsed: 0, sendsAllowed: 1, history: [], ...over }
}
const renderPage = () => render(
  <ThemeProvider theme={ujimoraTheme}>
    <MemoryRouter initialEntries={['/campaigns/c1/thank-you']}>
      <Routes><Route path="/campaigns/:id/thank-you" element={<ThankDonorsPage />} /></Routes>
    </MemoryRouter>
  </ThemeProvider>,
)
const sendCalls = () => vi.mocked(api.post).mock.calls.filter(([path]) => path === '/campaigns/c1/thank-you/send')
const pollCalls = () => vi.mocked(api.get).mock.calls.filter(([path]) => path === '/campaigns/c1/thank-you/t1').length
/**
 * Moves the fake clock until the page has read the delivery progress `times`
 * times. Its poll starts in an effect after the first paint, so the first
 * step may only start it. (waitFor cannot be used: its timeout is on the same clock.)
 */
async function untilPolled(times = 1) {
  for (let step = 0; step < 10 && pollCalls() < times; step++) {
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
  }
  expect(pollCalls()).toBeGreaterThanOrEqual(times)
}

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
  for (const method of ['get', 'post', 'put', 'delete'] as const) vi.mocked(api[method]).mockReset()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('explains in plain words why a thank-you cannot be sent yet', async () => {
  vi.mocked(api.get).mockResolvedValue(state({ eligible: false, reason: 'not_ended', trigger: undefined, estimatedRecipients: 3 }))
  renderPage()
  expect(await screen.findByText(/You can thank donors once the campaign has ended or a payout has been paid/)).toBeInTheDocument()
  expect(screen.queryByLabelText('Subject')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Send to donors' })).not.toBeInTheDocument()
})

it('saves, previews and sends the draft with a fresh Idempotency-Key per click', async () => {
  vi.mocked(api.get).mockResolvedValueOnce(state({ draft: view() }))
    .mockResolvedValue(state({ eligible: false, reason: 'limit_reached', sendsUsed: 1, history: [view({ status: 'queued', submittedAt: '2026-09-29T11:00:00.000Z' })] }))
  vi.mocked(api.put).mockImplementation(async (_path, body) => view(body as object))
  vi.mocked(api.post).mockImplementation(async (path: string) => {
    if (path.endsWith('/preview')) return { subject: 'Thank you, friends', text: 'Your gifts fixed the clinic roof. Thank you all.\n\n— Ama\n\nYou are receiving this because you gave.' }
    if (path.endsWith('/send')) return view({ status: 'queued', subject: 'Thank you, friends', submittedAt: '2026-09-29T11:00:00.000Z' })
    return null
  })
  renderPage()
  expect(await screen.findByLabelText('Subject')).toHaveValue('Thank you')
  expect(screen.getByText('About 12 donors will receive this privately — they are emailed by Ujimora and you will not see their names or addresses.')).toBeInTheDocument()
  expect(screen.getByText('9/120')).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Thank you, friends' } })
  expect(screen.getByText('18/120')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
  expect(await screen.findByText('Draft saved.')).toBeInTheDocument()
  expect(api.put).toHaveBeenCalledWith('/campaigns/c1/thank-you/draft', { ...draftContent, subject: 'Thank you, friends' })

  fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
  const preview = await screen.findByRole('dialog', { name: 'Preview' })
  expect(within(preview).getByText('Thank you, friends')).toBeInTheDocument()
  expect(within(preview).getByText(/You are receiving this because you gave\./)).toBeInTheDocument()
  expect(api.post).toHaveBeenCalledWith('/campaigns/c1/thank-you/preview', { ...draftContent, subject: 'Thank you, friends' })
  fireEvent.click(within(preview).getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Preview' })).not.toBeInTheDocument())

  // When the API returns the branded email, it is shown in a locked-down frame.
  vi.mocked(api.post).mockImplementationOnce(async () => ({ subject: 'Thank you, friends', text: 'plain', html: '<p>Branded thank-you</p>' }))
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
  const branded = await screen.findByRole('dialog', { name: 'Preview' })
  const frame = within(branded).getByTitle('Email preview')
  expect(frame).toHaveAttribute('sandbox', '')
  expect(frame).toHaveAttribute('srcdoc', '<p>Branded thank-you</p>')
  fireEvent.click(within(branded).getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Preview' })).not.toBeInTheDocument())

  fireEvent.click(screen.getByRole('checkbox', { name: /Use OpenAI to check this public text/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Send to donors' }))
  const confirm = await screen.findByRole('dialog', { name: 'Send your thank-you?' })
  expect(within(confirm).getByText(/You can send a thank-you only once for this campaign/)).toBeInTheDocument()
  expect(sendCalls()).toHaveLength(0)
  fireEvent.click(within(confirm).getByRole('button', { name: 'Send now' }))

  expect(await screen.findByText(/Your thank-you is on its way/)).toBeInTheDocument()
  expect(sendCalls()).toEqual([['/campaigns/c1/thank-you/send', { automatedReviewConsent: true }, { 'Idempotency-Key': expect.stringMatching(/^[0-9a-f-]{36}$/) }]])
  // Already saved, so the send did not save it again.
  expect(api.put).toHaveBeenCalledTimes(1)
  expect(await screen.findByText('This campaign has already sent its thank-you message.')).toBeInTheDocument()
  expect(screen.getByText('Queued. Delivery starts in a moment.')).toBeInTheDocument()
})

it('retries a lost send with the same key, and uses a new key for a new click', async () => {
  vi.mocked(api.get).mockResolvedValue(state({ draft: view() }))
  vi.mocked(api.post).mockRejectedValue(new Error('Unable to connect to Ujimora. Check your connection and try again.'))
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Send to donors' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Send now' }))
  expect(await screen.findByText(/Unable to connect to Ujimora/)).toBeInTheDocument()
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(sendCalls()).toHaveLength(2))
  await screen.findByRole('button', { name: 'Try again' })
  fireEvent.click(screen.getByRole('button', { name: 'Send to donors' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Send now' }))
  await waitFor(() => expect(sendCalls()).toHaveLength(3))
  const keys = sendCalls().map(([, , headers]) => (headers as Record<string, string>)['Idempotency-Key'])
  expect(keys[1]).toBe(keys[0])
  expect(keys[2]).not.toBe(keys[0])
})

it('shows the safety-review notice when the message is held', async () => {
  vi.mocked(api.get).mockResolvedValue(state({ draft: view() }))
  vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('Saved privately for safety review.'), { status: 409, errors: { publication: ['held'] } }))
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Send to donors' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Send now' }))
  expect(await screen.findByText('Waiting for safety review')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  // The draft stays for sending again after approval.
  expect(screen.getByLabelText('Subject')).toHaveValue('Thank you')
})

describe('a message its approval sends', () => {
  const heldAutomatically = () => Object.assign(new Error('Saved privately for safety review. Your content has not been published yet.'), { status: 409, errors: { publication: ['held', 'publishes_on_approval'] } })
  async function sendHeld() {
    vi.mocked(api.get).mockResolvedValue(state({ draft: view() }))
    vi.mocked(api.post).mockRejectedValue(heldAutomatically())
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Send to donors' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Send now' }))
    const notice = (await screen.findByText('Waiting for safety review')).closest('[role="status"]')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    return notice
  }
  const WARNING = "The version waiting for review is sent only if your saved draft still matches it when it's approved."

  it('says it is emailed once approved, keeps it, and warns that changing it drops the waiting version', async () => {
    const notice = await sendHeld()
    expect(notice).toHaveTextContent("Once a reviewer approves it, we email it to your donors automatically, so you don't need to send it again.")
    expect(notice).toHaveTextContent('You can withdraw it there.')
    expect(screen.getByLabelText('Subject')).toHaveValue('Thank you')
    expect(screen.getByText(WARNING)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('says the waiting version is not sent while a changed draft differs from it, and keeps the warning', async () => {
    await sendHeld()
    vi.mocked(api.put).mockImplementation(async (_path, body) => view(body as Partial<DonorThankYouView>))
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Your gifts fixed the clinic roof and the gate. Thank you all.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText("Draft saved. While it differs from the version waiting for review, that version won't be sent.")).toBeInTheDocument()
    expect(screen.queryByText('Waiting for safety review')).not.toBeInTheDocument()
    // The review is still open: changing it back before the approval still sends it.
    expect(screen.getByText(WARNING)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: draftContent.body } })
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Draft saved.')).toBeInTheDocument()
  })

  it('says so when the draft is discarded too', async () => {
    await sendHeld()
    vi.mocked(api.delete).mockResolvedValue(null)
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Discard this draft?' })).getByRole('button', { name: 'Discard draft' }))
    expect(await screen.findByText("Draft discarded. Without a matching draft, the version waiting for review won't be sent.")).toBeInTheDocument()
    expect(screen.queryByText('Waiting for safety review')).not.toBeInTheDocument()
    expect(screen.getByText(WARNING)).toBeInTheDocument()
  })

  /** The page's own state, and the author's publication reviews, answered by path. */
  function serveWithReviews(items: unknown[]) {
    vi.mocked(api.get).mockImplementation(async (path: string) => (path.startsWith('/publication-reviews') ? { items, total: items.length } : state({ draft: view() })))
  }
  const waitingReview = { id: 'r1', action: 'thank_you.send', resourceId: 'c1', status: 'pending', publishOnApproval: true, canWithdraw: true, text: JSON.stringify(draftContent) }

  it('still warns about a message waiting for review after the page was left and opened again', async () => {
    serveWithReviews([{ ...waitingReview, id: 'r0', resourceId: 'c2' }, waitingReview])
    vi.mocked(api.put).mockImplementation(async (_path, body) => view(body as Partial<DonorThankYouView>))
    renderPage()
    expect(await screen.findByText(WARNING)).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/publication-reviews?page=1&pageSize=100')
    fireEvent.change(await screen.findByLabelText('Message'), { target: { value: 'Your gifts fixed the clinic roof. Thank you, all of you.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText("Draft saved. While it differs from the version waiting for review, that version won't be sent.")).toBeInTheDocument()
  })

  it('warns about nothing when no message waits to be sent by its approval', async () => {
    // Switched off an approval sends nothing by itself; a published one, or another campaign's, is not waiting.
    serveWithReviews([
      { ...waitingReview, publishOnApproval: false, canWithdraw: false },
      { ...waitingReview, id: 'r2', status: 'approved', publication: { state: 'published' }, canWithdraw: false },
      { ...waitingReview, id: 'r3', resourceId: 'c2' },
    ])
    vi.mocked(api.put).mockImplementation(async (_path, body) => view(body as Partial<DonorThankYouView>))
    renderPage()
    await screen.findByLabelText('Subject')
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/publication-reviews?page=1&pageSize=100'))
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Your gifts fixed the clinic roof. Thank you, all of you.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(await screen.findByText('Draft saved.')).toBeInTheDocument()
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument()
  })

  it('keeps today\'s words while its author sends it after approval', async () => {
    vi.mocked(api.get).mockResolvedValue(state({ draft: view() }))
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('Saved privately for safety review.'), { status: 409, errors: { publication: ['held'] } }))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Send to donors' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Send now' }))
    const notice = (await screen.findByText('Waiting for safety review')).closest('[role="status"]')
    expect(notice).toHaveTextContent('After a reviewer approves it, select Send to donors again with the same message to publish it.')
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument()
  })
})

it('discards the draft only after confirming', async () => {
  vi.mocked(api.get).mockResolvedValue(state({ draft: view() }))
  vi.mocked(api.delete).mockResolvedValue(null)
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Discard' }))
  expect(api.delete).not.toHaveBeenCalled()
  fireEvent.click(within(await screen.findByRole('dialog', { name: 'Discard this draft?' })).getByRole('button', { name: 'Discard draft' }))
  expect(await screen.findByText('Draft discarded.')).toBeInTheDocument()
  expect(api.delete).toHaveBeenCalledWith('/campaigns/c1/thank-you/draft')
  expect(screen.getByLabelText('Subject')).toHaveValue('')
})

it('follows delivery until it finishes, then offers to retry the failed deliveries', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const sending = view({ status: 'sending', recipientCount: 10, sentCount: 4, skippedCount: 1, submittedAt: '2026-09-29T11:00:00.000Z' })
  vi.mocked(api.get).mockImplementation(async (path: string) => path === '/campaigns/c1/thank-you/t1'
    ? view({ status: 'partially_sent', recipientCount: 10, sentCount: 7, skippedCount: 1, failedCount: 2, retryableCount: 2, submittedAt: '2026-09-29T11:00:00.000Z' })
    : state({ eligible: false, reason: 'limit_reached', sendsUsed: 1, history: [sending] }))
  vi.mocked(api.post).mockResolvedValue({ requeued: 2 })
  renderPage()
  expect(await screen.findByText('Sending… 5 of 10 done.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Retry failed deliveries' })).not.toBeInTheDocument()
  await untilPolled()
  expect(await screen.findByText('Delivered to 7 of 10 donors.')).toBeInTheDocument()
  const counts = screen.getByText('Skipped (opted out or no longer eligible)').closest('dl')!
  expect(within(counts).getByText('7')).toBeInTheDocument()
  expect(within(counts).getByText('1')).toBeInTheDocument()
  expect(within(counts).getByText('2')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry failed deliveries' }))
  expect(await screen.findByText('Trying 2 failed deliveries again.')).toBeInTheDocument()
  expect(api.post).toHaveBeenCalledWith('/campaigns/c1/thank-you/t1/retry')
  expect(screen.queryByRole('button', { name: 'Retry failed deliveries' })).not.toBeInTheDocument()
})

it('keeps reading progress while queued and stops when the page closes', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(api.get).mockImplementation(async (path: string) => path === '/campaigns/c1/thank-you/t1'
    ? view({ status: 'queued' })
    : state({ eligible: false, reason: 'limit_reached', history: [view({ status: 'queued' })] }))
  const page = renderPage()
  expect(await screen.findByText('Queued. Delivery starts in a moment.')).toBeInTheDocument()
  await untilPolled(2)
  page.unmount()
  const calls = pollCalls()
  await act(async () => { await vi.advanceTimersByTimeAsync(12_000) })
  expect(pollCalls()).toBe(calls)
})
