import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SavedPayoutAccounts } from '@/components/account/SavedPayoutAccounts'
import { api } from '@/lib/api'
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

const account = { id: 'acct-1', type: 'mobile_money', accountName: 'Kwame Mensah', last4: '4567', bankCode: 'MTN', verificationStatus: 'name_matched' }

it('asks for confirmation and sends no DELETE until the person confirms', async () => {
  vi.mocked(api.get).mockImplementation(async (path) =>
    path === '/payout-accounts' ? { planName: 'Free', limit: 1, accounts: [account] } : [],
  )
  vi.mocked(api.delete).mockResolvedValue({ planName: 'Free', limit: 1, accounts: [] })
  render(<SavedPayoutAccounts />)
  fireEvent.click(await screen.findByRole('button', { name: /Remove saved account Kwame Mensah ending 4567/ }))
  const dialog = await screen.findByRole('dialog', { name: 'Remove saved account?' })
  expect(within(dialog).getByText(/Kwame Mensah ending 4567 will be removed/)).toBeVisible()
  expect(api.delete).not.toHaveBeenCalled()

  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.delete).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: /Remove saved account Kwame Mensah ending 4567/ }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove account' }))
  await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/payout-accounts/acct-1'))
  expect(await screen.findByText(/Existing payout requests keep their original destination/)).toBeVisible()
})
