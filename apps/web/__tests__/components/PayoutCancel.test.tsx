import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Payout } from '@ubuntu-fund/types'
import { CampaignCashout } from '@/components/campaigns/CampaignCashout'
import { PayoutHistoryCard } from '@/components/campaigns/PayoutHistoryCard'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
afterEach(() => vi.resetAllMocks())

const pending: Payout = {
  id: 'payout-1', campaignId: 'campaign', recipientId: 'recipient', amount: 500, type: 'standard', fee: 0,
  netAmount: 500, currency: 'GHS', status: 'PENDING', provider: 'paystack', requestedBy: 'owner',
  createdAt: new Date('2026-09-20'), updatedAt: new Date('2026-09-20'),
}
const options = { eligible: 1000, currency: 'GHS', recipient: { accountName: 'Owner', last4: '4567', type: 'mobile_money' }, fees: {} }

describe('closing a payout request', () => {
  it('cancels a pending request only after an explicit confirmation', async () => {
    vi.mocked(api.get).mockImplementation(async (path) =>
      path === '/payout-accounts' ? { accounts: [] } : path.endsWith('payout-options') ? options : [pending],
    )
    vi.mocked(api.post).mockResolvedValue({ ...pending, status: 'FAILED', closure: { kind: 'cancelled', reason: 'Cancelled by the campaign owner.', closedBy: 'owner', closedAt: new Date() } })
    render(<CampaignCashout campaignId="campaign" initiallyExpanded />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel request' }))
    expect(api.post).not.toHaveBeenCalledWith('/campaigns/campaign/payouts/payout-1/cancel', {})
    expect(screen.getByText(/Cancel this request\?/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/campaigns/campaign/payouts/payout-1/cancel', {}))
    expect(await screen.findByText(/Request cancelled\. Nothing was sent/)).toBeVisible()
  })

  it('shows a rejection with the admin reason and no cancel control', () => {
    render(<PayoutHistoryCard payout={{ ...pending, status: 'FAILED', closure: { kind: 'rejected', reason: 'Destination evidence did not match the owner.', closedBy: 'admin', closedAt: new Date() } }} onCancel={vi.fn()} />)
    expect(screen.getByText('Rejected')).toBeVisible()
    expect(screen.getByText(/Destination evidence did not match the owner\. Nothing was sent/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull()
  })
})
