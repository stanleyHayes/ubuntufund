import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CampaignComment } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

type Props = Record<string, unknown> & { children?: React.ReactNode }
const m = vi.hoisted(() => ({
  el: (tag: string) => ({ children }: { children?: React.ReactNode }) => createElement(tag, {}, children),
  user: { id: 'author' } as { id: string; role?: string } | null,
  alert: vi.fn(),
}))
vi.mock('react-native', () => ({
  View: m.el('div'), ScrollView: m.el('div'), StyleSheet: { create: <T,>(styles: T) => styles }, Alert: { alert: m.alert },
  AppState: { currentState: 'active', addEventListener: () => ({ remove: () => {} }) },
}))
vi.mock('react-native-paper', () => {
  const Dialog = Object.assign(({ children, visible }: Props) => visible ? createElement('div', { role: 'dialog' }, children) : null, { Title: m.el('h2'), ScrollArea: m.el('div'), Actions: m.el('div') })
  return {
    Text: ({ children, accessibilityRole }: Props) => createElement('span', { role: accessibilityRole === 'alert' ? 'alert' : undefined }, children),
    Icon: () => null, Avatar: { Text: () => null }, Portal: ({ children }: Props) => children, Dialog,
    Checkbox: { Item: ({ label, onPress }: Props) => createElement('button', { onClick: onPress }, label as string) },
    Button: ({ children, onPress, disabled }: Props) => createElement('button', { onClick: onPress, disabled }, children),
  }
})
vi.mock('expo-router', async () => {
  const React = await import('react')
  return { router: { push: vi.fn() }, useFocusEffect: (effect: () => void | (() => void)) => { React.useEffect(() => effect() || undefined, [effect]) } }
})
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: m.user }) }))
vi.mock('@/context/ColorModeContext', () => ({ usePalette: () => ({}), useNeu: () => ({}) }))
vi.mock('@/components/RoundedControls', () => ({ IconButton: () => null, TouchableOpacity: m.el('div') }))
vi.mock('@/components/Loading', () => ({ SkeletonLoader: () => null, Button: ({ children, onPress, disabled }: Props) => createElement('button', { onClick: onPress, disabled }, children) }))
vi.mock('@/components/BrandedNativeInput', () => ({
  BrandedNativeInput: ({ value, onChangeText, placeholder }: Props) => createElement('textarea', { 'aria-label': placeholder, value, onChange: (event: { target: { value: string } }) => (onChangeText as (value: string) => void)(event.target.value) }),
}))
vi.mock('@/components/BrandedTextInput', () => ({
  BrandedTextInput: ({ label, value, onChangeText }: Props) => createElement('textarea', { 'aria-label': label, value, onChange: (event: { target: { value: string } }) => (onChangeText as (value: string) => void)(event.target.value) }),
}))
vi.mock('@/components/SelectionField', () => ({ SelectionField: ({ label, value }: Props) => createElement('input', { 'aria-label': label, value, readOnly: true }) }))
vi.mock('@/components/GlassSurface', () => ({ GlassSurface: m.el('section') }))
vi.mock('../PublicationConsent', () => ({ PublicationConsent: () => null }))
vi.mock('../ReportContent', () => ({ ReportContent: () => null }))
vi.mock('../BlockedUsers', () => ({ BlockedUsers: () => null }))
vi.mock('../PublicationReviews', () => ({ PublicationReviews: ({ actions }: Props) => createElement('p', {}, `Publication reviews: ${(actions as string[]).join(', ')}`) }))
/** What the notice was asked to say. */
vi.mock('../PublicationHeldNotice', () => ({
  PublicationHeldNotice: ({ publishesOnApproval, retry, openSettings }: Props) => createElement('p', { 'data-testid': 'held' },
    `${publishesOnApproval ? 'Published on approval' : `Then ${retry as string}`}${openSettings ? ' · Open Publication reviews' : ''}`),
}))
import { CampaignComments } from '../CampaignComments'
import { CampaignUpdateComposer } from '../CampaignUpdateComposer'
import { OrganizationIdentityEditor } from '../OrganizationIdentityEditor'

const AUTOMATIC = 'Saved privately for safety review. Your content has not been published yet. It will be published automatically once a reviewer approves it; check Publication reviews for the decision.'
const MANUAL = 'Saved privately for safety review. Your content has not been published. Keep your draft and check Publication reviews before submitting this same version again.'
const heldAutomatically = () => Object.assign(new Error(AUTOMATIC), { status: 409, errors: { publication: ['held', 'publishes_on_approval'] } })
const heldManually = () => Object.assign(new Error(MANUAL), { status: 409, errors: { publication: ['held'] } })
const notice = () => screen.getByTestId('held').textContent
const field = (label: string) => screen.getByLabelText(label) as HTMLTextAreaElement
const comment = (fields: Partial<CampaignComment> = {}): CampaignComment => ({ id: 'c1', campaignId: 'camp', authorId: 'author', authorName: 'Kofi', content: 'Stay strong!', createdAt: new Date('2026-10-01T09:00:00.000Z'), updatedAt: new Date('2026-10-01T09:00:00.000Z'), ...fields })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.post).mockReset(); vi.mocked(api.put).mockReset()
  m.user = { id: 'author' }
  vi.mocked(api.get).mockResolvedValue({ items: [] })
})
afterEach(cleanup)

describe('comment composer', () => {
  const PLACEHOLDER = 'Share encouragement or ask a question…'
  async function post(text: string) {
    render(createElement(CampaignComments, { campaignId: 'camp', creatorId: 'owner' }))
    fireEvent.change(await screen.findByLabelText(PLACEHOLDER), { target: { value: text } })
    fireEvent.click(screen.getByText('Post comment'))
  }

  it('starts afresh when the approval posts the held comment', async () => {
    vi.mocked(api.post).mockRejectedValue(heldAutomatically())
    await post('Stay strong!')
    await waitFor(() => expect(notice()).toBe('Published on approval · Open Publication reviews'))
    expect(field(PLACEHOLDER).value).toBe('')
    expect(m.alert).not.toHaveBeenCalled()
  })

  it('keeps the comment to post again when the author publishes it after approval', async () => {
    vi.mocked(api.post).mockRejectedValue(heldManually())
    await post('Stay strong!')
    await waitFor(() => expect(notice()).toBe('Then post it again unchanged · Open Publication reviews'))
    expect(field(PLACEHOLDER).value).toBe('Stay strong!')
  })

  it('lists a comment the API answers with again only once', async () => {
    vi.mocked(api.get).mockResolvedValue({ items: [comment()] })
    vi.mocked(api.post).mockResolvedValue(comment())
    await post('Stay strong!')
    await waitFor(() => expect(field(PLACEHOLDER).value).toBe(''))
    expect(screen.getAllByText('Stay strong!')).toHaveLength(1)
    expect(screen.queryByTestId('held')).toBeNull()
  })

  it('still reports a failure as one', async () => {
    vi.mocked(api.post).mockRejectedValue(Object.assign(new Error('You already posted this exact comment; change it to post again.'), { status: 409 }))
    await post('Stay strong!')
    await waitFor(() => expect(m.alert).toHaveBeenCalledWith('Could not post', 'You already posted this exact comment; change it to post again.'))
    expect(screen.queryByTestId('held')).toBeNull()
    expect(field(PLACEHOLDER).value).toBe('Stay strong!')
  })
})

describe('campaign update composer', () => {
  async function write() {
    render(createElement(CampaignUpdateComposer, { campaignId: 'c1', onPosted: vi.fn() }))
    fireEvent.click(screen.getByText('Post an update'))
    fireEvent.change(field('Title'), { target: { value: 'Halfway there' } })
    fireEvent.change(field('Update'), { target: { value: 'Thank you all.' } })
    fireEvent.click(screen.getByText('Pin this update to the top'))
    fireEvent.click(screen.getByText('Post update'))
  }

  it('clears the dialog down to the notice when the approval posts the held update', async () => {
    vi.mocked(api.post).mockRejectedValue(heldAutomatically())
    await write()
    await waitFor(() => expect(notice()).toBe('Published on approval'))
    expect(api.post).toHaveBeenCalledWith('/campaigns/c1/updates', { title: 'Halfway there', content: 'Thank you all.', type: 'general', isPinned: true, automatedReviewConsent: false })
    // Nothing more to post here: no fields, and Close instead of Cancel and Post update.
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.queryByLabelText('Title')).toBeNull()
    expect(screen.queryByText('Post update')).toBeNull()
    fireEvent.click(screen.getByText('Close'))
    expect(screen.queryByRole('dialog')).toBeNull()
    // The next update starts empty.
    fireEvent.click(screen.getByText('Post an update'))
    expect(field('Title').value).toBe('')
    expect(field('Update').value).toBe('')
    expect(screen.queryByTestId('held')).toBeNull()
  })

  it('keeps the dialog and its fields when the author posts it again after approval', async () => {
    vi.mocked(api.post).mockRejectedValue(heldManually())
    await write()
    await waitFor(() => expect(notice()).toBe('Then post it again unchanged'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(field('Title').value).toBe('Halfway there')
    fireEvent.click(screen.getByText('Cancel'))
    fireEvent.click(screen.getByText('Post an update'))
    expect(field('Title').value).toBe('Halfway there')
    expect(notice()).toBe('Then post it again unchanged')
  })
})

describe('organization identity', () => {
  async function save() {
    m.user = { id: 'org1', role: 'organization' }
    vi.mocked(api.get).mockResolvedValue({ name: 'Clinic Trust', website: 'https://clinic.example' })
    render(createElement(OrganizationIdentityEditor))
    fireEvent.change(await screen.findByLabelText('Organization name'), { target: { value: 'Clinic Trust Ghana' } })
    fireEvent.click(screen.getByText('Save organization details'))
  }

  it('says the approval publishes held details, with the list beside it', async () => {
    vi.mocked(api.put).mockRejectedValue(heldAutomatically())
    await save()
    await waitFor(() => expect(notice()).toBe('Published on approval'))
    expect(screen.getByText('Publication reviews: organization.profile')).toBeTruthy()
    expect(api.put).toHaveBeenCalledWith('/organization-team/org1/profile', { organizationName: 'Clinic Trust Ghana', website: 'https://clinic.example', automatedReviewConsent: false })
  })

  it('asks to save again after a manual approval', async () => {
    vi.mocked(api.put).mockRejectedValue(heldManually())
    await save()
    await waitFor(() => expect(notice()).toBe('Then save it again unchanged'))
  })
})
