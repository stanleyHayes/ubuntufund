import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Props = Record<string, unknown> & { children?: React.ReactNode }
const m = vi.hoisted(() => ({ push: vi.fn(), announce: vi.fn() }))
vi.mock('react-native', () => ({
  View: ({ children, accessibilityLiveRegion }: Props) => createElement('div', { 'aria-live': accessibilityLiveRegion }, children),
  AccessibilityInfo: { announceForAccessibilityWithOptions: m.announce },
}))
vi.mock('react-native-paper', () => ({ Text: ({ children }: Props) => createElement('span', {}, children), Icon: () => null }))
vi.mock('expo-router', () => ({ router: { push: m.push } }))
vi.mock('@/context/ColorModeContext', () => ({ usePalette: () => ({ primary: '#2E3D2F', text: '#1A2E22' }) }))
vi.mock('../Loading', () => ({ Button: ({ children, onPress }: Props) => createElement('button', { onClick: onPress }, children) }))
import { PublicationHeldNotice } from '../PublicationHeldNotice'

const show = (props: Parameters<typeof PublicationHeldNotice>[0] = {}) => render(createElement(PublicationHeldNotice, props))
/** The notice's sentences, after its title. */
const message = () => screen.getByText(/^(Your other changes|Saved privately)/).textContent

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('held for safety review notice', () => {
  it('asks the author to submit it again after a manual approval', () => {
    show({ retry: 'save it again unchanged', reviews: 'below' })
    expect(screen.getByText('Waiting for safety review')).toBeTruthy()
    expect(message()).toBe('Saved privately for safety review. This version is not public yet. After a reviewer approves it, save it again unchanged to publish it. Check Publication reviews below for the decision.')
    expect(m.announce).toHaveBeenCalledWith('Waiting for safety review. Saved privately; this version is not public yet.', { queue: true })
  })

  it('says an approval publishes it by itself, and where to withdraw it', () => {
    show({ retry: 'save it again unchanged', reviews: 'below', publishesOnApproval: true })
    expect(message()).toBe("Saved privately for safety review. It isn't public yet. Once a reviewer approves it, it's published automatically, so you don't need to submit it again. Check Publication reviews below for the decision; you can withdraw it there.")
    expect(document.body.textContent).not.toMatch(/save it again unchanged/)
    expect(m.announce).toHaveBeenCalledWith('Waiting for safety review. Saved privately; it is published automatically once approved.', { queue: true })
  })

  it('points to Settings when the list is not on the screen, with a button to it', () => {
    show({ publishesOnApproval: true, openSettings: true })
    expect(message()).toMatch(/ Check Settings → Publication reviews for the decision; you can withdraw it there\.$/)
    fireEvent.click(screen.getByText('Open Publication reviews'))
    expect(m.push).toHaveBeenCalledWith('/settings')
    cleanup()
    show()
    expect(message()).toBe('Saved privately for safety review. This version is not public yet. After a reviewer approves it, submit it again unchanged to publish it. Check Settings → Publication reviews for the decision.')
    expect(screen.queryByText('Open Publication reviews')).toBeNull()
  })

  it('says what the approval does for the form', () => {
    show({ reviews: 'below', publishesOnApproval: true, whenApproved: "we email it to your donors automatically, so you don't need to send it again" })
    expect(message()).toBe("Saved privately for safety review. It isn't public yet. Once a reviewer approves it, we email it to your donors automatically, so you don't need to send it again. Check Publication reviews below for the decision; you can withdraw it there.")
  })

  it('says the rest of a held save went through', () => {
    show({ reviews: 'below', publishesOnApproval: true, otherChangesSaved: true })
    expect(message()).toMatch(/^Your other changes are saved\. Saved privately for safety review\. It isn't public yet\./)
    cleanup()
    show({ reviews: 'below', otherChangesSaved: true })
    expect(message()).toMatch(/^Your other changes are saved\. Saved privately for safety review\. This version is not public yet\./)
  })

  it('stays a polite status, never an alert', () => {
    show({ publishesOnApproval: true })
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
