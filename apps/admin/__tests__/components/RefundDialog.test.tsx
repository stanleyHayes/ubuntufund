import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { post: state.post } }))
import RefundDialog from '@/components/payments/RefundDialog'

const contribution = { id: 'intent-1', amount: 200, currency: 'GHS', provider: 'paystack', providerRef: 'ref-1', status: 'SUCCEEDED' }
const renderDialog = (onRefunded = vi.fn(), target: typeof contribution & { refundedAmountMinor?: number } = contribution, onClose = vi.fn()) => {
  render(<RefundDialog open contribution={target} idempotencyKey="key-1" onClose={onClose} onRefunded={onRefunded} />); return onRefunded
}
const confirm = () => fireEvent.click(screen.getByRole('checkbox'))
const submitButton = () => screen.getByRole('button', { name: /^Refund/ })
beforeEach(() => state.post.mockReset())
afterEach(cleanup)

it('needs explicit confirmation and sends one request with one idempotency key on a double click', async () => {
  let resolve: (value: unknown) => void = () => {}
  state.post.mockReturnValue(new Promise(r => { resolve = r }))
  const onRefunded = renderDialog()
  expect(submitButton()).toBeDisabled()
  confirm()
  const button = submitButton()
  fireEvent.click(button)
  fireEvent.click(button)
  expect(state.post).toHaveBeenCalledTimes(1)
  expect(button).toBeDisabled()
  const [path, body] = state.post.mock.calls[0]
  expect(path).toBe('/admin/payments/intent-1/refund')
  expect(body).toEqual({ idempotencyKey: 'key-1' })
  resolve({ status: 'REFUNDED', operationId: 'op-1', refundReference: '55667788', amount: 200 })
  expect(await screen.findByText(/confirmed by the provider/)).toBeVisible()
  expect(onRefunded).toHaveBeenCalledWith(expect.objectContaining({ operationId: 'op-1' }))
  expect(screen.queryByRole('button', { name: /^Refund/ })).toBeNull()
})

it('reuses the same key when retrying after a failure', async () => {
  state.post.mockRejectedValueOnce(new Error('Network error')).mockResolvedValue({ status: 'REFUNDED', operationId: 'op-1', amount: 200 })
  renderDialog()
  confirm()
  fireEvent.click(submitButton())
  expect(await screen.findByText(/Network error/)).toBeVisible()
  fireEvent.click(submitButton())
  await waitFor(() => expect(state.post).toHaveBeenCalledTimes(2))
  expect(state.post.mock.calls[1][1].idempotencyKey).toBe(state.post.mock.calls[0][1].idempotencyKey)
})

it('sends a partial amount and rejects amounts above the contribution', async () => {
  state.post.mockResolvedValue({ status: 'PARTIALLY_REFUNDED', operationId: 'op-2', amount: 50 })
  renderDialog()
  confirm()
  const amount = screen.getByRole('spinbutton', { name: /Refund amount/ })
  fireEvent.change(amount, { target: { value: '250' } })
  expect(submitButton()).toBeDisabled()
  fireEvent.change(amount, { target: { value: '50' } })
  fireEvent.click(submitButton())
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/admin/payments/intent-1/refund', { amount: 50, idempotencyKey: expect.any(String) }))
})

it('reports a still-processing refund as not complete', async () => {
  state.post.mockResolvedValue({ status: 'PROCESSING', operationId: 'op-3', amount: 200 })
  renderDialog()
  confirm()
  fireEvent.click(submitButton())
  expect(await screen.findByText(/still processing this refund/)).toBeVisible()
  expect(screen.queryByText(/confirmed by the provider/)).toBeNull()
})

it('offers only what is left after an earlier partial refund and always names the amount', async () => {
  state.post.mockResolvedValue({ status: 'REFUNDED', operationId: 'op-4', amount: 160 })
  renderDialog(vi.fn(), { ...contribution, status: 'PARTIALLY_REFUNDED', refundedAmountMinor: 4000 })
  expect(screen.getByText(/Already refunded GH₵40 · GH₵160 remaining/)).toBeVisible()
  const amount = screen.getByRole('spinbutton', { name: /Refund amount/ })
  expect(amount).toHaveValue(160)
  expect(screen.getByText('Remaining refundable amount')).toBeVisible()
  confirm()
  fireEvent.change(amount, { target: { value: '200' } })
  expect(submitButton()).toBeDisabled()
  fireEvent.change(amount, { target: { value: '160' } })
  fireEvent.click(submitButton())
  // The server's default is the full original amount, which would be refused.
  await waitFor(() => expect(state.post).toHaveBeenCalledWith('/admin/payments/intent-1/refund', { amount: 160, idempotencyKey: 'key-1' }))
})

it('asks the page to reload after a failure, and not after a plain cancel', () => {
  const onClose = vi.fn()
  renderDialog(vi.fn(), contribution, onClose)
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onClose).toHaveBeenLastCalledWith(false)
})

it('reports a failed attempt when closing so the page reloads before another refund', async () => {
  state.post.mockRejectedValueOnce(new Error('Connection lost'))
  const onClose = vi.fn()
  renderDialog(vi.fn(), contribution, onClose)
  confirm()
  fireEvent.click(submitButton())
  expect(await screen.findByText(/Closing reloads the payment/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onClose).toHaveBeenLastCalledWith(true)
})
