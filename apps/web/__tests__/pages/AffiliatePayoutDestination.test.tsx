import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import type { AffiliateDashboard } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }
})
const hook = vi.hoisted(() => ({ dashboard: null as AffiliateDashboard | null, refresh: vi.fn() }))
vi.mock('@/hooks/useAffiliate', () => ({
  useAffiliate: () => ({ dashboard: hook.dashboard, enrolled: true, isLoading: false, isEnrolling: false, error: null, enroll: vi.fn(), refresh: hook.refresh }),
}))
import { AffiliateDashboardPage } from '@/pages/AffiliateDashboardPage'
afterEach(() => { cleanup(); vi.resetAllMocks() })

const dashboard = (recipient: boolean): AffiliateDashboard => ({
  affiliate: {
    id: 'aff-1', userId: 'user-1', referralCode: 'AMA', status: 'active' as never, commissionRate: 10,
    ...(recipient ? { recipientCode: 'RCP_1', accountName: 'Kwame Mensah', bankCode: 'MTN', accountNumber: '0241234567' } : {}),
    createdAt: new Date(), updatedAt: new Date(),
  },
  balance: { id: 'b', affiliateId: 'aff-1', currency: 'GHS', totalEarned: 50, pendingBalance: 0, availableBalance: 50, paidOutBalance: 0, updatedAt: new Date() },
  referralLink: 'https://example.test?ref=AMA',
  stats: { totalReferrals: 1, convertedReferrals: 1, pendingReferrals: 0, totalEarned: 50, availableBalance: 50, pendingBalance: 0, paidOutBalance: 0 },
})
const accounts = [
  { id: 'acct-unmatched', type: 'mobile_money', accountName: 'Someone', last4: '1111', bankCode: 'MTN', verificationStatus: 'needs_review' },
  { id: 'acct-matched', type: 'mobile_money', accountName: 'Kwame Mensah', last4: '4567', bankCode: 'MTN', verificationStatus: 'name_matched' },
]

it('blocks payout requests until a name-matched saved account is chosen as the destination', async () => {
  hook.dashboard = dashboard(false)
  vi.mocked(api.get).mockImplementation(async (path: string) => (path === '/payout-accounts' ? { planName: 'Free', limit: 2, accounts } : []))
  vi.mocked(api.post).mockResolvedValue({})
  render(<MemoryRouter><AffiliateDashboardPage /></MemoryRouter>)
  expect(await screen.findByText('Choose a payout destination before requesting a payout.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Request payout' })).toBeDisabled()

  fireEvent.mouseDown(await screen.findByRole('combobox', { name: 'Saved payout account' }))
  const listbox = await screen.findByRole('listbox')
  expect(within(listbox).getByRole('option', { name: /Someone .*name not matched/ })).toHaveAttribute('aria-disabled', 'true')
  fireEvent.click(within(listbox).getByRole('option', { name: /Kwame Mensah/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Use this account' }))
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/affiliate/payout-recipient', { savedAccountId: 'acct-matched' }))
  expect(hook.refresh).toHaveBeenCalled()
})

it('shows the chosen destination and lets the affiliate request a payout', async () => {
  hook.dashboard = dashboard(true)
  vi.mocked(api.get).mockResolvedValue([])
  render(<MemoryRouter><AffiliateDashboardPage /></MemoryRouter>)
  expect(await screen.findByText(/Payouts go to Kwame Mensah/)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Request payout' })).toBeEnabled()
})
