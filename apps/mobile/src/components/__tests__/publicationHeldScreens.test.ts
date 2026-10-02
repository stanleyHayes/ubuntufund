import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'

type Props = Record<string, unknown> & { children?: React.ReactNode }
const m = vi.hoisted(() => ({
  el: (tag: string) => ({ children }: { children?: React.ReactNode }) => createElement(tag, {}, children),
  user: { id: 'ama' } as { id: string } | null,
  loadDraft: vi.fn(async (_userId: string): Promise<{ fields: Record<string, string>; publishesOnApproval: boolean } | null> => null),
  saveDraft: vi.fn(async (_userId: string, _fields: Record<string, string>, _publishesOnApproval?: boolean) => {}),
  clearDraft: vi.fn(async (_userId: string) => {}),
  getMyCreator: vi.fn(),
  saveCreatorProfile: vi.fn(),
  /** How many times a Publication reviews list was mounted, so loaded. */
  reviewLists: 0,
}))
vi.mock('react-native', () => ({
  View: m.el('div'), ScrollView: m.el('div'), Image: () => null, StyleSheet: { create: <T,>(styles: T) => styles, absoluteFill: {} },
  Share: { share: vi.fn() }, useWindowDimensions: () => ({ width: 360, height: 640 }),
  Animated: { View: m.el('div'), Value: class { constructor(public value: number) {} }, loop: () => ({ start: () => {} }), sequence: () => ({}), timing: () => ({}) },
}))
vi.mock('react-native-paper', () => {
  const Dialog = Object.assign(({ children, visible }: Props) => visible ? createElement('div', { role: 'dialog' }, children) : null, { Title: m.el('h2'), ScrollArea: m.el('div'), Actions: m.el('div') })
  return {
    Text: ({ children }: Props) => createElement('span', {}, children), Icon: () => null, Portal: ({ children }: Props) => children, Dialog,
    Snackbar: ({ children, visible }: Props) => visible ? createElement('output', {}, children) : null,
    Switch: ({ value, onValueChange, disabled }: Props) => createElement('input', { type: 'checkbox', checked: !!value, disabled, onChange: () => (onValueChange as (next: boolean) => void)(!value) }),
  }
})
vi.mock('expo-router', () => ({ Stack: { Screen: () => null }, router: { push: vi.fn(), replace: vi.fn() } }))
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }))
vi.mock('country-state-city', () => ({ Country: { getAllCountries: () => [] } }))
vi.mock('@/theme', () => ({ SKINS: [] }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: m.user, replaceTokens: vi.fn(), logout: vi.fn() }) }))
vi.mock('@/context/ColorModeContext', () => ({
  usePalette: () => ({}), useNeu: () => ({ raised: {}, subtle: {}, inset: {} }),
  useColorMode: () => ({ mode: 'light', setMode: vi.fn(), skin: 'neumorphism', setSkin: vi.fn() }),
}))
vi.mock('@/lib/publicationDrafts', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/publicationDrafts')>(),
  loadIdentityDraft: m.loadDraft, saveIdentityDraft: m.saveDraft, clearIdentityDraft: m.clearDraft,
}))
vi.mock('@/lib/creators', () => ({ getMyCreator: m.getMyCreator, saveCreatorProfile: m.saveCreatorProfile, requestWithdrawal: vi.fn(), listMyPayouts: vi.fn(async () => []) }))
vi.mock('@/lib/session', () => ({ sessionSnapshot: () => null, establishSession: vi.fn() }))
vi.mock('@/lib/accountSecurity', () => ({ changePassword: vi.fn() }))
vi.mock('@/components/Loading', () => ({
  PageSkeleton: () => createElement('p', {}, 'Loading'), SkeletonLoader: () => null,
  Button: ({ children, onPress, disabled }: Props) => createElement('button', { onClick: onPress, disabled }, children),
}))
vi.mock('@/components/BrandedTextInput', () => ({
  BrandedTextInput: ({ label, value, onChangeText }: Props) => createElement('textarea', { 'aria-label': label, value, onChange: (event: { target: { value: string } }) => (onChangeText as (value: string) => void)(event.target.value) }),
}))
vi.mock('@/components/GlassSurface', () => ({ GlassSurface: m.el('section') }))
vi.mock('@/components/KeyboardAvoider', () => ({ KeyboardAvoider: m.el('div') }))
vi.mock('@/components/UjimoraLogo', () => ({ UjimoraLogo: () => null }))
vi.mock('@/components/MediaUploadField', () => ({ MediaUploadField: () => null }))
vi.mock('@/components/SelectionField', () => ({ SelectionField: () => null }))
vi.mock('@/components/Chip', () => ({ Chip: m.el('span') }))
vi.mock('@/components/RoundedControls', () => ({ SegmentedButtons: () => null, TouchableRipple: m.el('div') }))
vi.mock('@/components/PublicationConsent', () => ({ PublicationConsent: () => null }))
vi.mock('@/components/OrganizationIdentityEditor', () => ({ OrganizationIdentityEditor: () => null }))
vi.mock('@/components/PublicationReviews', async () => {
  const { useEffect } = await import('react')
  return {
    PublicationReviews: ({ actions }: Props) => {
      useEffect(() => { m.reviewLists += 1 }, [])
      return createElement('p', {}, `Publication reviews: ${(actions as string[] | undefined)?.join(', ') ?? 'all'}`)
    },
  }
})
/** What the notice was asked to say. */
vi.mock('@/components/PublicationHeldNotice', () => ({
  PublicationHeldNotice: ({ publishesOnApproval, otherChangesSaved, retry }: Props) => createElement('p', { 'data-testid': 'held' },
    [otherChangesSaved && 'Other changes saved', publishesOnApproval ? 'Published on approval' : `Then ${retry as string}`].filter(Boolean).join(' · ')),
}))
vi.mock('@/components/BiometricSettings', () => ({ BiometricSettings: () => null }))
vi.mock('@/components/MfaSettings', () => ({ MfaSettings: () => null }))
vi.mock('@/components/DataRightsRequests', () => ({ DataRightsRequests: () => null }))
vi.mock('@/components/ActivityAlertSettings', () => ({ ActivityAlertSettings: () => null }))
vi.mock('@/components/NewsletterSettings', () => ({ NewsletterSettings: () => null }))
vi.mock('@/components/DonorMessageSettings', () => ({ DonorMessageSettings: () => null }))
vi.mock('@/components/BlockedUsers', () => ({ BlockedUsers: () => null }))
vi.mock('@/components/DeleteAccountSection', () => ({ DeleteAccountSection: () => null }))
vi.mock('@/components/SignInRequired', () => ({ SignInRequired: () => null }))
import EditProfileScreen from '../../../app/profile/edit'
import CreatorDashboardScreen from '../../../app/creator'
import SettingsScreen from '../../../app/settings'

const AUTOMATIC = 'Saved privately for safety review. Your content has not been published yet. It will be published automatically once a reviewer approves it; check Publication reviews for the decision.'
const MANUAL = 'Saved privately for safety review. Your content has not been published. Keep your draft and check Publication reviews before submitting this same version again.'
const held = (errors: Record<string, string[]>) => Object.assign(new Error(errors.publication.includes('publishes_on_approval') ? AUTOMATIC : MANUAL), { status: 409, errors })
const notice = () => screen.getByTestId('held').textContent
const RESTORED_AUTOMATIC = "We restored the changes you last submitted for review. If they're still waiting for review, they go live automatically once approved. If they couldn't be published, save them again."
const RESTORED_MANUAL = 'We restored the changes you last submitted for review. Save them again once they are approved.'
const NEW_PHOTO = 'https://media.example.test/new.jpg'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.put).mockReset(); vi.mocked(api.post).mockReset()
  m.user = { id: 'ama' }
  m.loadDraft.mockResolvedValue(null)
  m.reviewLists = 0
})
afterEach(cleanup)

describe('edit profile', () => {
  const live = { name: 'Ama', phone: '', bio: '', country: 'Ghana', avatarUrl: '', coverUrl: '' }
  beforeEach(() => vi.mocked(api.get).mockResolvedValue(live))

  it('says a held name is published on approval and the rest of the save went through', async () => {
    vi.mocked(api.put).mockRejectedValue(held({ publication: ['held', 'publishes_on_approval'], saved: ['private'] }))
    render(createElement(EditProfileScreen))
    fireEvent.change(await screen.findByLabelText('name'), { target: { value: 'Ama Owusu' } })
    fireEvent.change(screen.getByLabelText('bio'), { target: { value: 'Nurse in Kumasi' } })
    fireEvent.click(screen.getByText('Save profile'))
    await waitFor(() => expect(notice()).toBe('Other changes saved · Published on approval'))
    expect(api.put).toHaveBeenCalledWith('/profile', { name: 'Ama Owusu', phone: '', bio: 'Nurse in Kumasi', automatedReviewConsent: false })
    expect(screen.getByText('Publication reviews: account.profile')).toBeTruthy()
    // Kept on the device in case an approval cannot publish it.
    expect(m.saveDraft).toHaveBeenCalledWith('ama', { name: 'Ama Owusu' }, true)
  })

  it('asks to save a held name again after a manual approval', async () => {
    vi.mocked(api.put).mockRejectedValue(held({ publication: ['held'] }))
    render(createElement(EditProfileScreen))
    fireEvent.change(await screen.findByLabelText('name'), { target: { value: 'Ama Owusu' } })
    fireEvent.click(screen.getByText('Save profile'))
    await waitFor(() => expect(notice()).toBe('Then save it again unchanged'))
    expect(m.saveDraft).toHaveBeenCalledWith('ama', { name: 'Ama Owusu' }, false)
  })

  it('restores a held photo that is not public yet, saying what its approval does', async () => {
    m.loadDraft.mockResolvedValue({ fields: { avatarUrl: NEW_PHOTO }, publishesOnApproval: true })
    render(createElement(EditProfileScreen))
    expect(await screen.findByText(RESTORED_AUTOMATIC)).toBeTruthy()
    expect(m.clearDraft).not.toHaveBeenCalled()
    cleanup()
    m.loadDraft.mockResolvedValue({ fields: { avatarUrl: NEW_PHOTO }, publishesOnApproval: false })
    render(createElement(EditProfileScreen))
    expect(await screen.findByText(RESTORED_MANUAL)).toBeTruthy()
  })

  it('forgets a held photo once it is public', async () => {
    m.loadDraft.mockResolvedValue({ fields: { avatarUrl: NEW_PHOTO }, publishesOnApproval: true })
    vi.mocked(api.get).mockResolvedValue({ ...live, avatarUrl: NEW_PHOTO })
    render(createElement(EditProfileScreen))
    await waitFor(() => expect(m.clearDraft).toHaveBeenCalledWith('ama'))
    expect(screen.getByText('Save profile')).toBeTruthy()
    expect(screen.queryByText(/^We restored/)).toBeNull()
  })
})

describe('creator page', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ accounts: [] })
    m.getMyCreator.mockResolvedValue({
      policy: { eligible: true, planName: 'Pro', feePercent: 5 },
      profile: { handle: 'ama', displayName: 'Ama', tipsEnabled: true, presetAmounts: [], currency: 'GHS' },
      balance: { availableBalance: 0, paidOutBalance: 0, totalReceived: 0, currency: 'GHS' },
    })
  })

  it('says held page changes are published on approval', async () => {
    m.saveCreatorProfile.mockRejectedValue(held({ publication: ['held', 'publishes_on_approval'] }))
    render(createElement(CreatorDashboardScreen))
    fireEvent.change(await screen.findByLabelText('Display name'), { target: { value: 'Ama Owusu' } })
    fireEvent.click(screen.getByText('Save changes'))
    await waitFor(() => expect(notice()).toBe('Published on approval'))
    expect(screen.getByText('Publication reviews: creator.profile')).toBeTruthy()
  })

  it('asks to save again after a manual approval', async () => {
    m.saveCreatorProfile.mockRejectedValue(held({ publication: ['held'] }))
    render(createElement(CreatorDashboardScreen))
    fireEvent.click(await screen.findByText('Save changes'))
    await waitFor(() => expect(notice()).toBe('Then save it again unchanged'))
    vi.mocked(api.post).mockResolvedValue({})
    fireEvent.click(screen.getByText('Pause tips now'))
    expect(await screen.findByText('Tips paused. Your other draft changes are retained.')).toBeTruthy()
  })

  it('says pausing tips means the changes waiting for review are not published', async () => {
    m.saveCreatorProfile.mockRejectedValue(held({ publication: ['held', 'publishes_on_approval'] }))
    vi.mocked(api.post).mockResolvedValue({})
    render(createElement(CreatorDashboardScreen))
    fireEvent.click(await screen.findByText('Save changes'))
    await waitFor(() => expect(notice()).toBe('Published on approval'))
    fireEvent.click(screen.getByText('Pause tips now'))
    expect(await screen.findByText("Tips paused. Your changes waiting for review won't be published; save them again to resubmit.")).toBeTruthy()
    expect(api.post).toHaveBeenCalledWith('/creators/profile', { tipsEnabled: false })
    expect(screen.queryByTestId('held')).toBeNull()
  })
})

describe('settings', () => {
  beforeEach(() => vi.mocked(api.get).mockResolvedValue({ publicProfile: false, anonymousDonations: false, showLeaderboards: true }))
  /** Anonymous donations, leaderboard, public profile. */
  const publicProfile = async () => (await screen.findAllByRole('checkbox'))[2] as HTMLInputElement

  it('says turning the profile public is published on approval, and keeps the switch off meanwhile', async () => {
    vi.mocked(api.put).mockRejectedValue(held({ publication: ['held', 'publishes_on_approval'] }))
    render(createElement(SettingsScreen))
    fireEvent.click(await publicProfile())
    await waitFor(() => expect(notice()).toBe('Published on approval'))
    expect(api.put).toHaveBeenCalledWith('/profile', { publicProfile: true, automatedReviewConsent: false })
    expect((await publicProfile()).checked).toBe(false)
    // The list below loads again, so it shows the held version and offers to withdraw it.
    expect(m.reviewLists).toBe(2)
  })

  it('asks to turn it on again after a manual approval', async () => {
    vi.mocked(api.put).mockRejectedValue(held({ publication: ['held'] }))
    render(createElement(SettingsScreen))
    fireEvent.click(await publicProfile())
    await waitFor(() => expect(notice()).toBe('Then turn on Public profile again'))
  })
})
