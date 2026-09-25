import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), edit: true }))
vi.mock('@/lib/api', () => ({ api: { get: state.get, post: state.post, patch: state.patch } }))
vi.mock('@/context/AdminPermissionContext', () => ({ useAdminPermissions: () => ({ can: (_: string, action: string) => action === 'read' || state.edit }) }))
import RefundRequestsPage from '@/pages/RefundRequestsPage'

const NOTE = 'Duplicate payment confirmed on the provider dashboard.'
const item = {
  id: 'request-1', donationId: 'donation-1', campaignId: 'campaign-1', campaignTitle: 'Clinic appeal', requesterId: 'user-1',
  requesterName: 'Ama Mensah', requesterEmail: 'ama@example.test', reason: 'Duplicate donation', description: 'I paid twice.',
  amount: 200, netAmount: 200, currency: 'GHS', status: 'pending', createdAt: '2026-09-20T10:00:00Z',
  contribution: { id: 'intent-1', status: 'SUCCEEDED', provider: 'paystack', providerRef: 'ref-1', currency: 'GHS' },
}
const renderPage = () => render(<MemoryRouter><RefundRequestsPage /></MemoryRouter>)
const note = (value: string) => fireEvent.change(screen.getByRole('textbox', { name: /Staff note/ }), { target: { value } })
beforeEach(() => {
  state.get.mockReset().mockResolvedValue({ items: [item], total: 1 })
  state.post.mockReset(); state.patch.mockReset().mockResolvedValue({}); state.edit = true
})
afterEach(cleanup)

it('lists requests with the donor, campaign and linked payment', async () => {
  renderPage()
  expect(await screen.findByRole('link', { name: 'Ama Mensah' })).toHaveAttribute('href', '/users/user-1')
  expect(state.get).toHaveBeenCalledWith('/admin/refund-requests?status=pending&page=1&pageSize=12')
  expect(screen.getByRole('link', { name: 'Clinic appeal' })).toHaveAttribute('href', '/campaigns/campaign-1')
  expect(screen.getByRole('link', { name: 'View payment timeline' })).toHaveAttribute('href', '/payments?id=intent-1')
})

it('requires a staff note and does not allow marking refunded before the payment is refunded', async () => {
  renderPage()
  const decline = await screen.findByRole('button', { name: 'Decline' })
  expect(decline).toBeDisabled()
  note(NOTE)
  expect(screen.getByRole('button', { name: 'Mark refunded' })).toBeDisabled()
  fireEvent.click(decline)
  await waitFor(() => expect(state.patch).toHaveBeenCalledWith('/admin/refund-requests/request-1', { status: 'failed', staffNote: NOTE }))
})

it('refunds the payment through the dialog and links the refund operation when completing', async () => {
  state.post.mockResolvedValue({ status: 'REFUNDED', operationId: 'op-9', amount: 200 })
  state.get.mockResolvedValueOnce({ items: [item], total: 1 })
    .mockResolvedValue({ items: [{ ...item, contribution: { ...item.contribution, status: 'REFUNDED' } }], total: 1 })
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Refund payment' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('checkbox'))
  fireEvent.click(within(dialog).getByRole('button', { name: /^Refund/ }))
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/admin/payments/intent-1/refund', { idempotencyKey: expect.any(String) }))
  fireEvent.click(await within(dialog).findByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Mark refunded' })).toBeInTheDocument())
  note(NOTE)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Mark refunded' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Mark refunded' }))
  await waitFor(() => expect(state.patch).toHaveBeenCalledWith('/admin/refund-requests/request-1', { status: 'completed', staffNote: NOTE, refundOperationId: 'op-9' }))
})

it('keeps every action disabled for read-only staff', async () => {
  state.edit = false
  renderPage()
  expect(await screen.findByRole('button', { name: 'Refund payment' })).toBeDisabled()
  expect(screen.getByRole('textbox', { name: /Staff note/ })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Decline' })).toBeDisabled()
})

it('passes what was already refunded to the dialog and caps the refund at the remainder', async () => {
  state.get.mockResolvedValue({ items: [{ ...item, contribution: { ...item.contribution, status: 'PARTIALLY_REFUNDED', amount: 200, refundedAmountMinor: 5000 } }], total: 1 })
  state.post.mockResolvedValue({ status: 'REFUNDED', operationId: 'op-5', amount: 150 })
  renderPage()
  expect(await screen.findByText(/Refunded GH₵50 · GH₵150 still refundable/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Refund payment' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByRole('spinbutton', { name: /Refund amount/ })).toHaveValue(150)
  fireEvent.click(within(dialog).getByRole('checkbox'))
  fireEvent.click(within(dialog).getByRole('button', { name: /^Refund/ }))
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/admin/payments/intent-1/refund', { amount: 150, idempotencyKey: expect.any(String) }))
})

it('reloads the queue after a failed refund and reuses the key when the payment is unchanged', async () => {
  state.post.mockRejectedValueOnce(new Error('Gateway timeout')).mockRejectedValueOnce(new Error('This refund was already processed or would exceed the refundable amount'))
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Refund payment' }))
  let dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('checkbox'))
  fireEvent.click(within(dialog).getByRole('button', { name: /^Refund/ }))
  expect(await within(dialog).findByText(/Gateway timeout/)).toBeVisible()
  const loadsBefore = state.get.mock.calls.length
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(state.get.mock.calls.length).toBe(loadsBefore + 1))
  fireEvent.click(await screen.findByRole('button', { name: 'Refund payment' }))
  dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('checkbox'))
  fireEvent.click(within(dialog).getByRole('button', { name: /^Refund/ }))
  await waitFor(() => expect(state.post).toHaveBeenCalledTimes(2))
  expect(state.post.mock.calls[1][1].idempotencyKey).toBe(state.post.mock.calls[0][1].idempotencyKey)
})

it('hides the refund action when nothing is left to refund', async () => {
  state.get.mockResolvedValue({ items: [{ ...item, contribution: { ...item.contribution, status: 'PARTIALLY_REFUNDED', amount: 200, refundedAmountMinor: 20000 } }], total: 1 })
  renderPage()
  expect(await screen.findByRole('link', { name: 'View payment timeline' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Refund payment' })).toBeNull()
})
