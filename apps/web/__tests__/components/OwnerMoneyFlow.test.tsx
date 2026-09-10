import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CampaignCashout } from '@/components/campaigns/CampaignCashout'
import { OwnerNotifications } from '@/components/account/OwnerNotifications'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
afterEach(() => vi.resetAllMocks())
const opts = {
  eligible: 1000,
  currency: 'GHS',
  recipient: { accountName: 'Owner', last4: '4567', type: 'mobile_money' },
  fees: { earlyMaxWithdrawalPercent: 80, earlyFeePercent: 1, earlyMinFee: 20 },
}
describe('owner money flow', () => {
  it('shows a skeleton while payout details load and uses the illustrated empty history', async () => {
    let resolve!: (value: unknown) => void
    vi.mocked(api.get).mockImplementation((path) =>
      path === '/payout-accounts'
        ? Promise.resolve({ accounts: [] })
        : path.endsWith('payout-options')
          ? new Promise((r) => {
              resolve = r
            })
          : Promise.resolve([]),
    )
    render(<CampaignCashout campaignId="campaign" initiallyExpanded />)
    expect(screen.getByRole('status', { name: 'Loading payout details' })).toBeInTheDocument()
    await act(async () => resolve(opts))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByText('No payout requests yet')).toBeInTheDocument()
  })
  it('requests a wallet transfer without bank details and retains the key after a network error', async () => {
    vi.mocked(api.get).mockImplementation(async (path) =>
      path === '/payout-accounts'
        ? { accounts: [] }
        : path.endsWith('payout-options')
          ? { ...opts, recipient: null }
          : [],
    )
    vi.mocked(api.post).mockRejectedValue(new Error('Connection lost'))
    render(<CampaignCashout campaignId="campaign" initiallyExpanded />)
    await screen.findByText('GHS 1,000.00 eligible balance')
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Receive funds in' }))
    fireEvent.click(screen.getByRole('option', { name: 'Ujimora Wallet' }))
    expect(screen.queryByLabelText('Account holder name')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Cashout amount (GHS)'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Request cashout' }))
    await screen.findByText('Connection lost')
    fireEvent.click(screen.getByRole('button', { name: 'Request cashout' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2))
    const first = vi.mocked(api.post).mock.calls[0][1]
    expect(first).toMatchObject({
      amount: 100,
      destination: 'ujimora_wallet',
      idempotencyKey: expect.any(String),
    })
    expect(vi.mocked(api.post).mock.calls[1][1]).toEqual(first)
  })
  it('shows unresolved destination review and capacity guidance during onboarding', async () => {
    vi.mocked(api.get).mockImplementation(async (path) =>
      path === '/payout-accounts' ? { accounts: [] } : path.endsWith('payout-options') ? opts : [],
    )
    render(<CampaignCashout campaignId="campaign" initiallyExpanded />)
    expect(await screen.findByText(/Account verification needs admin review/)).toBeInTheDocument()
    expect(
      screen.getByText(/We cannot read your balance or remaining allowance/),
    ).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })
  it('distinguishes a name match from ownership approval', async () => {
    vi.mocked(api.get).mockImplementation(async (path) =>
      path === '/payout-accounts'
        ? { accounts: [] }
        : path.endsWith('payout-options')
          ? {
              ...opts,
              recipient: {
                ...opts.recipient,
                verificationStatus: 'name_matched',
                resolvedAccountName: 'Owner',
              },
            }
          : [],
    )
    render(<CampaignCashout campaignId="campaign" initiallyExpanded />)
    expect(
      await screen.findByText(/Ownership and receiving capacity still require review/),
    ).toBeInTheDocument()
  })
  it('loads cashout details only when opened and submits an explicit request', async () => {
    vi.mocked(api.get).mockImplementation(async (path) =>
      path === '/payout-accounts' ? { accounts: [] } : path.endsWith('payout-options') ? opts : [],
    )
    vi.mocked(api.post).mockResolvedValue({ fee: 0, netAmount: 100 })
    render(<CampaignCashout campaignId="campaign" />)
    expect(api.get).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Cashout & payout history'))
    await screen.findByText('GHS 1,000.00 eligible balance')
    fireEvent.change(screen.getByLabelText('Cashout amount (GHS)'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Request cashout' }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/campaigns/campaign/payouts', {
        amount: 100,
        type: 'standard',
      }),
    )
    expect(await screen.findByText(/No transfer has been sent yet/)).toBeInTheDocument()
  })
  it('disables a request above eligible proceeds', async () => {
    vi.mocked(api.get).mockImplementation(async (path) =>
      path === '/payout-accounts' ? { accounts: [] } : path.endsWith('payout-options') ? opts : [],
    )
    render(<CampaignCashout campaignId="campaign" />)
    fireEvent.click(screen.getByText('Cashout & payout history'))
    await screen.findByText('GHS 1,000.00 eligible balance')
    fireEvent.change(screen.getByLabelText('Cashout amount (GHS)'), { target: { value: '1001' } })
    expect(screen.getByRole('button', { name: 'Request cashout' })).toBeDisabled()
  })
  it('shows donation alerts and marks them read through the API', async () => {
    vi.mocked(api.get).mockResolvedValue([
      {
        id: 'notice',
        title: 'Your campaign received a donation',
        message: 'A supporter donated GHS 200.',
        read: false,
        createdAt: new Date().toISOString(),
      },
    ])
    vi.mocked(api.put).mockResolvedValue({})
    render(<OwnerNotifications />)
    await screen.findByText('A supporter donated GHS 200.')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Mark as read' })))
    expect(api.put).toHaveBeenCalledWith('/notifications/notice/read')
  })
})
