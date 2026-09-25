import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CryptoDonatePanel } from '@/components/donate/CryptoDonatePanel'
import { createCryptoDeposit, createCryptoQuote, getCryptoAssets } from '@/lib/crypto'

vi.mock('@/lib/crypto', () => ({ getCryptoAssets: vi.fn(), createCryptoQuote: vi.fn(), createCryptoDeposit: vi.fn() }))
vi.mock('@/lib/fundraising', () => ({ getDonationIntentStatus: vi.fn(async () => ({ status: 'PENDING' })) }))
vi.mock('@/components/donate/DonationReviewStatus', () => ({ DonationReviewStatus: () => null }))

const quote = (quoteId: string) => ({
  quoteId, asset: 'USDT', network: 'TRON', fiatCurrency: 'GHS', fiatAmount: 100, cryptoAmount: 9.25, rate: 10.8,
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getCryptoAssets).mockResolvedValue({ enabled: true, assets: [{ asset: 'USDT', label: 'Tether', networks: [{ id: 'TRON', label: 'Tron' }] }] } as never)
})

// I120: every retry used to open a new intent and a new deposit address.
it('retries the same quote with the same Idempotency-Key and a new quote with a new one', async () => {
  vi.mocked(createCryptoQuote).mockResolvedValueOnce(quote('q1') as never).mockResolvedValueOnce(quote('q2') as never)
  vi.mocked(createCryptoDeposit).mockRejectedValue(new Error('Network error'))
  render(<MemoryRouter><CryptoDonatePanel campaignId="c1" amount={100} amountValid donorEmail="d@example.test" emailValid isAnonymous campaignPath="/c/x" /></MemoryRouter>)

  fireEvent.click(await screen.findByRole('button', { name: /USDT/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Tron' }))
  fireEvent.click(screen.getByRole('button', { name: 'Review quote' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Get payment address' }))
  await screen.findByText('Network error')
  fireEvent.click(screen.getByRole('button', { name: 'Get payment address' }))
  await waitFor(() => expect(createCryptoDeposit).toHaveBeenCalledTimes(2))
  const [first, second] = vi.mocked(createCryptoDeposit).mock.calls
  expect(second[2]).toBe(first[2])
  expect(first[2]).toMatch(/^[0-9a-f-]{36}$/)

  fireEvent.click(screen.getByRole('button', { name: 'Change currency or network' }))
  fireEvent.click(await screen.findByRole('button', { name: /USDT/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Tron' }))
  fireEvent.click(screen.getByRole('button', { name: 'Review quote' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Get payment address' }))
  await waitFor(() => expect(createCryptoDeposit).toHaveBeenCalledTimes(3))
  expect(vi.mocked(createCryptoDeposit).mock.calls[2][2]).not.toBe(first[2])
  expect(screen.getByText('Counts toward the campaign')).toBeInTheDocument()
})
