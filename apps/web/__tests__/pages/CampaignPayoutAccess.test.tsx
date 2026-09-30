import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { CampaignCategory, CampaignPriority, CampaignStatus, type Campaign, type CampaignBeneficiaryDetails } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

const viewer = vi.hoisted(() => ({ user: null as { id: string; name: string; email?: string; role?: string } | null }))
const page = vi.hoisted(() => ({ campaign: null as unknown, details: null as unknown }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: viewer.user }) }))
vi.mock('@/hooks/useAnonymousDonationDefault', () => ({ useAnonymousDonationDefault: () => undefined }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() }, ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message) } } }))
vi.mock('@/hooks/useCampaigns', () => ({ useCampaign: () => ({ campaign: page.campaign, isLoading: false, error: null, refresh: () => {} }) }))
vi.mock('@/hooks/useEnabledPaymentProviders', () => ({ useEnabledPaymentProviders: () => ({ providers: [], isLoading: false, error: null }) }))
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: { id: 'org-1', name: 'Hope Foundation', verificationLevel: 2, trustScore: 60, createdAt: '2025-01-01' }, isLoading: false }) }))
vi.mock('@/hooks/useCampaignUpdates', () => ({ useCreateCampaignUpdate: () => ({ create: vi.fn(), isLoading: false }) }))
vi.mock('@/hooks/useCampaignBeneficiary', () => ({
  useCampaignBeneficiary: (_id: string, enabled: boolean) => ({ details: enabled ? page.details : null, error: null, loading: false, refresh: vi.fn() }),
}))
for (const [path, name] of [
  ['@/components/campaigns/ReportCampaignDialog', 'ReportCampaignDialog'], ['@/components/campaigns/CollaboratorSection', 'CollaboratorSection'],
  ['@/components/campaigns/ShareCampaignButton', 'ShareCampaignButton'], ['@/components/campaigns/CampaignQRCode', 'CampaignQRCode'],
  ['@/components/campaigns/CampaignUpdates', 'CampaignUpdates'], ['@/components/campaigns/CampaignComments', 'CampaignComments'],
  ['@/components/campaigns/CreateUpdateDialog', 'CreateUpdateDialog'], ['@/components/campaigns/LiveCampaignProgress', 'LiveCampaignProgress'],
  ['@/components/campaigns/CampaignDonationHistory', 'CampaignDonationHistory'], ['@/components/campaigns/SplitDisclosure', 'SplitDisclosure'],
]) vi.doMock(path, () => ({ [name]: () => null }))
vi.doMock('@/components/campaigns/CampaignCashout', () => ({
  CampaignCashout: ({ beneficiaryName }: { beneficiaryName?: string }) => <section aria-label="Cashout">{beneficiaryName ? `Cashout for ${beneficiaryName}` : 'Cashout'}</section>,
}))
vi.doMock('@/components/campaigns/CampaignSplitSetup', () => ({ CampaignSplitSetup: () => <section aria-label="Split setup" /> }))
vi.doMock('@/components/campaigns/CampaignBeneficiaryPanel', () => ({ CampaignBeneficiaryPanel: () => <section aria-label="Beneficiary panel" /> }))

const { CampaignDetailPage } = await import('@/pages/CampaignDetailPage')
const { CampaignCashout } = await vi.importActual<typeof import('@/components/campaigns/CampaignCashout')>('@/components/campaigns/CampaignCashout')

function campaign(over: Partial<Campaign> = {}): Campaign {
  return {
    id: 'campaign-1', slug: 'surgery-for-ama', title: 'Surgery for Ama', description: 'Ama needs a hip operation.', goalAmount: 12000, raisedAmount: 800,
    currency: 'GHS', category: CampaignCategory.MEDICAL, priority: CampaignPriority.NORMAL, status: CampaignStatus.ACTIVE, creatorId: 'org-1',
    beneficiaries: ['Ama Mensah'], imageUrls: [], startDate: new Date('2026-09-01'), endDate: new Date(Date.now() + 86_400_000),
    createdAt: new Date('2026-09-01'), updatedAt: new Date('2026-09-01'), donorCount: 4,
    creationMode: 'on_behalf', onBehalf: { beneficiaryName: 'Ama Mensah', beneficiaryType: 'individual', beneficiaryConfirmed: false }, ...over,
  }
}
const access = (over: Partial<NonNullable<Campaign['viewerAccess']>> = {}) => ({ manage: false, beneficiary: false, payoutAuthority: false, thankDonors: false, ...over })
const renderPage = () => render(
  <ThemeProvider theme={ujimoraTheme}>
    <MemoryRouter initialEntries={['/campaigns/campaign-1']}>
      <Routes><Route path="/campaigns/:id" element={<CampaignDetailPage />} /></Routes>
    </MemoryRouter>
  </ThemeProvider>,
)

beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue(null)
  page.details = null
})
afterEach(() => { vi.resetAllMocks(); viewer.user = null })

it('shows payout controls to the payout authority (the beneficiary), naming who the money is for', async () => {
  viewer.user = { id: 'ama', name: 'Ama Mensah' }
  page.campaign = campaign({
    onBehalf: { beneficiaryName: 'Ama Mensah', beneficiaryType: 'individual', beneficiaryConfirmed: true },
    viewerAccess: access({ beneficiary: true, payoutAuthority: true, thankDonors: true }),
  })
  renderPage()
  expect(await screen.findByRole('region', { name: 'Cashout' })).toHaveTextContent('Cashout for Ama Mensah')
  // Split proceeds are not available on a campaign run for someone else.
  expect(screen.queryByRole('region', { name: 'Split setup' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Beneficiary panel' })).toBeInTheDocument()
  expect(screen.getByText('Confirmed by beneficiary')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Thank your donors' })).toHaveAttribute('href', '/campaigns/campaign-1/thank-you')
})

it('gives the organizer a read-only payout note instead of the cashout form', async () => {
  viewer.user = { id: 'org-1', name: 'Hope Foundation', role: 'organization' }
  page.campaign = campaign({ viewerAccess: access({ manage: true, thankDonors: true }) })
  const view = renderPage()
  expect(await screen.findByText('Payouts go to Ama Mensah after they accept.')).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Cashout' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Beneficiary panel' })).toBeInTheDocument()
  const organizer = screen.getByRole('region', { name: 'Behind the campaign' })
  expect(organizer).toHaveTextContent('Organized by Hope Foundation on behalf of Ama Mensah')
  expect(within(organizer).getByText('Awaiting confirmation')).toBeInTheDocument()
  view.unmount()

  page.details = { consentStatus: 'revoked', payoutAuthority: 'none', payoutArrangement: 'beneficiary' } as Partial<CampaignBeneficiaryDetails>
  renderPage()
  expect(await screen.findByText('Payouts are paused because Ama Mensah has not agreed to this campaign.')).toBeInTheDocument()
})

it('falls back to the creator check when the API sends no viewerAccess', async () => {
  page.campaign = campaign({ creationMode: 'self', onBehalf: undefined, viewerAccess: undefined })
  viewer.user = { id: 'org-1', name: 'Hope Foundation' }
  const view = renderPage()
  expect(await screen.findByRole('region', { name: 'Cashout' })).toHaveTextContent(/^Cashout$/)
  expect(screen.getByRole('region', { name: 'Split setup' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Beneficiary panel' })).not.toBeInTheDocument()
  view.unmount()

  viewer.user = { id: 'someone-else', name: 'Kwame' }
  renderPage()
  await screen.findByRole('heading', { level: 1, name: 'Surgery for Ama' })
  expect(screen.queryByRole('region', { name: 'Cashout' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Thank your donors' })).not.toBeInTheDocument()
})

it('hides payout controls from a manager of a self-run campaign who is not the payout authority', async () => {
  viewer.user = { id: 'org-editor', name: 'Efua' }
  page.campaign = campaign({ creationMode: 'self', onBehalf: undefined, viewerAccess: access({ manage: true, thankDonors: true }) })
  renderPage()
  await screen.findByRole('heading', { level: 1, name: 'Surgery for Ama' })
  expect(screen.queryByRole('region', { name: 'Cashout' })).not.toBeInTheDocument()
  expect(screen.queryByText(/Payouts go to/)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Thank your donors' })).toBeInTheDocument()
})

it('names the beneficiary beside the destination account and again in the payout confirmation', async () => {
  vi.mocked(api.get).mockImplementation(async (path: string) =>
    path === '/payout-accounts' ? { accounts: [] }
      : path.endsWith('/payout-options') ? { eligible: 1000, currency: 'GHS', fees: {}, recipient: { accountName: 'Ama M', last4: '4567', type: 'mobile_money' } }
        : path === '/email-verification' ? { emailVerified: true, deliveryConfigured: true }
          : [])
  render(<CampaignCashout campaignId="campaign-1" beneficiaryName="Ama Mensah" initiallyExpanded />)
  expect(await screen.findByText('GHS 1,000.00 eligible balance')).toBeInTheDocument()
  // The account details read exactly as before.
  expect(screen.getByText(/Payout account: Ama M · ending/)).toHaveTextContent('Payout account: Ama M · ending 4567')
  expect(screen.getByText(/Funds raised for/)).toHaveTextContent('Funds raised for Ama Mensah')
  fireEvent.change(screen.getByLabelText('Cashout amount (GHS)'), { target: { value: '100' } })
  expect(screen.getAllByText(/Funds raised for/)).toHaveLength(2)
  const quote = screen.getByText('You receive').closest('.MuiBox-root')!.parentElement!
  expect(within(quote).getByText('Funds raised for')).toBeInTheDocument()
  expect(within(quote).getByText('Ama Mensah')).toBeInTheDocument()
  expect(within(quote).getByText('Paid to')).toBeInTheDocument()
  expect(within(quote).getByText('Ama M · ending 4567')).toBeInTheDocument()
})

it('adds nothing to the cashout of a campaign run for oneself', async () => {
  vi.mocked(api.get).mockImplementation(async (path: string) =>
    path === '/payout-accounts' ? { accounts: [] }
      : path.endsWith('/payout-options') ? { eligible: 1000, currency: 'GHS', fees: {}, recipient: { accountName: 'Owner', last4: '4567', type: 'mobile_money' } }
        : [])
  render(<CampaignCashout campaignId="campaign-1" initiallyExpanded />)
  expect(await screen.findByText('GHS 1,000.00 eligible balance')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Cashout amount (GHS)'), { target: { value: '100' } })
  expect(screen.queryByText(/Funds raised for/)).not.toBeInTheDocument()
  expect(screen.queryByText('Paid to')).not.toBeInTheDocument()
})
