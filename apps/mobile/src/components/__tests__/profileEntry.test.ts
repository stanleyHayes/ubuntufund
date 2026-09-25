import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'

const m = vi.hoisted(() => ({
  el: (tag: string) => ({ children }: { children?: React.ReactNode }) => createElement(tag, {}, children),
  push: vi.fn(), user: { id: 'viewer' } as { id: string } | null, profileId: 'b'.repeat(24), safety: vi.fn(),
}))
vi.mock('react-native', () => ({
  View: m.el('div'), ScrollView: m.el('div'), StyleSheet: { create: <T,>(styles: T) => styles }, Alert: { alert: vi.fn() },
  AppState: { currentState: 'active', addEventListener: () => ({ remove: () => {} }) },
}))
vi.mock('react-native-paper', () => ({
  Avatar: { Text: () => null }, Surface: m.el('div'),
  Text: ({ children, onPress, accessibilityRole }: { children: React.ReactNode; onPress?: () => void; accessibilityRole?: string }) => createElement(onPress ? 'a' : 'span', { onClick: onPress, role: accessibilityRole }, children),
}))
vi.mock('expo-router', async () => {
  const React = await import('react')
  return {
    router: { push: m.push }, Link: m.el('a'), Stack: { Screen: () => null },
    useLocalSearchParams: () => ({ id: m.profileId }),
    useFocusEffect: (callback: () => void | (() => void)) => { React.useEffect(() => callback() || undefined, [callback]) },
  }
})
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: m.user }) }))
vi.mock('@/context/ColorModeContext', () => ({ usePalette: () => ({}), useNeu: () => ({}) }))
vi.mock('@/hooks/useCampaigns', () => ({ useUser: () => ({ user: null, isLoading: false }) }))
vi.mock('../PublicationConsent', () => ({ PublicationConsent: () => null }))
vi.mock('../ReportContent', () => ({ ReportContent: () => null }))
vi.mock('../BlockedUsers', () => ({ BlockedUsers: () => null }))
vi.mock('@/components/RoundedControls', () => ({
  IconButton: () => null,
  TouchableOpacity: ({ children, onPress, accessibilityLabel }: { children: React.ReactNode; onPress: () => void; accessibilityLabel: string }) => createElement('button', { onClick: onPress, 'aria-label': accessibilityLabel }, children),
}))
vi.mock('@/components/Loading', () => ({ SkeletonLoader: () => null, Button: m.el('button') }))
vi.mock('@/components/BrandedNativeInput', () => ({ BrandedNativeInput: () => null }))
vi.mock('@/components/Chip', () => ({ Chip: m.el('span') }))
vi.mock('@/components/TrustBadge', () => ({ TrustBadge: () => null }))
vi.mock('@/components/UserSafetyControls', () => ({ UserSafetyControls: (props: { userId: string }) => { m.safety(props); return createElement('p', {}, `Safety controls for ${props.userId}`) } }))
import { CampaignComments } from '../CampaignComments'
import ProfileScreen from '../../../app/profile/[id]'
const authorId = 'a'.repeat(24)
beforeEach(() => {
  vi.clearAllMocks(); m.user = { id: 'viewer' }; m.profileId = 'b'.repeat(24)
  vi.mocked(api.get).mockResolvedValue({ items: [{ id: 'c1', campaignId: 'camp', authorId, authorName: 'Kofi', content: 'Great cause', createdAt: '2026-09-01' }] })
})
afterEach(cleanup)

it('opens the public profile from a comment author name or avatar', async () => {
  render(createElement(CampaignComments, { campaignId: 'camp', creatorId: 'owner' }))
  fireEvent.click(await screen.findByRole('link', { name: 'Kofi' }))
  expect(m.push).toHaveBeenCalledWith(`/profile/${authorId}`)
  fireEvent.click(screen.getByLabelText("View Kofi's profile"))
  expect(m.push).toHaveBeenCalledTimes(2)
})

it('does not link authors without a real account id', async () => {
  vi.mocked(api.get).mockResolvedValue({ items: [{ id: 'c2', campaignId: 'camp', authorId: 'deleted', authorName: 'Former member', content: 'Hi', createdAt: '2026-09-01' }] })
  render(createElement(CampaignComments, { campaignId: 'camp', creatorId: 'owner' }))
  expect(await screen.findByText('Former member')).toBeTruthy()
  expect(screen.queryByRole('link')).toBeNull()
})

it('keeps report and block available when a hidden profile returns not found', () => {
  render(createElement(ProfileScreen))
  expect(screen.getByText('This profile is not available.')).toBeTruthy()
  expect(m.safety).toHaveBeenCalledWith(expect.objectContaining({ userId: 'b'.repeat(24) }))
  cleanup(); m.safety.mockClear(); m.profileId = 'not-an-id'
  render(createElement(ProfileScreen))
  expect(m.safety).not.toHaveBeenCalled()
})
