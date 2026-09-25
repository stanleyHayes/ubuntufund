import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), edit: true }))
vi.mock('@/lib/api', () => ({ api: { get: state.get, post: state.post } }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: (_: string, action: string) => action === 'read' || state.edit }) }))
import PaymentsPage from '@/pages/PaymentsPage'

const payment = {
  id: 'intent-1', campaignId: 'campaign-1', donorEmail: 'guest@example.test', amount: 200, currency: 'GHS', tip: 20,
  status: 'SUCCEEDED', provider: 'paystack', providerRef: 'PSK-REF-1', createdAt: '2026-09-20T10:00:00Z', updatedAt: '2026-09-20T10:05:00Z',
}
const timeline = { contribution: payment, attempts: [{ id: 'attempt-1', provider: 'paystack', providerRef: 'PSK-REF-1', status: 'SUCCEEDED', createdAt: '2026-09-20T10:01:00Z' }] }
const renderPage = (path = '/payments') => render(<MemoryRouter initialEntries={[path]}><PaymentsPage /></MemoryRouter>)
beforeEach(() => {
  state.get.mockReset().mockImplementation(async (path: string) => path.startsWith('/admin/payments/') ? timeline : [payment])
  state.post.mockReset(); state.edit = true
})
afterEach(cleanup)

it('finds a payment by provider reference and opens its timeline', async () => {
  renderPage()
  fireEvent.change(screen.getByRole('textbox', { name: 'Provider reference' }), { target: { value: ' PSK-REF-1 ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search payments' }))
  await waitFor(() => expect(state.get).toHaveBeenCalledWith('/admin/payments?providerRef=PSK-REF-1'))
  fireEvent.click(await screen.findByRole('button', { name: 'View timeline' }))
  await waitFor(() => expect(state.get).toHaveBeenCalledWith('/admin/payments/intent-1'))
  expect(await screen.findByText(/paystack attempt succeeded/)).toBeVisible()
  expect(screen.getByText(/platform tip/)).toBeVisible()
})

it('opens a deep-linked payment and refunds it only after confirmation', async () => {
  state.post.mockResolvedValue({ status: 'REFUNDED', operationId: 'op-1', amount: 200 })
  renderPage('/payments?id=intent-1')
  fireEvent.click(await screen.findByRole('button', { name: 'Refund payment' }))
  const submit = await screen.findByRole('button', { name: /^Refund GH/ })
  expect(submit).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(submit)
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/admin/payments/intent-1/refund', { idempotencyKey: expect.any(String) }))
})

it('does not offer a refund for unsettled payments or read-only staff', async () => {
  state.get.mockImplementation(async () => ({ ...timeline, contribution: { ...payment, status: 'FAILED' } }))
  renderPage('/payments?id=intent-1')
  expect(await screen.findByText(/Only a settled or partly refunded payment/)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Refund payment' })).toBeNull()
  cleanup()
  state.edit = false
  state.get.mockImplementation(async () => timeline)
  renderPage('/payments?id=intent-1')
  expect(await screen.findByRole('button', { name: 'Refund payment' })).toBeDisabled()
})

it('shows search failures instead of an empty result', async () => {
  state.get.mockRejectedValue(new Error('Search unavailable'))
  renderPage()
  fireEvent.click(screen.getByRole('button', { name: 'Search payments' }))
  expect(await screen.findByText('Search unavailable')).toBeVisible()
  expect(screen.queryByText('No payments match.')).toBeNull()
})
