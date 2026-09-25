vi.mock('@/components/ExportMenu', () => ({ default: () => null }))
vi.mock('@/components/payments/CryptoOperations', () => ({ default: () => null }))
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ patch: vi.fn(), providers: [] as unknown[] }))
vi.mock('@/lib/api', () => ({ api: { patch: state.patch } }))
vi.mock('@/hooks/useApiData', () => ({ useAdminPaymentProviders: () => ({ data: state.providers, isLoading: false, error: null }) }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: () => true }) }))
import PaymentProvidersPage from '@/pages/PaymentProvidersPage'

const row = (id: string, name: string, type: string, enabled: boolean) => ({ id, name, slug: id, type, enabled, isDefault: false, feePercent: 1.5, displayOrder: 0, createdAt: new Date() })
beforeEach(() => {
  state.providers = [row('paystack', 'Paystack', 'gateway', false), row('wallet', 'Ujimora Wallet', 'wallet', false), row('mtn-momo', 'MTN MoMo', 'mobile_money', false)]
  state.patch.mockReset().mockImplementation(async (path: string) => ({ ...(state.providers as ReturnType<typeof row>[]).find(p => path.includes(p.id)), enabled: true }))
})
afterEach(cleanup)

it('lets an admin switch a disabled gateway back on', async () => {
  render(<PaymentProvidersPage />)
  const toggle = screen.getByRole('switch', { name: 'Toggle Paystack' })
  expect(toggle).toBeEnabled()
  expect(screen.getByText(/New donation checkouts on this gateway are stopped/)).toBeVisible()
  fireEvent.click(toggle)
  await waitFor(() => expect(state.patch).toHaveBeenCalledWith('/payment-providers/paystack/toggle'))
  expect(await screen.findByText('Paystack enabled.')).toBeVisible()
})

it('keeps method rows off with an explanation, and labels a disabled gateway as disabled', () => {
  render(<PaymentProvidersPage />)
  expect(screen.getByRole('switch', { name: 'Toggle MTN MoMo' })).toBeDisabled()
  expect(screen.getByRole('switch', { name: 'Toggle Ujimora Wallet' })).toBeEnabled()
  expect(screen.getAllByText('Disabled', { selector: '.MuiChip-label' })).toHaveLength(2)
  expect(screen.getAllByText('Not available yet', { selector: '.MuiChip-label' })).toHaveLength(1)
  expect(screen.getAllByText(/has no integration of its own/)).toHaveLength(1)
  expect(screen.queryByText(/legacy wallet provider configuration/)).toBeNull()
  expect(screen.getByText(/do not yet affect wallet top-ups, subscriptions, creator tips or payouts/)).toBeVisible()
})
