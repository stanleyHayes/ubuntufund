import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

it('shows what was already refunded and offers only the remainder', async () => {
  state.get.mockImplementation(async () => ({ ...timeline, contribution: { ...payment, status: 'PARTIALLY_REFUNDED', refundedAmountMinor: 4000 } }))
  state.post.mockResolvedValue({ status: 'REFUNDED', operationId: 'op-2', amount: 160 })
  renderPage('/payments?id=intent-1')
  expect(await screen.findByText(/Refunded GH₵40 · GH₵160 still refundable/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Refund payment' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByRole('spinbutton', { name: /Refund amount/ })).toHaveValue(160)
  fireEvent.click(within(dialog).getByRole('checkbox'))
  fireEvent.click(within(dialog).getByRole('button', { name: /^Refund GH/ }))
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/admin/payments/intent-1/refund', { amount: 160, idempotencyKey: expect.any(String) }))
})

it('reloads the payment after a failed refund and reuses the same key when reopened', async () => {
  state.post.mockRejectedValueOnce(new Error('Gateway timeout')).mockRejectedValueOnce(new Error('This refund was already processed or would exceed the refundable amount'))
  renderPage('/payments?id=intent-1')
  fireEvent.click(await screen.findByRole('button', { name: 'Refund payment' }))
  let dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('checkbox'))
  fireEvent.click(within(dialog).getByRole('button', { name: /^Refund GH/ }))
  expect(await within(dialog).findByText(/Gateway timeout/)).toBeVisible()
  const loadsBefore = state.get.mock.calls.filter(([path]) => path === '/admin/payments/intent-1').length
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(state.get.mock.calls.filter(([path]) => path === '/admin/payments/intent-1').length).toBe(loadsBefore + 1))
  // Nothing changed on the payment, so a reopened dialog sends the same request.
  fireEvent.click(await screen.findByRole('button', { name: 'Refund payment' }))
  dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('checkbox'))
  fireEvent.click(within(dialog).getByRole('button', { name: /^Refund GH/ }))
  await waitFor(() => expect(state.post).toHaveBeenCalledTimes(2))
  expect(state.post.mock.calls[1][1].idempotencyKey).toBe(state.post.mock.calls[0][1].idempotencyKey)
})

it('uses a new key once the reloaded payment shows the earlier refund', async () => {
  state.post.mockRejectedValueOnce(new Error('Gateway timeout')).mockResolvedValueOnce({ status: 'REFUNDED', operationId: 'op-3', amount: 160 })
  let reloads = 0
  state.get.mockImplementation(async () => reloads++ === 0 ? timeline : { ...timeline, contribution: { ...payment, status: 'PARTIALLY_REFUNDED', refundedAmountMinor: 4000 } })
  renderPage('/payments?id=intent-1')
  fireEvent.click(await screen.findByRole('button', { name: 'Refund payment' }))
  let dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByRole('spinbutton', { name: /Refund amount/ }), { target: { value: '40' } })
  fireEvent.click(within(dialog).getByRole('checkbox'))
  fireEvent.click(within(dialog).getByRole('button', { name: /^Refund GH/ }))
  expect(await within(dialog).findByText(/Gateway timeout/)).toBeVisible()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  // The reload shows the first attempt went through; the admin sees it before refunding again.
  expect(await screen.findByText(/Refunded GH₵40 · GH₵160 still refundable/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Refund payment' }))
  dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('checkbox'))
  fireEvent.click(within(dialog).getByRole('button', { name: /^Refund GH/ }))
  await waitFor(() => expect(state.post).toHaveBeenCalledTimes(2))
  expect(state.post.mock.calls[1][1]).toMatchObject({ amount: 160 })
  expect(state.post.mock.calls[1][1].idempotencyKey).not.toBe(state.post.mock.calls[0][1].idempotencyKey)
})
