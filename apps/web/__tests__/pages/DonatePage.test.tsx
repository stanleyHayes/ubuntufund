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
const sentKey = (call: number) => vi.mocked(createDonationIntent).mock.calls[call][1]

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

// R2-052: the attempt key was forgotten only on a few replayed outcomes, so a
// donor giving the same amount again in the same tab was sent to the earlier
// gift's thank-you page without paying, and a refunded or still-settling
// replay left them stuck on "could not start the secure checkout".
describe('giving again with the same details', () => {
  const replay = (status: string) => ({ intent: { id: 'intent-0', status, providerRef: 'uf-intent-0-0f0e0d0c' } })

  it('says the identical gift is already complete instead of showing its confirmation, then starts a new one', async () => {
    vi.mocked(createDonationIntent).mockResolvedValueOnce(replay('SUCCEEDED') as never).mockResolvedValueOnce(checkout as never)
    show()
    await give()
    expect(await screen.findByText(/already completed an identical .*donation to this campaign/)).toBeInTheDocument()
    expect(screen.queryByText('Callback page')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View it' })).toHaveAttribute('href', '/donate/callback?reference=uf-intent-0-0f0e0d0c')
    expect(window.location.href).toBe('')
    fireEvent.click(screen.getByRole('button', { name: /^Donate GH/ }))
    await waitFor(() => expect(window.location.href).toBe('https://checkout.paystack.com/abc'))
    expect(sentKey(1)).not.toBe(sentKey(0))
  })

  // Money still held (fully refunded or charged-back replays start a new checkout at once; see DonatePageReplay.test).
  it.each(['PARTIALLY_REFUNDED', 'DISPUTED', 'REFUND_PENDING'])('treats a %s replay as a closed attempt', async (status) => {
    vi.mocked(createDonationIntent).mockResolvedValueOnce(replay(status) as never).mockResolvedValueOnce(checkout as never)
    show()
    await give()
    expect(await screen.findByText(/already been processed. Press Donate again/)).toBeInTheDocument()
    expect(screen.queryByText(/could not start the secure checkout/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Donate GH/ }))
    await waitFor(() => expect(window.location.href).toBe('https://checkout.paystack.com/abc'))
    expect(sentKey(1)).not.toBe(sentKey(0))
  })

  it('keeps the attempt while the earlier payment is still settling, so it cannot be paid twice', async () => {
    vi.mocked(createDonationIntent).mockResolvedValue(replay('PROCESSING') as never)
    show()
    await give()
    expect(await screen.findByText(/still being confirmed by the payment provider/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Donate GH/ }))
    await waitFor(() => expect(createDonationIntent).toHaveBeenCalledTimes(2))
    expect(sentKey(1)).toBe(sentKey(0))
  })

  it('hands the attempt to the return page so it can be closed once the payment is final', async () => {
    show()
    await give()
    await waitFor(() => expect(window.location.href).toBe('https://checkout.paystack.com/abc'))
    const handoff = JSON.parse(sessionStorage.getItem('uf_pending_donations') ?? '{}')
    expect(handoff['uf-intent-1-0a1b2c3d']).toMatchObject({ intentId: 'intent-1', attemptScope: 'donate:campaign-1:donor' })
  })
})
