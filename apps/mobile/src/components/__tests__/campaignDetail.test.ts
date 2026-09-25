import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'

const m = vi.hoisted(() => ({
  el: (tag: string) => ({ children }: { children?: React.ReactNode }) => createElement(tag, {}, children),
  user: null as null | { id: string },
  updates: vi.fn(), report: vi.fn(),
}))
vi.mock('react-native', () => ({ View: m.el('div'), ScrollView: m.el('div'), StyleSheet: { create: <T,>(styles: T) => styles } }))
vi.mock('react-native-paper', () => ({ Text: 'span', Surface: m.el('div'), Avatar: { Text: () => null }, Icon: () => null }))
vi.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'c1' }), Stack: { Screen: () => null }, router: { push: vi.fn() } }))
vi.mock('@/hooks/useCampaigns', () => ({
  useCampaign: () => ({ isLoading: false, error: null, donationError: null, campaign: {
    id: 'c1', creatorId: 'owner', title: 'Clinic roof', description: 'Fix the roof', category: 'health', priority: 'normal', status: 'active',
    currency: 'GHS', goalAmount: 1000, raisedAmount: 100.5, donorCount: 1, beneficiaries: [], imageUrls: [],
    startDate: '2026-09-01', endDate: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    donations: [{ id: 'd1', donorName: 'Ama', isAnonymous: false, amount: 20.1, createdAt: '2026-09-02' }],
  } }),
  useUser: () => ({ user: null }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: m.user }) }))
vi.mock('@/context/ColorModeContext', () => ({ usePalette: () => ({}), useNeu: () => ({}) }))
vi.mock('@/components/ReportContent', () => ({ ReportContent: () => null }))
vi.mock('@/components/ReportCampaign', () => ({ ReportCampaign: (props: object) => { m.report(props); return null } }))
vi.mock('@/components/CampaignUpdatesList', () => ({ CampaignUpdatesList: (props: object) => { m.updates(props); return null } }))
vi.mock('@/components/CampaignComments', () => ({ CampaignComments: () => null }))
vi.mock('@/components/Chip', () => ({ Chip: m.el('span') }))
vi.mock('@/components/Loading', () => ({ SkeletonLoader: () => null, Button: m.el('button') }))
vi.mock('@/components/RemoteImage', () => ({ RemoteImage: () => null }))
vi.mock('@/components/anim/FadeInUp', () => ({ FadeInUp: m.el('div') }))
vi.mock('@/components/ProgressBar', () => ({ ProgressBar: () => null }))
vi.mock('@/components/TrustBadge', () => ({ TrustBadge: () => null }))
vi.mock('@/components/ShareCampaign', () => ({ shareCampaign: vi.fn() }))
import CampaignDetailScreen from '../../../app/campaign/[id]'
beforeEach(() => { vi.clearAllMocks(); m.user = null; vi.mocked(api.get).mockResolvedValue([]) })
afterEach(cleanup)

it('does not claim the wallet is the only way to give', () => {
  render(createElement(CampaignDetailScreen))
  expect(screen.queryByText(/Accepted Payment Method/i)).toBeNull()
  expect(screen.queryByText('Ujimora Wallet')).toBeNull()
})

it('formats amounts with two decimals in the campaign currency', () => {
  render(createElement(CampaignDetailScreen))
  expect(screen.getByText('GH₵100.50')).toBeTruthy()
  expect(screen.getByText(/raised of GH₵1,000\.00/)).toBeTruthy()
  expect(screen.getByText(/Still needed: GH₵899\.50/)).toBeTruthy()
  expect(screen.getByText('GH₵20.10')).toBeTruthy()
})

it('gives only the campaign owner the update controls and passes the creator to reporting', () => {
  m.user = { id: 'supporter' }
  const { unmount } = render(createElement(CampaignDetailScreen))
  expect(m.updates).toHaveBeenLastCalledWith(expect.objectContaining({ campaignId: 'c1', isCreator: false }))
  expect(m.report).toHaveBeenLastCalledWith({ campaignId: 'c1', creatorId: 'owner' })
  unmount()
  m.user = { id: 'owner' }
  render(createElement(CampaignDetailScreen))
  expect(m.updates).toHaveBeenLastCalledWith(expect.objectContaining({ isCreator: true }))
})
