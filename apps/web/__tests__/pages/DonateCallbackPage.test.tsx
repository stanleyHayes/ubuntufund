import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DonateCallbackPage } from '@/pages/DonateCallbackPage'
import { getDonationIntentStatus, verifyDonationIntent } from '@/lib/fundraising'

vi.mock('@/lib/fundraising', () => ({
  getDonationIntentStatus: vi.fn(), verifyDonationIntent: vi.fn(),
  campaignPublicPath: (slug: string) => `/c/${slug}`,
  donatePath: (slug: string) => `/donate/${slug}`,
}))

const id = '6aa272f4e7e8bad11bb22be2'
const reference = `uf-${id}-fe8b8617`
const confirmed = {id,campaignId:'campaign',amount:200,tip:50,currency:'GHS',status:'SUCCEEDED',provider:'paystack'}
const show = (query = `reference=${reference}`) => render(
  <MemoryRouter initialEntries={[`/donate/callback?${query}`]}><DonateCallbackPage /></MemoryRouter>
)

beforeEach(() => {
  vi.resetAllMocks()
  const stored = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key,value),
    clear: () => stored.clear(),
  })
  vi.mocked(verifyDonationIntent).mockResolvedValue(confirmed as never)
  vi.mocked(getDonationIntentStatus).mockResolvedValue(confirmed as never)
})

describe('Donation return confirmation', () => {
  it('verifies the hosted payment and shows success without waiting for a webhook', async () => {
    show()
    await waitFor(() => expect(verifyDonationIntent).toHaveBeenCalledWith(id,reference))
    expect(await screen.findByRole('heading', {name:/thank|success/i})).toBeInTheDocument()
    expect(getDonationIntentStatus).not.toHaveBeenCalled()
  })

  it('does not substitute the last checkout for an unmatched return reference', async () => {
    localStorage.setItem('uf_pending_donations', JSON.stringify({__last:{intentId:'wrong-intent',slug:'wrong-campaign'}}))
    show(`trxref=${reference}&intent=wrong-intent`)
    await waitFor(() => expect(verifyDonationIntent).toHaveBeenCalledWith(id,reference))
    expect(screen.queryByRole('link',{name:/wrong-campaign/})).not.toBeInTheDocument()
  })

  it('can still read a settled status if the verification request fails', async () => {
    vi.mocked(verifyDonationIntent).mockRejectedValue(new Error('network error'))
    show()
    await waitFor(() => expect(getDonationIntentStatus).toHaveBeenCalledWith(id))
    expect(await screen.findByRole('heading', {name:/thank|success/i})).toBeInTheDocument()
  })

  it('does not claim success for a pending provider response', async () => {
    vi.mocked(verifyDonationIntent).mockResolvedValue({...confirmed,status:'PENDING'} as never)
    show()
    await waitFor(() => expect(verifyDonationIntent).toHaveBeenCalled())
    expect(screen.queryByRole('heading',{name:/thank|success/i})).not.toBeInTheDocument()
  })
})
