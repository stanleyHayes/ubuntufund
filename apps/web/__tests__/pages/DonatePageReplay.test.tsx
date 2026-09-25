import { webcrypto } from 'node:crypto'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DonatePage } from '@/pages/DonatePage'
import { createDonationIntent } from '@/lib/fundraising'

const { campaign } = vi.hoisted(() => ({
  campaign: {
    id: 'campaign-1', slug: 'clinic', title: 'Clinic roof', currency: 'GHS', goalAmount: 5000, raisedAmount: 100,
    imageUrls: [], status: 'active', endDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  },
}))

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(async () => null), post: vi.fn() } }))
vi.mock('@/lib/crypto', () => ({ getCryptoAssets: vi.fn(async () => ({ enabled: false, assets: [] })) }))
vi.mock('@/hooks/usePublicCampaign', () => ({
  usePublicCampaign: () => ({ campaign, isLoading: false, error: null, notFound: false }),
}))
vi.mock('@/lib/fundraising', () => ({
  createDonationIntent: vi.fn(),
  isPaymentsNotConfigured: () => false,
  campaignPublicPath: (slug: string) => `/c/${slug}`,
}))

const storage: Record<string, unknown> = {}
beforeEach(() => {
  for (const key of Object.keys(storage)) delete storage[key]
  Object.defineProperties(storage, {
    getItem: { configurable: true, value: (key: string) => storage[key] ?? null },
    setItem: { configurable: true, value: (key: string, value: string) => { storage[key] = value } },
    removeItem: { configurable: true, value: (key: string) => { delete storage[key] } },
  })
  vi.stubGlobal('sessionStorage', storage)
  vi.stubGlobal('crypto', webcrypto)
  Object.defineProperty(window, 'location', { configurable: true, value: { href: '' } })
})
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals() })

function show() {
  render(
    <MemoryRouter initialEntries={['/donate/clinic']}>
      <Routes>
        <Route path="/donate/:slug" element={<DonatePage />} />
        <Route path="/donate/callback" element={<p>Callback page</p>} />
      </Routes>
    </MemoryRouter>
  )
}
async function give() {
  fireEvent.change(await screen.findByLabelText('Amount', { exact: false }), { target: { value: '50' } })
  fireEvent.change(screen.getByLabelText('Email address', { exact: false }), { target: { value: 'donor@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: /^Donate / }))
}
const idempotencyKeys = () => vi.mocked(createDonationIntent).mock.calls.map(([, key]) => key)

// R2-008: repeating the same gift in one tab replayed the earlier, already-paid
// intent and showed its success screen as if a new donation had gone through.
describe('giving again with the same details after a completed donation', () => {
  it('says the earlier gift is complete instead of showing it as new, and the next press is a new donation', async () => {
    vi.mocked(createDonationIntent)
      .mockResolvedValueOnce({ intent: { id: 'old', amount: 50, status: 'SUCCEEDED', providerRef: 'uf-old-ref' } } as never)
      .mockResolvedValueOnce({ intent: { id: 'new', amount: 50, status: 'PENDING' }, reference: 'uf-new-ref', authorization_url: 'https://checkout.paystack.com/new' } as never)
    show()
    await give()

    expect(await screen.findByText(/You already gave .*50 with these details/)).toBeInTheDocument()
    expect(screen.getByText(/nothing new was charged/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View its confirmation' })).toHaveAttribute('href', '/donate/callback?reference=uf-old-ref')
    expect(screen.queryByText('Callback page')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Donate / }))
    await waitFor(() => expect(window.location.href).toBe('https://checkout.paystack.com/new'))
    const [first, second] = idempotencyKeys()
    expect(second).not.toBe(first)
  })
})
