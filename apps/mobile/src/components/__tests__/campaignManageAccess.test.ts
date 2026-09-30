import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CampaignViewerAccess } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

const m = vi.hoisted(() => ({
  el: (tag: string) => ({ children }: { children?: React.ReactNode }) => createElement(tag, {}, children),
  user: { id: 'org' } as { id: string } | null,
  push: vi.fn(), cashout: vi.fn(), status: vi.fn(), owner: vi.fn(),
}))
vi.mock('react-native', () => ({ View: m.el('div'), ScrollView: m.el('div') }))
vi.mock('react-native-paper', () => ({ Text: 'span', Icon: () => null }))
vi.mock('expo-router', () => ({ Stack: { Screen: () => null }, router: { push: m.push }, useLocalSearchParams: () => ({ id: 'c1' }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: m.user }) }))
vi.mock('@/context/ColorModeContext', () => ({ usePalette: () => ({}), useNeu: () => ({}) }))
vi.mock('@/components/SignInRequired', () => ({ SignInRequired: () => createElement('p', {}, 'Sign in') }))
vi.mock('@/components/KeyboardAvoider', () => ({ KeyboardAvoider: m.el('div') }))
vi.mock('@/components/GlassSurface', () => ({ GlassSurface: m.el('div') }))
vi.mock('@/components/Loading', () => ({
  PageSkeleton: () => createElement('p', {}, 'Loading'),
  Button: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => createElement('button', { onClick: onPress }, children),
}))
vi.mock('@/components/CampaignCashout', () => ({ CampaignCashout: (props: object) => { m.cashout(props); return createElement('p', {}, 'Cashout form') } }))
vi.mock('@/components/OnBehalfStatus', () => ({ OnBehalfStatus: (props: object) => { m.status(props); return createElement('p', {}, 'Beneficiary status') } }))
vi.mock('@/components/CampaignManagement', () => ({
  CollaboratorManager: () => { m.owner('collaborators'); return null },
  SplitManager: () => { m.owner('split'); return null },
  QrManager: () => { m.owner('qr'); return null },
}))
import CampaignManagement from '../../../app/campaign/manage'

const access = (fields: Partial<CampaignViewerAccess>): CampaignViewerAccess => ({ manage: false, beneficiary: false, payoutAuthority: false, thankDonors: false, ...fields })
const onBehalf = { beneficiaryName: 'Kofi Boateng', beneficiaryType: 'individual', beneficiaryConfirmed: true }
function open(campaign: object) {
  vi.mocked(api.get).mockResolvedValue({ creatorId: 'org', title: 'Kofi’s surgery', ...campaign })
  render(createElement(CampaignManagement))
  return screen.findByText('Kofi’s surgery')
}

beforeEach(() => { vi.clearAllMocks(); m.user = { id: 'org' } })
afterEach(cleanup)

describe('campaign management follows payout authority, not ownership', () => {
  it('gives the organizer of a campaign run for someone else a payout note instead of cashout', async () => {
    await open({ onBehalf, viewerAccess: access({ manage: true, thankDonors: true }) })
    expect(screen.queryByText('Cashout form')).toBeNull()
    expect(m.status).toHaveBeenLastCalledWith({ campaignId: 'c1', summary: onBehalf, payoutAuthority: false })
    // Collaborators, split and QR codes stay with the owner account.
    expect(new Set(m.owner.mock.calls.map(([name]) => name))).toEqual(new Set(['collaborators', 'split', 'qr']))
  })

  it('gives the consenting beneficiary cashout that names who the funds were raised for', async () => {
    m.user = { id: 'kofi' }
    await open({ onBehalf, viewerAccess: access({ beneficiary: true, payoutAuthority: true, thankDonors: true }) })
    expect(m.cashout).toHaveBeenLastCalledWith({ campaignId: 'c1', beneficiaryName: 'Kofi Boateng' })
    expect(m.owner).not.toHaveBeenCalled()
  })

  it('keeps the old creator check when the API sends no viewer access', async () => {
    await open({})
    expect(m.cashout).toHaveBeenLastCalledWith({ campaignId: 'c1', beneficiaryName: undefined })
    expect(screen.queryByText('Thank your donors', { selector: 'button' })).toBeNull()
  })

  it('tells a co-manager of a self-created campaign who can request payouts', async () => {
    m.user = { id: 'editor' }
    await open({ viewerAccess: access({ manage: true, thankDonors: true }) })
    expect(screen.getByText('Only the campaign owner’s account can request payouts.')).toBeTruthy()
    expect(m.cashout).not.toHaveBeenCalled()
    expect(m.owner).not.toHaveBeenCalled()
  })

  it('opens the thank-you composer for the campaign', async () => {
    await open({ viewerAccess: access({ manage: true, payoutAuthority: true, thankDonors: true }) })
    fireEvent.click(screen.getByText('Thank your donors', { selector: 'button' }))
    expect(m.push).toHaveBeenCalledWith({ pathname: '/campaign/thank-you', params: { id: 'c1' } })
  })

  it('turns away a signed-in viewer with no role on the campaign', async () => {
    m.user = { id: 'donor' }
    vi.mocked(api.get).mockResolvedValue({ creatorId: 'org', title: 'Kofi’s surgery', viewerAccess: access({}) })
    render(createElement(CampaignManagement))
    await waitFor(() => expect(screen.getByText('Only the campaign owner can manage these settings.')).toBeTruthy())
    expect(m.cashout).not.toHaveBeenCalled()
  })
})
