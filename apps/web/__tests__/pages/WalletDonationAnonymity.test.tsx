import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { ujimoraTheme } from '@ubuntu-fund/ui'
import { CampaignCategory, CampaignPriority, CampaignStatus } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { useAnonymousDonationDefault } from '@/hooks/useAnonymousDonationDefault'

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'donor', name: 'Ama Mensah' } }) }))
vi.mock('@/hooks/useAnonymousDonationDefault', () => ({ useAnonymousDonationDefault: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() }, ApiError: class ApiError extends Error { constructor(public status: number, message: string) { super(message) } } }))
vi.mock('@/hooks/useCampaigns', () => ({
  useCampaign: () => ({
    campaign: {
      id: 'campaign-1', slug: 'clinic', title: 'Clinic roof repair', description: 'Fix the clinic roof.', goalAmount: 1000, raisedAmount: 100,
      currency: 'GHS', category: CampaignCategory.MEDICAL, priority: CampaignPriority.NORMAL, status: CampaignStatus.ACTIVE, creatorId: 'creator',
      beneficiaries: [], imageUrls: [], startDate: new Date(), endDate: new Date(Date.now() + 86_400_000), createdAt: new Date(), updatedAt: new Date(), donorCount: 0,
    },
    isLoading: false, error: null, refresh: () => {},
  }),
}))
vi.mock('@/hooks/useEnabledPaymentProviders', () => ({
  useEnabledPaymentProviders: () => ({ providers: [{ id: 'wallet', name: 'Ujimora Wallet', slug: 'wallet', type: 'wallet' }], isLoading: false, error: null }),
}))
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: null, isLoading: false }) }))
vi.mock('@/hooks/useCampaignUpdates', () => ({ useCreateCampaignUpdate: () => ({ create: vi.fn(), isLoading: false }) }))
for (const [path, name] of [
  ['@/components/campaigns/CampaignOrganizer', 'CampaignOrganizer'], ['@/components/campaigns/CampaignCashout', 'CampaignCashout'],
  ['@/components/campaigns/ReportCampaignDialog', 'ReportCampaignDialog'], ['@/components/campaigns/CollaboratorSection', 'CollaboratorSection'],
  ['@/components/campaigns/CampaignSplitSetup', 'CampaignSplitSetup'], ['@/components/campaigns/ShareCampaignButton', 'ShareCampaignButton'],
  ['@/components/campaigns/CampaignQRCode', 'CampaignQRCode'], ['@/components/campaigns/CampaignUpdates', 'CampaignUpdates'],
  ['@/components/campaigns/CampaignComments', 'CampaignComments'], ['@/components/campaigns/CreateUpdateDialog', 'CreateUpdateDialog'],
  ['@/components/campaigns/LiveCampaignProgress', 'LiveCampaignProgress'], ['@/components/campaigns/CampaignDonationHistory', 'CampaignDonationHistory'],
  ['@/components/campaigns/SplitDisclosure', 'SplitDisclosure'],
]) vi.doMock(path, () => ({ [name]: () => null }))

const { CampaignDetailPage } = await import('@/pages/CampaignDetailPage')

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
  vi.mocked(useAnonymousDonationDefault).mockReturnValue(undefined)
  vi.mocked(api.get).mockResolvedValue(null)
  vi.mocked(api.post).mockResolvedValue(null)
})
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear() })

function page() {
  return (
    <ThemeProvider theme={ujimoraTheme}>
      <MemoryRouter initialEntries={['/campaigns/campaign-1']}>
        <Routes><Route path="/campaigns/:id" element={<CampaignDetailPage />} /></Routes>
      </MemoryRouter>
    </ThemeProvider>
  )
}
async function openAndFill() {
  fireEvent.click(await screen.findByRole('button', { name: /Donate with wallet/ }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText(/Amount/), { target: { value: '20' } })
  fireEvent.click(within(dialog).getByRole('button', { name: /Wallet/ }))
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /agree to the Terms of Use/ }))
  return dialog
}
const body = () => vi.mocked(api.post).mock.calls.find(([path]) => path === '/campaigns/campaign-1/donate')?.[1] as Record<string, unknown>

// R2-051: the dialog copied the saved default once, when it opened. Opened
// before GET /profile answered, it stayed unticked and sent isAnonymous=false,
// publishing the name of a donor who is anonymous by default.
it('applies the saved default when the profile loads after the dialog opened', async () => {
  const view = render(page())
  const dialog = await openAndFill()
  expect(within(dialog).getByRole('checkbox', { name: 'Donate anonymously' })).not.toBeChecked()
  vi.mocked(useAnonymousDonationDefault).mockReturnValue(true)
  view.rerender(page())
  expect(within(dialog).getByRole('checkbox', { name: 'Donate anonymously' })).toBeChecked()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Donation' }))
  await waitFor(() => expect(body()).toMatchObject({ isAnonymous: true }))
  expect(body().donorName).toBeUndefined()
})

it('omits the choice while the saved default is unknown, so the server applies it', async () => {
  render(page())
  const dialog = await openAndFill()
  expect(within(dialog).getByText(/Your saved anonymity setting applies/)).toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Donation' }))
  await waitFor(() => expect(body()).toBeDefined())
  // Left out of the JSON body entirely.
  expect(JSON.parse(JSON.stringify(body()))).not.toHaveProperty('isAnonymous')
})

it("sends the donor's explicit choice", async () => {
  vi.mocked(useAnonymousDonationDefault).mockReturnValue(true)
  render(page())
  const dialog = await openAndFill()
  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Donate anonymously' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Donation' }))
  await waitFor(() => expect(body()).toMatchObject({ isAnonymous: false, donorName: 'Ama Mensah' }))
})
