import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DonorThankYouState, DonorThankYouView } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

type Props = Record<string, unknown> & { children?: React.ReactNode }
const m = vi.hoisted(() => ({
  el: (tag: string) => ({ children }: { children?: React.ReactNode }) => createElement(tag, {}, children),
  user: { id: 'org' } as { id: string } | null,
  appListener: null as null | ((state: string) => void),
  confirm: vi.fn(async () => true),
}))
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }))
vi.mock('react-native', () => ({
  View: m.el('div'), ScrollView: m.el('div'), StyleSheet: { create: <T,>(styles: T) => styles },
  AppState: {
    currentState: 'active',
    addEventListener: (_event: string, listener: (state: string) => void) => { m.appListener = listener; return { remove: () => { m.appListener = null } } },
  },
  useWindowDimensions: () => ({ width: 360, height: 640 }),
}))
vi.mock('react-native-paper', () => {
  const Dialog = Object.assign(({ children, visible }: Props) => visible ? createElement('div', { role: 'dialog' }, children) : null, { Title: m.el('h2'), ScrollArea: m.el('div'), Actions: m.el('div') })
  return { Text: m.el('span'), Icon: () => null, Portal: ({ children }: Props) => children, Dialog }
})
vi.mock('expo-router', () => ({ Stack: { Screen: () => null }, useLocalSearchParams: () => ({ id: 'c1' }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: m.user }) }))
vi.mock('@/context/ColorModeContext', () => ({ usePalette: () => ({}), useNeu: () => ({}) }))
vi.mock('@/lib/confirmDestructive', () => ({ confirmAction: m.confirm, confirmDestructive: m.confirm }))
vi.mock('@/components/BrandedTextInput', () => ({
  BrandedTextInput: ({ label, value, onChangeText, disabled }: Props) => createElement('textarea', { 'aria-label': label, value, disabled, onChange: (event: { target: { value: string } }) => (onChangeText as (value: string) => void)(event.target.value) }),
}))
vi.mock('@/components/Loading', () => ({
  PageSkeleton: () => createElement('p', {}, 'Loading'),
  Button: ({ children, onPress, disabled }: Props) => createElement('button', { onClick: onPress, disabled }, children),
}))
vi.mock('@/components/EmptyState', () => ({ EmptyState: ({ title }: Props) => createElement('p', {}, title as string) }))
vi.mock('@/components/KeyboardAvoider', () => ({ KeyboardAvoider: m.el('div') }))
vi.mock('@/components/ProgressBar', () => ({ ProgressBar: () => null }))
vi.mock('@/components/PublicationConsent', () => ({ PublicationConsent: () => null }))
vi.mock('@/components/PublicationHeldNotice', () => ({ PublicationHeldNotice: () => createElement('p', {}, 'Waiting for safety review') }))
vi.mock('@/components/SignInRequired', () => ({ SignInRequired: () => createElement('p', {}, 'Sign in') }))
import ThankDonorsScreen from '../../../app/campaign/thank-you'

const message = { subject: 'Thank you all', body: 'The roof is fixed. Thank you!', signature: 'Ama' }
const view = (fields: Partial<DonorThankYouView>): DonorThankYouView => ({
  id: 't1', campaignId: 'c1', status: 'queued', authorRole: 'manager', ...message,
  recipientCount: 0, sentCount: 0, failedCount: 0, skippedCount: 0, retryableCount: 0, updatedAt: '2026-09-29T10:00:00.000Z', ...fields,
})
const state = (fields: Partial<DonorThankYouState> = {}): DonorThankYouState => ({ eligible: true, trigger: 'campaign_ended', estimatedRecipients: 3, sendsUsed: 0, sendsAllowed: 1, history: [], ...fields })
const failure = (status: number, text: string, errors?: Record<string, string[]>) => Object.assign(new Error(text), { status, errors })

/** The API's state and one message's progress, answered by path. */
const server = { state: state(), summaries: [] as DonorThankYouView[] }
const summaryCalls = () => vi.mocked(api.get).mock.calls.filter(([path]) => path === '/campaigns/c1/thank-you/t1').length
const sendCalls = () => vi.mocked(api.post).mock.calls.filter(([path]) => path === '/campaigns/c1/thank-you/send')

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.post).mockReset(); vi.mocked(api.delete).mockReset()
  m.user = { id: 'org' }
  server.state = state(); server.summaries = []
  vi.mocked(api.get).mockImplementation((async (path: string) => {
    if (path === '/campaigns/c1/thank-you') return server.state
    if (path === '/campaigns/c1/thank-you/t1') return server.summaries.length > 1 ? server.summaries.shift() : server.summaries[0]
    throw new Error(`unexpected ${path}`)
  }) as never)
  vi.mocked(api.put).mockResolvedValue(view({ id: 'd1', status: 'draft' }))
})
afterEach(() => { cleanup(); vi.useRealTimers() })

async function write() {
  fireEvent.change(await screen.findByLabelText('Subject'), { target: { value: message.subject } })
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: message.body } })
  fireEvent.change(screen.getByLabelText('Signature (optional)'), { target: { value: message.signature } })
}
const sendButton = () => screen.getByText('Send to donors') as HTMLButtonElement

describe('thank-you composer', () => {
  it('restores the saved draft, explains who receives it and keeps Send locked until the campaign can thank donors', async () => {
    server.state = state({ eligible: false, reason: 'not_ended', trigger: undefined, draft: view({ id: 'd1', status: 'draft' }) })
    render(createElement(ThankDonorsScreen))
    expect((await screen.findByLabelText('Subject') as HTMLTextAreaElement).value).toBe(message.subject)
    expect(screen.getByText(/About 3 donors will receive your message/)).toBeTruthy()
    expect(screen.getByText(/You will not see their names or email addresses/)).toBeTruthy()
    expect(screen.getByText(/once the campaign has ended or a payout has been paid/)).toBeTruthy()
    expect(sendButton().disabled).toBe(true)
    expect(screen.getByText('Discard')).toBeTruthy()
  })

  it('saves first, sends with an Idempotency-Key and reuses it when the same tap is retried after no answer', async () => {
    vi.mocked(api.post).mockImplementation((async (path: string) => {
      if (sendCalls().length === 1) throw failure(0, 'Could not reach Ujimora. Check your connection and try again.')
      server.state = state({ eligible: false, reason: 'limit_reached', sendsUsed: 1, history: [view({ id: 't1', status: 'queued' })] })
      return path.endsWith('/send') ? view({ id: 't1', status: 'queued' }) : null
    }) as never)
    render(createElement(ThankDonorsScreen))
    await write()
    fireEvent.click(sendButton())
    await screen.findByText(/Tap Send again to retry\. Your donors will not get it twice\./)
    expect(api.put).toHaveBeenCalledWith('/campaigns/c1/thank-you/draft', message)
    const [, body, headers] = sendCalls()[0]
    expect(body).toEqual({ automatedReviewConsent: false })
    const key = (headers as Record<string, string>)['Idempotency-Key']
    expect(key).toMatch(/^[a-zA-Z0-9_-]{16,100}$/)

    fireEvent.click(sendButton())
    await screen.findByText('Queued')
    expect(sendCalls()[1][2]).toEqual({ 'Idempotency-Key': key })
    // Already saved: the retry does not create a second draft.
    expect(api.put).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Preparing the list of donors…')).toBeTruthy()
    expect(screen.getByText(/Your thank-you is on its way/)).toBeTruthy()
  })

  it('shows the safety-review notice for a held message and treats the next Send as a new action', async () => {
    vi.mocked(api.post).mockRejectedValue(failure(409, 'Saved privately for safety review.', { publication: ['held'] }))
    render(createElement(ThankDonorsScreen))
    await write()
    fireEvent.click(sendButton())
    await screen.findByText('Waiting for safety review')
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toBe(message.body)
    fireEvent.click(sendButton())
    await vi.waitFor(() => expect(sendCalls()).toHaveLength(2))
    expect(sendCalls()[1][2]).not.toEqual(sendCalls()[0][2])
  })

  it('does not send when the author cancels the confirmation', async () => {
    m.confirm.mockResolvedValueOnce(false)
    render(createElement(ThankDonorsScreen))
    await write()
    fireEvent.click(sendButton())
    await act(async () => { await Promise.resolve() })
    expect(api.put).not.toHaveBeenCalled()
    expect(sendCalls()).toHaveLength(0)
  })

  it('polls every 4 seconds while sending and stops in the background, once delivered and on unmount', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    server.state = state({ eligible: false, reason: 'limit_reached', sendsUsed: 1, history: [view({ status: 'sending', recipientCount: 3, sentCount: 1 })] })
    server.summaries = [view({ status: 'sending', recipientCount: 3, sentCount: 2 }), view({ status: 'sent', recipientCount: 3, sentCount: 3 })]
    const { unmount } = render(createElement(ThankDonorsScreen))
    await screen.findByText('Delivered to 1 of 3 donors so far.')
    expect(summaryCalls()).toBe(0)

    await act(async () => { vi.advanceTimersByTime(4000) })
    await screen.findByText('Delivered to 2 of 3 donors so far.')
    expect(summaryCalls()).toBe(1)

    act(() => m.appListener?.('background'))
    await act(async () => { vi.advanceTimersByTime(20_000) })
    expect(summaryCalls()).toBe(1)

    act(() => m.appListener?.('active'))
    await act(async () => { vi.advanceTimersByTime(4000) })
    await screen.findByText('Delivered to 3 of 3 donors.')
    await act(async () => { vi.advanceTimersByTime(20_000) })
    expect(summaryCalls()).toBe(2)
    unmount()
  })

  it('stops polling when the screen closes mid-delivery', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    server.state = state({ eligible: false, reason: 'limit_reached', sendsUsed: 1, history: [view({ status: 'queued' })] })
    server.summaries = [view({ status: 'queued' })]
    const { unmount } = render(createElement(ThankDonorsScreen))
    await screen.findByText('Preparing the list of donors…')
    unmount()
    await act(async () => { vi.advanceTimersByTime(20_000) })
    expect(summaryCalls()).toBe(0)
  })

  it('retries only failed deliveries and follows the new progress', async () => {
    server.state = state({ eligible: false, reason: 'limit_reached', sendsUsed: 1, history: [view({ status: 'partially_sent', recipientCount: 3, sentCount: 1, failedCount: 2, retryableCount: 2 })] })
    vi.mocked(api.post).mockResolvedValue({ requeued: 2 })
    render(createElement(ThankDonorsScreen))
    expect(await screen.findByText('2 could not be delivered; 2 can be retried.')).toBeTruthy()
    fireEvent.click(screen.getByText('Retry failed deliveries'))
    await screen.findByText('Trying again for 2 donors.')
    expect(api.post).toHaveBeenCalledWith('/campaigns/c1/thank-you/t1/retry')
    expect(screen.getByText('Sending')).toBeTruthy()
    expect(screen.queryByText('Retry failed deliveries')).toBeNull()
  })

  it('previews exactly what donors receive and discards the draft after confirmation', async () => {
    server.state = state({ draft: view({ id: 'd1', status: 'draft' }) })
    vi.mocked(api.post).mockResolvedValue({ subject: message.subject, text: `${message.body}\n\n— Ama\n\nYou are receiving this because you gave on Ujimora.` })
    vi.mocked(api.delete).mockResolvedValue(null)
    render(createElement(ThankDonorsScreen))
    fireEvent.click(await screen.findByText('Preview'))
    await screen.findByRole('dialog')
    expect(screen.getByText(/You are receiving this because you gave on Ujimora/)).toBeTruthy()
    expect(api.post).toHaveBeenCalledWith('/campaigns/c1/thank-you/preview', message)

    fireEvent.click(screen.getByText('Discard'))
    await screen.findByText('Draft discarded.')
    expect(api.delete).toHaveBeenCalledWith('/campaigns/c1/thank-you/draft')
    expect((screen.getByLabelText('Subject') as HTMLTextAreaElement).value).toBe('')
  })

  it('does not reveal a campaign the viewer cannot thank donors for', async () => {
    vi.mocked(api.get).mockRejectedValue(failure(404, 'Campaign not found'))
    render(createElement(ThankDonorsScreen))
    expect(await screen.findByText('You cannot send thank-you messages for this campaign.')).toBeTruthy()
  })
})
