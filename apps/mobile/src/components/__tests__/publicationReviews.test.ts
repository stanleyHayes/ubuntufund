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
}))
vi.mock('react-native', () => ({
  View: ({ children, accessibilityLabel }: Props) => createElement('div', { 'aria-label': accessibilityLabel }, children),
  StyleSheet: { create: <T,>(styles: T) => styles },
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

beforeEach(() => { vi.clearAllMocks(); m.charsPerLine = 40 })
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
