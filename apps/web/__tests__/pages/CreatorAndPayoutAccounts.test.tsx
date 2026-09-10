import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { CreatorTipPage } from '@/pages/CreatorTipPage'
import { SavedPayoutAccounts } from '@/components/account/SavedPayoutAccounts'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
  ApiError: class extends Error {
    status = 500
  },
}))
afterEach(() => vi.resetAllMocks())
describe('creator and saved accounts', () => {
  it('replaces loading skeletons with retry on failure and recovers', async () => {
    let rejectRequest!: (error: Error) => void
    vi.mocked(api.get).mockImplementation((path) =>
      path === '/payout-accounts'
        ? new Promise((_, reject) => {
            rejectRequest = reject
          })
        : Promise.resolve([]),
    )
    render(
      <MemoryRouter>
        <SavedPayoutAccounts />
      </MemoryRouter>,
    )
    expect(screen.getByRole('status', { name: 'Loading payout accounts' })).toBeInTheDocument()
    rejectRequest(new Error('Request failed'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    vi.mocked(api.get).mockImplementation(async (path) =>
      path === '/payout-accounts' ? { planName: 'Plus', limit: 2, accounts: [] } : [],
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Plus plan')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('uses creator imagery and exposes an explicit custom amount control', async () => {
    vi.mocked(api.get).mockResolvedValue({
      displayName: 'Stanley',
      handle: 'pontifex',
      avatarUrl: 'https://example.com/avatar.png',
      coverUrl: 'https://example.com/cover.jpg',
      tipsEnabled: true,
      presetAmounts: [10, 25],
      currency: 'GHS',
      supporterCount: 0,
      totalReceived: 0,
      recentTips: [],
    })
    render(
      <MemoryRouter initialEntries={['/creators/pontifex']}>
        <Routes>
          <Route path="/creators/:handle" element={<CreatorTipPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByAltText("Stanley's cover")).toHaveAttribute(
      'src',
      'https://example.com/cover.jpg',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
    expect(screen.getByLabelText('Your amount (GHS)')).toHaveFocus()
    fireEvent.change(screen.getByLabelText('Your amount (GHS)'), { target: { value: '37.5' } })
    expect(screen.getByRole('button', { name: 'Support GH₵37.5' })).toBeInTheDocument()
  })
  it('shows the account allowance and offers an upgrade at the limit', async () => {
    vi.mocked(api.get).mockImplementation(async (path) =>
      path === '/payout-accounts'
        ? {
            planName: 'Community',
            limit: 1,
            accounts: [
              {
                id: 'a',
                accountName: 'Jane Doe',
                bankCode: 'MTN',
                last4: '4567',
                type: 'mobile_money',
                verificationStatus: 'name_matched',
              },
            ],
          }
        : [],
    )
    render(<SavedPayoutAccounts />)
    expect(await screen.findByText('Community plan')).toBeInTheDocument()
    expect(screen.getByText('1 of 1 saved')).toBeInTheDocument()
    expect(screen.getByText('All account slots used')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Verify & save account' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View plans' })).toHaveAttribute(
      'href',
      '/subscription',
    )
  })
  it('removes only the selected saved account and explains existing payout behavior', async () => {
    vi.mocked(api.get).mockImplementation(async (path) =>
      path === '/payout-accounts'
        ? {
            planName: 'Pro',
            limit: 3,
            accounts: [
              {
                id: 'a',
                accountName: 'Jane Doe',
                bankCode: 'MTN',
                last4: '4567',
                type: 'mobile_money',
                verificationStatus: 'name_matched',
              },
            ],
          }
        : [],
    )
    vi.mocked(api.delete).mockResolvedValue({ planName: 'Pro', limit: 3, accounts: [] })
    render(<SavedPayoutAccounts />)
    fireEvent.click(await screen.findByRole('button', { name: /Remove saved account/ }))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/payout-accounts/a'))
    expect(await screen.findByText(/Removed from saved accounts/)).toBeInTheDocument()
  })
})
