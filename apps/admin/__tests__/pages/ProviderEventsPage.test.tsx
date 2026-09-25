import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), edit: true }))
vi.mock('@/lib/api', () => ({ api: { get: state.get, post: state.post } }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: (_: string, action: string) => action === 'read' || state.edit }) }))
import ProviderEventsPage, { formatProviderAmount } from '@/pages/ProviderEventsPage'

const walletChargeback = {
  id: 'e1', event: 'charge.dispute.create', kind: 'dispute', reference: 'wtop-123', subject: 'wallet_topup',
  providerCaseId: '7002', amountMinor: 5000, currency: 'GHS', providerStatus: 'awaiting-merchant-feedback',
  reviewStatus: 'open', createdAt: '2026-09-24T10:00:00Z',
}
const renderPage = () => render(<MemoryRouter><ProviderEventsPage /></MemoryRouter>)
beforeEach(() => { state.get.mockReset().mockResolvedValue([walletChargeback]); state.post.mockReset().mockResolvedValue({}); state.edit = true })
afterEach(cleanup)

// R2-006: chargebacks/refunds on tips, subscriptions and wallet top-ups had no screen.
it('lists open provider events with what staff must do, and marks one handled', async () => {
  state.get.mockResolvedValueOnce([walletChargeback]).mockResolvedValue([])
  renderPage()
  expect(await screen.findByText('wtop-123', { exact: false })).toBeVisible()
  expect(state.get).toHaveBeenCalledWith('/admin/payments/provider-events?status=open&limit=200')
  expect(screen.getByText('Wallet top-up')).toBeVisible()
  expect(screen.getByText(/The wallet was not debited/)).toBeVisible()
  expect(screen.getByText(/Never answer one with a console refund/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Mark handled' }))
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/admin/payments/provider-events/e1/acknowledge', {}))
  expect(await screen.findByText('No open provider events.')).toBeVisible()
})

it('shows acknowledged events on request and keeps the action disabled for read-only staff', async () => {
  state.edit = false
  renderPage()
  expect(await screen.findByRole('button', { name: 'Mark handled' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Acknowledged' }))
  await waitFor(() => expect(state.get).toHaveBeenLastCalledWith('/admin/payments/provider-events?status=acknowledged&limit=200'))
})

it('formats minor units at the currency precision', () => {
  expect(formatProviderAmount(5000, 'GHS')).toMatch(/50\.00/)
  expect(formatProviderAmount(1234, 'XOF')).toMatch(/1,234/)
  expect(formatProviderAmount(undefined, 'GHS')).toBe('Amount not reported')
})
