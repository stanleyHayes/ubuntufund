import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublicationAction, PublicationReviewItem } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

type Props = Record<string, unknown> & { children?: React.ReactNode }
const m = vi.hoisted(() => ({
  push: vi.fn(),
  /** How many characters fit on a line of the phone's note text. */
  charsPerLine: 40,
  /** The author's answer to a confirmation. */
  confirm: vi.fn(async (_prompt: { title: string; message: string; confirmLabel: string }) => true),
  clearIdentityDraft: vi.fn(async (_userId: string) => {}),
  announce: vi.fn(),
}))
vi.mock('react-native', () => ({
  View: ({ children, accessibilityLabel }: Props) => createElement('div', { 'aria-label': accessibilityLabel }, children),
  StyleSheet: { create: <T,>(styles: T) => styles },
  AccessibilityInfo: { announceForAccessibilityWithOptions: m.announce },
}))
vi.mock('react-native-paper', async () => {
  const { createElement: h, useEffect } = await import('react')
  const textOf = (node: unknown): string => typeof node === 'string' || typeof node === 'number' ? String(node)
    : Array.isArray(node) ? node.map(textOf).join('')
      : node && typeof node === 'object' && 'props' in node ? textOf((node as { props: { children?: unknown } }).props.children) : ''
  /** Lays text out at `charsPerLine`, the way React Native reports lines to `onTextLayout`. */
  function Text({ children, numberOfLines, onTextLayout, accessibilityElementsHidden, accessibilityRole }: Props) {
    const text = textOf(children)
    useEffect(() => {
      (onTextLayout as ((event: unknown) => void) | undefined)?.({ nativeEvent: { lines: Array.from({ length: Math.ceil(text.length / m.charsPerLine) }, () => ({})) } })
    }, [text, onTextLayout])
    return h('span', { 'data-lines': numberOfLines ?? 'all', 'aria-hidden': accessibilityElementsHidden ? 'true' : undefined, role: accessibilityRole === 'alert' ? 'alert' : undefined }, children as React.ReactNode)
  }
  return { Text, Icon: ({ source }: Props) => h('i', { 'data-icon': source }) }
})
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react')
  return { router: { push: m.push }, useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) }
})
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'author' } }) }))
vi.mock('@/context/ColorModeContext', () => ({ usePalette: () => ({ text: '#1A2E22', textSecondary: '#4A5A50', success: '#2F6B46', primary: '#2E3D2F', error: '#A5432F' }) }))
vi.mock('@/components/Loading', () => ({
  Button: ({ children, onPress, disabled, accessibilityLabel, accessibilityState }: Props) => createElement('button', {
    onClick: onPress, disabled, 'aria-label': accessibilityLabel, 'aria-expanded': (accessibilityState as { expanded?: boolean } | undefined)?.expanded,
  }, children),
}))
vi.mock('@/components/GlassSurface', () => ({ GlassSurface: ({ children, variant }: Props) => createElement('section', { 'data-variant': variant }, children) }))
vi.mock('@/lib/confirmDestructive', () => ({ confirmDestructive: m.confirm }))
vi.mock('@/lib/publicationDrafts', () => ({ clearIdentityDraft: m.clearIdentityDraft }))
import { PublicationReviews } from '../PublicationReviews'

const IN_A_WEEK = new Date(Date.now() + 7 * 86400000).toISOString()
const review = (fields: Partial<PublicationReviewItem> = {}): PublicationReviewItem => ({
  id: 'review-1', action: 'campaign.create', status: 'pending', text: JSON.stringify({ title: 'Clean water', description: 'Private campaign story' }), ...fields,
})
const serve = (items: PublicationReviewItem[], total = items.length) => vi.mocked(api.get).mockResolvedValue({ items, total })
const show = (actions?: PublicationAction[]) => render(createElement(PublicationReviews, { actions }))
const icons = () => Array.from(document.querySelectorAll('[data-icon]'), icon => icon.getAttribute('data-icon'))
/** The note as shown, not the hidden copy that measures it. */
const shownNote = (text: RegExp) => screen.getAllByText(text).find(element => element.getAttribute('aria-hidden') !== 'true')!

beforeEach(() => { vi.clearAllMocks(); m.charsPerLine = 40; m.confirm.mockResolvedValue(true) })
afterEach(() => cleanup())

describe('publication reviews in the app', () => {
  it('shows a compact status card, never the submitted content', async () => {
    serve([review({ createdAt: '2026-09-29T08:00:00.000Z' })])
    show()
    const submitted = new Date('2026-09-29T08:00:00.000Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    expect(await screen.findByLabelText(`Review status: In review. Submitted ${submitted}`)).toBeTruthy()
    const title = screen.getByText('New campaign')
    expect(title.textContent).toBe('New campaign · Clean water')
    expect(title.getAttribute('data-lines')).toBe('1')
    expect(icons()).toEqual(['check-circle', 'radiobox-marked', 'circle-outline'])
    expect(screen.getByText('A person is checking it.')).toBeTruthy()
    expect(title.closest('section')?.getAttribute('data-variant')).toBe('subtle')
    expect(document.body.textContent).not.toMatch(/Private campaign story|review-1/)
    expect(api.get).toHaveBeenCalledWith('/publication-reviews?page=1')
  })

  it('tells the author of an approved version how to publish it', async () => {
    serve([review({ action: 'comment.create', text: JSON.stringify({ authorName: 'Kofi', comment: 'Stay strong!' }), status: 'approved', approvalExpiresAt: IN_A_WEEK })])
    show()
    expect(await screen.findByLabelText('Review status: Approved')).toBeTruthy()
    expect(icons()).toEqual(['check-circle', 'check-circle', 'check-circle'])
    expect(screen.getByText('Comment').textContent).toBe('Comment · Stay strong!')
    expect(screen.getByText(/^Approved\. If it isn't public yet, post it again unchanged before .+\.$/)).toBeTruthy()
  })

  it('marks an expired approval on the tracker and asks for a new review', async () => {
    serve([review({ action: 'creator.profile', text: JSON.stringify({ displayName: 'Ama' }), status: 'approved', approvalExpiresAt: '2026-01-01T00:00:00.000Z' })])
    show()
    expect(await screen.findByLabelText('Review status: Approval expired')).toBeTruthy()
    expect(icons()).toEqual(['check-circle', 'check-circle', 'check-circle'])
    expect(screen.getByText('Expired')).toBeTruthy()
    expect(screen.getByText("Approval expired. If it isn't public yet, save it again to request a new review.")).toBeTruthy()
  })

  it('shows a declined version with the reference support needs', async () => {
    serve([review({ id: 'review-9', status: 'rejected', reviewNotes: 'Remove the phone number.' })])
    show()
    expect(await screen.findByLabelText('Review status: Declined')).toBeTruthy()
    expect(icons()).toEqual(['check-circle', 'check-circle', 'close-circle'])
    expect(shownNote(/Remove the phone number/).textContent).toBe("Reviewer's note: Remove the phone number.")
    expect(screen.getByText('Declined. Change it before you submit it again.')).toBeTruthy()
    expect(screen.getByText('Questions? support@ujimora.com, reference review-9')).toBeTruthy()
  })

  it('clamps a long note to two lines until the author asks for the rest', async () => {
    serve([review({ status: 'rejected', reviewNotes: 'The cover photo shows a child in a school uniform. Replace it with a photo that does not identify a minor.' })])
    show()
    fireEvent.click(await screen.findByText('Show more'))
    expect(shownNote(/school uniform/).getAttribute('data-lines')).toBe('all')
    const less = screen.getByText('Show less')
    expect(less.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(less)
    expect(shownNote(/school uniform/).getAttribute('data-lines')).toBe('2')
    expect(screen.getByText('Show more').getAttribute('aria-expanded')).toBe('false')
  })

  it('offers no toggle for a note that fits in two lines', async () => {
    serve([review({ status: 'approved', approvalExpiresAt: IN_A_WEEK, reviewNotes: 'Looks good.' })])
    show()
    expect(shownNote(await screen.findAllByText(/Looks good/).then(() => /Looks good/)).getAttribute('data-lines')).toBe('2')
    expect(screen.queryByText('Show more')).toBeNull()
  })

  it('lists only the screen’s own kinds and opens Settings for older ones', async () => {
    serve([
      review({ id: 'mine', action: 'creator.profile', text: JSON.stringify({ displayName: 'Ama', bio: 'Private biography' }) }),
      review({ id: 'other', action: 'campaign.create' }),
    ], 150)
    show(['creator.profile'])
    expect((await screen.findByText('Creator page')).textContent).toBe('Creator page · Ama')
    expect(api.get).toHaveBeenCalledWith('/publication-reviews?page=1&pageSize=100')
    expect(screen.queryByText('New campaign')).toBeNull()
    expect(screen.queryByText('Next')).toBeNull()
    fireEvent.click(screen.getByText('See all in Settings'))
    expect(m.push).toHaveBeenCalledWith('/settings')
  })

  it('says nothing is waiting when none of the screen’s kinds are listed', async () => {
    serve([review()])
    show(['live.start'])
    expect(await screen.findByText('Nothing waiting for review.')).toBeTruthy()
    expect(screen.queryByText('See all in Settings')).toBeNull()
  })

  it('pages through every kind in Settings', async () => {
    serve(Array.from({ length: 25 }, (_, index) => review({ id: `review-${index}` })), 30)
    show()
    fireEvent.click(await screen.findByText('Next'))
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/publication-reviews?page=2'))
  })

  it('keeps Previous on a later page after the list shrank', async () => {
    serve(Array.from({ length: 25 }, (_, index) => review({ id: `review-${index}` })), 30)
    show()
    const next = await screen.findByText('Next')
    serve([], 20)
    fireEvent.click(next)
    expect(await screen.findByText('Nothing waiting for review.')).toBeTruthy()
    expect((screen.getByText('Previous') as HTMLButtonElement).disabled).toBe(false)
  })

  it('contains a malformed response and retries from Refresh', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ items: [null], total: 1 }).mockResolvedValueOnce({ items: [], total: 0 })
    show()
    expect((await screen.findByRole('alert')).textContent).toBe('Could not load your publication reviews. Tap Refresh to try again.')
    expect(screen.queryByText('Nothing waiting for review.')).toBeNull()
    fireEvent.click(screen.getByLabelText('Refresh publication reviews'))
    expect(await screen.findByText('Nothing waiting for review.')).toBeTruthy()
  })
})

describe('publishing on approval in the app', () => {
  const comment = (fields: Partial<PublicationReviewItem> = {}) => review({
    id: 'review-2', action: 'comment.create', text: JSON.stringify({ authorName: 'Kofi', comment: 'Stay strong!' }), publishOnApproval: true, ...fields,
  })
  /** Each step's label, in order. */
  const labels = (summary: string) => Array.from(screen.getByLabelText(summary).children, step => step.querySelector('span')?.textContent)
  const withdrawCalls = () => vi.mocked(api.post).mock.calls.filter(([path]) => path === '/publication-reviews/review-2/withdraw')

  it('says held changes stay private until approved once approval publishes them', async () => {
    serve([comment()])
    show()
    expect(await screen.findByText("Held changes stay private until they're approved.")).toBeTruthy()
    cleanup()
    // Live sessions, and versions held before publishing on approval, go public when their author submits them again.
    serve([review({ action: 'live.start', text: JSON.stringify(['Live clinic tour']) })])
    show()
    expect(await screen.findByText('Held changes stay private until they are published.')).toBeTruthy()
  })

  it('adds a Published step while a version that publishes itself waits for review', async () => {
    serve([comment()])
    show()
    expect(await screen.findByLabelText('Review status: In review')).toBeTruthy()
    expect(labels('Review status: In review')).toEqual(['Submitted', 'In review', 'Approved', 'Published'])
    expect(icons()).toEqual(['check-circle', 'radiobox-marked', 'circle-outline', 'circle-outline'])
    expect(screen.getByText("A person is checking it. It's published automatically once approved.")).toBeTruthy()
  })

  it('shows where publishing an approved version stands', async () => {
    const at = '2026-10-01T09:30:00.000Z'
    serve([comment({ status: 'approved', approvalExpiresAt: IN_A_WEEK, publication: { state: 'published', at } })])
    show()
    const published = new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    expect(await screen.findByLabelText(`Review status: Published. Published ${published}`)).toBeTruthy()
    expect(icons()).toEqual(['check-circle', 'check-circle', 'check-circle', 'check-circle'])
    expect(screen.getByText('Approved and posted on the campaign.')).toBeTruthy()
    expect(screen.queryByText('Withdraw')).toBeNull()

    cleanup()
    serve([comment({ status: 'approved', approvalExpiresAt: IN_A_WEEK, publication: { state: 'publishing', at: new Date().toISOString() }, canWithdraw: true })])
    show()
    expect(await screen.findByLabelText('Review status: Publishing')).toBeTruthy()
    expect(icons()).toEqual(['check-circle', 'check-circle', 'check-circle', 'radiobox-marked'])
    expect(screen.getByText('Approved. Publishing now.')).toBeTruthy()
  })

  it('explains why an approved version was not published and what to do next', async () => {
    const profile = (approvalExpiresAt: string) => review({
      id: 'review-9', action: 'account.profile', text: JSON.stringify({ name: 'Ama' }), status: 'approved', approvalExpiresAt,
      publishOnApproval: true, publication: { state: 'not_published', reason: 'credentials_changed' }, canWithdraw: true,
    })
    serve([profile(IN_A_WEEK)])
    show()
    expect(await screen.findByLabelText('Review status: Not published')).toBeTruthy()
    expect(labels('Review status: Not published')).toEqual(['Submitted', 'In review', 'Approved', "Couldn't publish"])
    expect(icons()).toEqual(['check-circle', 'check-circle', 'check-circle', 'close-circle'])
    expect(screen.getByText(/^Your sign-in details changed since you submitted it \(a password or two-step verification change\)\. Save it again before .+ to publish it straight away\.$/)).toBeTruthy()
    cleanup()
    // Run out: the same version only goes back for a new review, and the approval is marked as over.
    serve([profile('2026-01-01T00:00:00.000Z')])
    show()
    // Said in the steps' summary too, since screen readers hear only that.
    expect(await screen.findByLabelText('Review status: Not published. Approval expired')).toBeTruthy()
    expect(screen.getByText('Expired')).toBeTruthy()
    expect(screen.getByText('Your sign-in details changed since you submitted it (a password or two-step verification change). Save it again to request a new review.')).toBeTruthy()
    cleanup()
    // A held comment's form was cleared: posting again is not promised to publish it straight away.
    serve([comment({ status: 'approved', approvalExpiresAt: IN_A_WEEK, publication: { state: 'not_published', reason: 'credentials_changed' }, canWithdraw: true })])
    show()
    expect(await screen.findByText('Your sign-in details changed since you submitted it (a password or two-step verification change). Post it again if you still want it published.')).toBeTruthy()
  })

  it('marks a withdrawn or replaced version as stopped, not failed', async () => {
    serve([
      comment({ status: 'withdrawn', publication: { state: 'withdrawn', reason: 'withdrawn_by_author' } }),
      review({ id: 'review-3', action: 'creator.profile', text: JSON.stringify({ displayName: 'Ama' }), status: 'approved', approvalExpiresAt: IN_A_WEEK, publishOnApproval: true, publication: { state: 'superseded', reason: 'edited_since_submitted' } }),
    ])
    show()
    expect(await screen.findByLabelText('Review status: Withdrawn')).toBeTruthy()
    expect(labels('Review status: Withdrawn')).toEqual(['Submitted', 'Withdrawn'])
    expect(labels('Review status: Replaced')).toEqual(['Submitted', 'In review', 'Approved', 'Replaced'])
    expect(icons()).toEqual(['check-circle', 'minus-circle', 'check-circle', 'check-circle', 'check-circle', 'minus-circle'])
    expect(screen.getByText("You withdrew it. It won't be published.")).toBeTruthy()
    expect(screen.getByText("It changed after you submitted it, so this version wasn't published. Submit your latest version if it still needs review.")).toBeTruthy()
  })

  it('withdraws a waiting version after the author confirms, then reloads the list', async () => {
    serve([comment({ canWithdraw: true })])
    vi.mocked(api.post).mockResolvedValue({ withdrawn: true })
    show()
    const withdraw = await screen.findByText('Withdraw')
    expect(withdraw.getAttribute('aria-label')).toBe('Withdraw Comment · Stay strong!')
    serve([comment({ status: 'withdrawn', publication: { state: 'withdrawn', reason: 'withdrawn_by_author' } })])
    fireEvent.click(withdraw)
    expect(await screen.findByLabelText('Review status: Withdrawn')).toBeTruthy()
    expect(m.confirm).toHaveBeenCalledWith({ title: 'Withdraw this version?', message: "It won't be published. You can submit it again later for a new review.", confirmLabel: 'Withdraw' })
    expect(withdrawCalls()).toHaveLength(1)
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(m.announce).toHaveBeenCalledWith("Withdrawn. It won't be published.", { queue: true })
    expect(screen.queryByText('Withdraw')).toBeNull()
    expect(m.clearIdentityDraft).not.toHaveBeenCalled()
  })

  it('forgets the held profile change kept on this device once it is withdrawn', async () => {
    const profile = review({ id: 'review-6', action: 'account.profile', text: JSON.stringify({ name: 'Ama' }), publishOnApproval: true, canWithdraw: true })
    serve([profile])
    vi.mocked(api.post).mockResolvedValue({ withdrawn: true })
    show()
    serve([{ ...profile, status: 'withdrawn', canWithdraw: false, publication: { state: 'withdrawn', reason: 'withdrawn_by_author' } }])
    fireEvent.click(await screen.findByText('Withdraw'))
    expect(await screen.findByLabelText('Review status: Withdrawn')).toBeTruthy()
    expect(api.post).toHaveBeenCalledWith('/publication-reviews/review-6/withdraw')
    expect(m.clearIdentityDraft).toHaveBeenCalledWith('author')
  })

  it('holds every Withdraw while one version is being withdrawn', async () => {
    serve([comment({ canWithdraw: true }), comment({ id: 'review-7', text: JSON.stringify({ authorName: 'Kofi', comment: 'Keep going' }), canWithdraw: true })])
    let answer: (value: unknown) => void = () => {}
    vi.mocked(api.post).mockReturnValue(new Promise(resolve => { answer = resolve }) as never)
    show()
    fireEvent.click((await screen.findAllByText('Withdraw'))[0])
    await waitFor(() => expect(screen.getAllByText('Withdraw').every(button => (button as HTMLButtonElement).disabled)).toBe(true))
    serve([comment({ status: 'withdrawn', publication: { state: 'withdrawn', reason: 'withdrawn_by_author' } }), comment({ id: 'review-7', text: JSON.stringify({ authorName: 'Kofi', comment: 'Keep going' }), canWithdraw: true })])
    answer({ withdrawn: true })
    expect(await screen.findByLabelText('Review status: Withdrawn')).toBeTruthy()
    expect((screen.getByText('Withdraw') as HTMLButtonElement).disabled).toBe(false)
  })

  it('withdraws nothing when the author cancels', async () => {
    m.confirm.mockResolvedValue(false)
    serve([comment({ canWithdraw: true })])
    show()
    fireEvent.click(await screen.findByText('Withdraw'))
    await waitFor(() => expect(m.confirm).toHaveBeenCalled())
    expect(withdrawCalls()).toHaveLength(0)
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('shows on the card why a version could no longer be withdrawn, and where it stands now', async () => {
    serve([comment({ status: 'approved', approvalExpiresAt: IN_A_WEEK, publication: { state: 'publishing' }, canWithdraw: true })])
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('Already published. Delete or change it instead.'), { status: 409, errors: { publication: ['published'] } }))
    show()
    const withdraw = await screen.findByText('Withdraw')
    serve([comment({ status: 'approved', approvalExpiresAt: IN_A_WEEK, publication: { state: 'published', at: new Date().toISOString() } })])
    fireEvent.click(withdraw)
    expect(await screen.findByLabelText(/^Review status: Published/)).toBeTruthy()
    expect((await screen.findByRole('alert')).textContent).toBe('Already published. Delete or change it instead.')
    expect(m.announce).toHaveBeenCalledWith('Already published. Delete or change it instead.', { queue: true })
    expect(api.get).toHaveBeenCalledTimes(2)
    // Refresh starts the cards afresh.
    fireEvent.click(screen.getByLabelText('Refresh publication reviews'))
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3))
    expect(await screen.findByLabelText(/^Review status: Published/)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps Withdraw to try again when the request may not have reached the API, and says so out loud', async () => {
    serve([comment({ canWithdraw: true })])
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('Could not reach Ujimora. Check your connection and try again.'), { status: 0 }))
    show()
    fireEvent.click(await screen.findByText('Withdraw'))
    expect((await screen.findByRole('alert')).textContent).toBe('Could not withdraw it. Check your connection and try again.')
    expect(api.get).toHaveBeenCalledTimes(1)
    expect((screen.getByText('Withdraw') as HTMLButtonElement).disabled).toBe(false)
    // A new alert is not read out by VoiceOver, so it is announced.
    expect(m.announce).toHaveBeenCalledExactlyOnceWith('Could not withdraw it. Check your connection and try again.', { queue: true })
    expect(m.clearIdentityDraft).not.toHaveBeenCalled()
  })

  it('never claims approval publishes anything while the API says it is off, whatever else it reports', async () => {
    serve([
      comment({ status: 'approved', approvalExpiresAt: IN_A_WEEK, publishOnApproval: false, publication: { state: 'published', at: new Date().toISOString() } }),
      comment({ id: 'review-3', status: 'withdrawn', publishOnApproval: false, publication: { state: 'withdrawn', reason: 'withdrawn_by_author' } }),
      review({ id: 'review-4', action: 'creator.profile', text: JSON.stringify({ displayName: 'Ama' }), status: 'superseded', publishOnApproval: false, publication: { state: 'superseded', reason: 'newer_version_submitted' } }),
    ])
    show()
    expect(await screen.findByText('Held changes stay private until they are published.')).toBeTruthy()
    expect(screen.queryByText("Held changes stay private until they're approved.")).toBeNull()
  })

  it('keeps the cards in place while the list reloads', async () => {
    serve([comment({ canWithdraw: true })])
    show()
    expect(await screen.findByLabelText('Review status: In review')).toBeTruthy()
    let finish: (value: unknown) => void = () => {}
    vi.mocked(api.get).mockReturnValueOnce(new Promise(resolve => { finish = resolve }) as never)
    fireEvent.click(screen.getByLabelText('Refresh publication reviews'))
    expect(screen.getByLabelText('Review status: In review')).toBeTruthy()
    expect(screen.queryByText('Loading reviews…')).toBeNull()
    finish({ items: [comment({ canWithdraw: true })], total: 1 })
    await waitFor(() => expect((screen.getByLabelText('Refresh publication reviews') as HTMLButtonElement).disabled).toBe(false))
  })

  it('offers Withdraw only where the API allows it', async () => {
    serve([comment(), comment({ id: 'review-4', canWithdraw: false })])
    show()
    expect(await screen.findAllByLabelText('Review status: In review')).toHaveLength(2)
    expect(screen.queryByText('Withdraw')).toBeNull()
  })

  it('keeps the tracker and hints of today while publishing on approval is switched off', async () => {
    // As the API answers then: nothing publishes by itself; a waiting version can still be withdrawn.
    serve([comment({ publishOnApproval: false, canWithdraw: true }), comment({ id: 'review-5', status: 'approved', approvalExpiresAt: IN_A_WEEK, publishOnApproval: false, canWithdraw: false })])
    show()
    expect(await screen.findByLabelText('Review status: In review')).toBeTruthy()
    expect(labels('Review status: In review')).toEqual(['Submitted', 'In review', 'Approved'])
    expect(labels('Review status: Approved')).toEqual(['Submitted', 'In review', 'Approved'])
    expect(screen.getByText('A person is checking it.')).toBeTruthy()
    expect(screen.getByText(/^Approved\. If it isn't public yet, post it again unchanged before .+\.$/)).toBeTruthy()
    expect(screen.getByText('Held changes stay private until they are published.')).toBeTruthy()
    expect(screen.getAllByText('Withdraw')).toHaveLength(1)
  })
})
