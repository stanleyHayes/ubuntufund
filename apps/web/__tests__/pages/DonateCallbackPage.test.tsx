import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DonateCallbackPage } from '@/pages/DonateCallbackPage'
import { getDonationIntentStatus, verifyDonationIntent } from '@/lib/fundraising'
import { checkoutAttemptKey } from '@/lib/checkoutAttempt'

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
    removeItem: (key: string) => stored.delete(key),
    clear: () => stored.clear(),
  })
  const session = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => session.set(key,value),
    removeItem: (key: string) => session.delete(key),
    clear: () => session.clear(),
  })
  vi.mocked(verifyDonationIntent).mockResolvedValue(confirmed as never)
  vi.mocked(getDonationIntentStatus).mockResolvedValue(confirmed as never)
})

// I129: a bare /donate/callback used to show the previous donor's gift on a
// shared device, from a never-pruned localStorage `__last` entry.
describe('Donation handoff privacy', () => {
  it('never falls back to the last checkout when no reference is present', async () => {
    const last = {intentId:id,slug:'previous-donor-campaign',title:'Previous gift',amount:999,currency:'GHS'}
    localStorage.setItem('uf_pending_donations', JSON.stringify({__last:last}))
    sessionStorage.setItem('uf_pending_donations', JSON.stringify({__last:last}))
    show('')
    expect(await screen.findByText(/couldn't find a payment reference/)).toBeInTheDocument()
    expect(screen.getByText(/don't pay again/)).toBeInTheDocument()
    expect(screen.queryByText(/receipt is emailed/)).not.toBeInTheDocument()
    expect(verifyDonationIntent).not.toHaveBeenCalled()
    expect(getDonationIntentStatus).not.toHaveBeenCalled()
    // The legacy store is cleaned up.
    await waitFor(() => expect(localStorage.getItem('uf_pending_donations')).toBeNull())
  })

  it('removes this gift from the handoff store once its payment is final', async () => {
    sessionStorage.setItem('uf_pending_donations', JSON.stringify({[reference]:{intentId:id,reference,slug:'clinic',title:'Clinic',amount:200,currency:'GHS'}}))
    show()
    expect(await screen.findByRole('heading', {name:/thank|success/i})).toBeInTheDocument()
    await waitFor(() => expect(sessionStorage.getItem('uf_pending_donations')).toBeNull())
  })
})

// R2-008: the attempt key outlived the paid gift, so giving the same amount
// again in this tab replayed the earlier donation.
it('forgets the checkout attempt once the gift is final, so the same details start a new donation', async () => {
  const scope = 'donate:campaign:guest'
  const input = { amount: 200, donorEmail: 'donor@example.com' }
  const first = await checkoutAttemptKey(scope, input)
  expect(await checkoutAttemptKey(scope, input)).toBe(first)
  sessionStorage.setItem('uf_pending_donations', JSON.stringify({[reference]:{intentId:id,reference,slug:'clinic',title:'Clinic',amount:200,currency:'GHS',attemptScope:scope}}))
  show()
  expect(await screen.findByRole('heading', {name:/thank|success/i})).toBeInTheDocument()
  await waitFor(async () => expect(await checkoutAttemptKey(scope, input)).not.toBe(first))
})

describe('Donation return confirmation', () => {
  it('verifies the hosted payment and shows success without waiting for a webhook', async () => {
    show()
    await waitFor(() => expect(verifyDonationIntent).toHaveBeenCalledWith(id,reference))
    expect(await screen.findByRole('heading', {name:/thank|success/i})).toBeInTheDocument()
    expect(getDonationIntentStatus).not.toHaveBeenCalled()
    expect(screen.getByTestId('donation-particles')).toHaveAttribute('aria-hidden', 'true')
    fireEvent.click(screen.getByRole('button', {name:'Celebrate again'}))
    expect(verifyDonationIntent).toHaveBeenCalledTimes(1)
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
    expect(screen.queryByTestId('donation-particles')).not.toBeInTheDocument()
  })
})

it.each([
  ['pending', 'awaiting review'],
  ['approved', 'has been approved'],
  ['rejected', 'was not approved'],
  ['unavailable', 'currently unavailable'],
])('keeps payment confirmed while showing %s content review', async (contentReviewStatus, text) => {
  vi.mocked(verifyDonationIntent).mockResolvedValue({ ...confirmed, contentReviewStatus } as never);
  show();
  expect(await screen.findByText(new RegExp(text))).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /donation is confirmed/ })).toBeInTheDocument();
});

it('refreshes a later decision without re-verifying payment and preserves success on review errors', async () => {
  vi.mocked(verifyDonationIntent).mockResolvedValue({ ...confirmed, contentReviewStatus: 'pending' } as never)
  show()
  expect(await screen.findByText(/awaiting review/)).toBeInTheDocument()
  vi.mocked(getDonationIntentStatus).mockResolvedValueOnce({ ...confirmed, contentReviewStatus: 'approved' } as never)
  fireEvent.click(screen.getByRole('button', { name: 'Refresh content review' }))
  expect(await screen.findByText(/has been approved/)).toBeInTheDocument()
  vi.mocked(getDonationIntentStatus).mockRejectedValueOnce(new Error('offline'))
  fireEvent.click(screen.getByRole('button', { name: 'Refresh content review' }))
  expect(await screen.findByText(/Could not refresh the content review/)).toBeInTheDocument()
  expect(screen.queryByText(/has been approved/)).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /donation is confirmed/ })).toBeInTheDocument()
  expect(verifyDonationIntent).toHaveBeenCalledTimes(1)
  vi.mocked(getDonationIntentStatus).mockResolvedValueOnce({ ...confirmed, contentReviewStatus: 'rejected' } as never)
  fireEvent.click(screen.getByRole('button', { name: 'Refresh content review' }))
  expect(await screen.findByText(/was not approved/)).toBeInTheDocument()
})
