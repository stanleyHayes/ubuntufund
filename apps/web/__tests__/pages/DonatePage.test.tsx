import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DonatePage } from '@/pages/DonatePage'
import { createDonationIntent } from '@/lib/fundraising'
import { useAnonymousDonationDefault } from '@/hooks/useAnonymousDonationDefault'

const auth = vi.hoisted(() => ({ user: { id: 'donor', name: 'Ama Mensah' } as { id: string; name: string } | null }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }))
vi.mock('@/hooks/useAnonymousDonationDefault', () => ({ useAnonymousDonationDefault: vi.fn() }))
vi.mock('@/hooks/usePublicCampaign', () => ({
  usePublicCampaign: () => ({
    campaign: { id: 'campaign-1', slug: 'clinic', title: 'Clinic roof', status: 'active', endDate: '2099-01-01', raisedAmount: 100, goalAmount: 1000, currency: 'GHS', imageUrls: [] },
    isLoading: false, error: null, notFound: false,
  }),
}))
vi.mock('@/hooks/useCouponPreview', () => ({ useCouponPreview: () => ({ preview: null, loading: false, error: null, run: () => {}, clear: () => {} }) }))
vi.mock('@/lib/crypto', () => ({ getCryptoAssets: async () => ({ enabled: false, assets: [] }) }))
vi.mock('@/components/campaigns/SplitDisclosure', () => ({ SplitDisclosure: () => null }))
vi.mock('@/lib/fundraising', () => ({
  createDonationIntent: vi.fn(),
  isPaymentsNotConfigured: () => false,
  campaignPublicPath: (slug: string) => `/c/${slug}`,
}))

const checkout = { intent: { id: 'intent-1', status: 'PENDING' }, authorization_url: 'https://checkout.paystack.com/abc', reference: 'uf-intent-1-0a1b2c3d' }

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
  Object.defineProperty(window, 'location', { configurable: true, value: { href: '' } })
  auth.user = { id: 'donor', name: 'Ama Mensah' }
  vi.mocked(useAnonymousDonationDefault).mockReturnValue(undefined)
  vi.mocked(createDonationIntent).mockResolvedValue(checkout as never)
})
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear() })

function show() {
  return render(
    <MemoryRouter initialEntries={['/c/clinic/donate?amount=50']}>
      <Routes>
        <Route path="/c/:slug/donate" element={<DonatePage />} />
        <Route path="/donate/callback" element={<p>Callback page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}
async function give() {
  fireEvent.change(await screen.findByLabelText(/Email address/), { target: { value: 'ama@example.test' } })
  fireEvent.click(screen.getByRole('button', { name: /^Donate GH/ }))
}
const sent = (call = 0) => vi.mocked(createDonationIntent).mock.calls[call][0]

// R2-051: the form always sent isAnonymous=false until GET /profile answered,
// so a donor who is anonymous by default was published by name whenever the
// profile was slow or could not be read.
describe('anonymous-by-default', () => {
  it('leaves the choice to the server while the saved setting is unknown', async () => {
    show()
    expect(await screen.findByText(/Your saved anonymity setting applies/)).toBeInTheDocument()
    await give()
    await waitFor(() => expect(createDonationIntent).toHaveBeenCalledTimes(1))
    // Left out of the JSON body entirely.
    expect(JSON.parse(JSON.stringify(sent()))).not.toHaveProperty('isAnonymous')
  })

  it('applies the saved setting once it has loaded', async () => {
    vi.mocked(useAnonymousDonationDefault).mockReturnValue(true)
    show()
    expect(await screen.findByRole('checkbox', { name: /Give anonymously/ })).toBeChecked()
    expect(screen.queryByText(/Your saved anonymity setting applies/)).not.toBeInTheDocument()
    await give()
    await waitFor(() => expect(sent()).toMatchObject({ isAnonymous: true }))
  })

  it("sends the donor's own choice for this donation over the saved setting", async () => {
    vi.mocked(useAnonymousDonationDefault).mockReturnValue(true)
    show()
    fireEvent.click(await screen.findByRole('checkbox', { name: /Give anonymously/ }))
    await give()
    await waitFor(() => expect(sent()).toMatchObject({ isAnonymous: false }))
  })

  it('sends nothing for a guest, whose donations are public unless they tick the box', async () => {
    auth.user = null
    show()
    await give()
    await waitFor(() => expect(createDonationIntent).toHaveBeenCalledTimes(1))
    expect(sent().isAnonymous).toBeUndefined()
    expect(screen.queryByText(/Your saved anonymity setting applies/)).not.toBeInTheDocument()
  })
})
